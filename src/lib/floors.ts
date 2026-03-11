import { CapasEvent, Floor, DamageGrade, DriftLevel, TOTAL_CATEGORIES } from "./types";

/* ═══════════════════════════════════════════════════════════════════════════
 * SISTEMA DE EVALUACIÓN ESTRUCTURAL — inspirado en ingeniería civil real
 *
 * Fuentes:
 *   • Park-Ang Damage Index (fatiga cíclica)
 *   • ASCE 7 Redundancy Factor rho (diversidad de categorías)
 *   • Foundation Bearing Capacity Fs (amplificación de cimientos)
 *   • FEMA 356 Inter-Story Drift (transiciones entre pisos)
 *   • EMS-98 Damage Grades (clasificación de daño)
 *   • Signal Attenuation (pisos vacíos)
 *
 * ═══════════════════════════════════════════════════════════════════════════ */

/* ─── CONSTANTES ──────────────────────────────────────────────────────── */

/** Sensibilidad a fatiga cíclica (Park-Ang beta). Rango típico: 0.05-0.15 */
const FATIGUE_BETA = 0.10;

/** Capacidad de referencia: eventos "normales" antes de que la fatiga pese */
const FATIGUE_REF_CAPACITY = 10;

/** Peso del piso de abajo en la herencia de estabilidad */
const INHERITANCE_BELOW = 0.60;

/** Peso propio del piso en la estabilidad */
const INHERITANCE_OWN = 0.40;

/** Herencia incrementada del primer piso sobre cimientos (70% en vez de 60%) */
const INHERITANCE_FROM_FOUNDATION = 0.70;

/** Factor de amplificación de cimientos (Fs inspirado en bearing capacity) */
const FOUNDATION_AMPLIFIER = 1.5;

/** Atenuación por piso vacío (señal se degrada 5% sin refuerzo) */
const EMPTY_FLOOR_DAMPING = 0.95;

/** Peso del daño pico (Park-Ang delta_max/delta_ult).
 *  Controla cuánto pesa el peor evento negativo independientemente del balance.
 *  0.0 = el peor evento no importa (sistema original)
 *  1.0 = solo importa el peor evento
 *  0.40 = 40% peor evento + 60% balance general */
const PEAK_DAMAGE_WEIGHT = 0.40;

/* ─── 1. SALUD BRUTA (raw health) ─────────────────────────────────────── */

function calculateRawHealth(events: CapasEvent[]): number {
  if (events.length === 0) return 0;

  let score = 0;
  let maxPossible = 0;

  for (const e of events) {
    const weight = e.impact; // 1-10
    maxPossible += weight;

    if (e.impact_type === "positivo") {
      score += weight;
    } else if (e.impact_type === "negativo") {
      score -= weight;
    }
    // neutro no suma ni resta
  }

  if (maxPossible === 0) return 0;
  return Math.max(-1, Math.min(1, score / maxPossible));
}

/* ─── 1b. DAÑO PICO (Park-Ang delta_max) ─────────────────────────────── *
 *
 * En Park-Ang: DI = delta_max/delta_ult + beta × ∫dE/(Qy×delta_ult)
 *
 * El término delta_max/delta_ult captura la deformación máxima: un solo
 * evento catastrófico deja daño permanente sin importar cuántos eventos
 * positivos lo acompañen. La ausencia de un padre (9/10) no se "cancela"
 * con el amor de la madre (7/10).
 *
 * peakDamage = maxNegativeImpact / 10  →  [0, 1]
 *
 * Se mezcla con el balance general:
 *   health = balance × (1 - PEAK_WEIGHT) + (-peakDamage) × PEAK_WEIGHT
 * ──────────────────────────────────────────────────────────────────────── */

function calculatePeakDamage(events: CapasEvent[]): number {
  let maxNeg = 0;
  for (const e of events) {
    if (e.impact_type === "negativo" && e.impact > maxNeg) {
      maxNeg = e.impact;
    }
  }
  return maxNeg / 10; // normalizar a [0, 1]
}

/* ─── 2. FATIGA CÍCLICA (Park-Ang) ───────────────────────────────────── *
 *
 * DI = delta_max/delta_ult + beta × ∫dE / (Qy × delta_ult)
 *
 * Adaptación: penalizar pisos con muchos eventos (alta carga cíclica)
 * aunque positivos y negativos se "cancelen". Un piso con 20 eventos
 * (10+, 10-) no es igual a un piso vacío aunque ambos tengan health ≈ 0.
 *
 * fatigueIndex = beta × (totalEventos / capacidadReferencia)
 * ──────────────────────────────────────────────────────────────────────── */

function calculateFatigueIndex(events: CapasEvent[]): number {
  if (events.length === 0) return 0;
  return FATIGUE_BETA * (events.length / FATIGUE_REF_CAPACITY);
}

/* ─── 3. REDUNDANCIA (ASCE 7 rho) ────────────────────────────────────── *
 *
 * En estructuras reales, más caminos de carga = más redundancia = más seguro.
 * Un piso con eventos en muchas categorías tiene más "columnas de soporte".
 *
 * redundancy = categoríasÚnicas / totalCategorías   → [0.125, 1.0]
 * rho = 0.7 + 0.3 × redundancy                     → [0.7375, 1.0]
 *
 * Salud positiva se amplifica con buena redundancia.
 * Salud negativa se amplifica con mala redundancia.
 * ──────────────────────────────────────────────────────────────────────── */

function calculateRedundancy(events: CapasEvent[]): number {
  if (events.length === 0) return 0;
  const uniqueCategories = new Set(events.map((e) => e.category)).size;
  return uniqueCategories / TOTAL_CATEGORIES;
}

function applyRedundancy(rawHealth: number, redundancy: number): number {
  if (redundancy === 0) return rawHealth;
  const rho = 0.7 + 0.3 * redundancy;
  // Positivo: se beneficia de redundancia. Negativo: se perjudica por falta de ella.
  return rawHealth > 0 ? rawHealth * rho : rawHealth / rho;
}

/* ─── 4. SALUD AJUSTADA ──────────────────────────────────────────────── *
 *
 * Fórmula completa (Park-Ang adaptado):
 *
 *   balance = applyRedundancy(rawHealth, rho) - fatigueIndex
 *   health  = balance × (1 - PEAK_WEIGHT) + (-peakDamage) × PEAK_WEIGHT
 *
 * Esto garantiza que un evento negativo severo (padre ausente, 9/10)
 * siempre deja huella estructural. Con madre positiva (7/10):
 *   balance ≈ -0.12,  peakDamage = 0.9
 *   health = -0.12 × 0.6 + (-0.9) × 0.4 = -0.072 + (-0.36) = -0.43
 *   → DG3 (Sustancial) en vez del anterior -0.12 → DG2 (Moderado)
 * ──────────────────────────────────────────────────────────────────────── */

function calculateAdjustedHealth(
  rawHealth: number,
  fatigueIndex: number,
  redundancy: number,
  peakDamage: number
): number {
  const withRedundancy = applyRedundancy(rawHealth, redundancy);
  const balance = withRedundancy - fatigueIndex;

  // Si no hay daño pico, solo usar el balance
  if (peakDamage === 0) return Math.max(-1, Math.min(1, balance));

  // Mezclar balance con daño pico (Park-Ang dual-term)
  const combined = balance * (1 - PEAK_DAMAGE_WEIGHT) + (-peakDamage) * PEAK_DAMAGE_WEIGHT;
  return Math.max(-1, Math.min(1, combined));
}

/* ─── 5. DRIFT (FEMA 356 Inter-Story Drift) ──────────────────────────── *
 *
 * drift = |stability[i] - stability[i-1]|
 *
 * Clasificación (inspirada en FEMA 356 performance levels):
 *   < 0.15  → suave       (Immediate Occupancy)
 *   0.15-0.40 → forzada   (Life Safety)
 *   > 0.40  → traumática  (Collapse Prevention)
 * ──────────────────────────────────────────────────────────────────────── */

function classifyDrift(drift: number): DriftLevel {
  if (drift < 0.15) return "suave";
  if (drift <= 0.40) return "forzada";
  return "traumática";
}

/* ─── 6. GRADO DE DAÑO (EMS-98 adaptado) ─────────────────────────────── *
 *
 * Mapea la salud continua a 5 grados discretos con significado psicológico:
 *
 *   [0.6, 1.0]    → DG0: Intacto
 *   [0.2, 0.6)    → DG1: Fisuras menores
 *   [-0.2, 0.2)   → DG2: Moderado
 *   [-0.6, -0.2)  → DG3: Sustancial
 *   [-1.0, -0.6)  → DG4: Severo/Crítico
 * ──────────────────────────────────────────────────────────────────────── */

function classifyDamageGrade(health: number): DamageGrade {
  if (health >= 0.6) return "DG0";
  if (health >= 0.2) return "DG1";
  if (health >= -0.2) return "DG2";
  if (health >= -0.6) return "DG3";
  return "DG4";
}

/* ═══════════════════════════════════════════════════════════════════════════
 * FUNCIÓN PRINCIPAL: buildFloors
 * ═══════════════════════════════════════════════════════════════════════════ */

export function buildFloors(
  events: CapasEvent[],
  birthDate: string
): Floor[] {
  const birth = new Date(birthDate);
  const birthYear = birth.getFullYear();

  const ranges = [
    { label: "Cimientos", ageRange: "0-6 años", start: 0, end: 6 },
    { label: "Piso 1", ageRange: "7-12 años", start: 7, end: 12 },
    { label: "Piso 2", ageRange: "13-17 años", start: 13, end: 17 },
    { label: "Piso 3", ageRange: "18-25 años", start: 18, end: 25 },
    { label: "Piso 4", ageRange: "26-35 años", start: 26, end: 35 },
    { label: "Piso 5", ageRange: "36-50 años", start: 36, end: 50 },
    { label: "Piso 6", ageRange: "51-65 años", start: 51, end: 65 },
    { label: "Ático", ageRange: "66+ años", start: 66, end: 200 },
  ];

  const floors: Floor[] = ranges.map((r) => {
    const startYear = birthYear + r.start;
    const endYear = birthYear + r.end;
    const floorEvents = events.filter((e) => {
      const year = new Date(e.event_date).getFullYear();
      return year >= startYear && year <= endYear;
    });

    const rawHealth = calculateRawHealth(floorEvents);
    const fatigueIndex = calculateFatigueIndex(floorEvents);
    const redundancy = calculateRedundancy(floorEvents);
    const peakDamage = calculatePeakDamage(floorEvents);
    const health = calculateAdjustedHealth(rawHealth, fatigueIndex, redundancy, peakDamage);

    return {
      label: r.label,
      ageRange: r.ageRange,
      startYear,
      endYear,
      events: floorEvents,
      rawHealth,
      fatigueIndex,
      peakDamage,
      redundancy,
      health,
      stability: 0,
      drift: 0,
      driftLevel: "suave" as DriftLevel,
      damageGrade: classifyDamageGrade(health),
    };
  });

  /* ─── Calcular estabilidad con las 6 mejoras ────────────────────────── */

  for (let i = 0; i < floors.length; i++) {
    if (i === 0) {
      // MEJORA 3: Amplificación de cimientos (Fs = 1.5)
      // Los cimientos pesan más — en ingeniería real Fs = 2.5-3.0
      floors[i].stability = Math.max(-1, Math.min(1,
        floors[i].health * FOUNDATION_AMPLIFIER
      ));
    } else {
      const belowStability = floors[i - 1].stability;
      const ownHealth = floors[i].health;

      if (floors[i].events.length === 0) {
        // MEJORA 5: Atenuación por piso vacío (5% damping)
        // Sin eventos no hay refuerzo — la señal se degrada ligeramente
        floors[i].stability = belowStability * EMPTY_FLOOR_DAMPING;
      } else {
        // MEJORA 3b: Primer piso hereda 70% de cimientos (en vez de 60%)
        const inheritFactor = i === 1 ? INHERITANCE_FROM_FOUNDATION : INHERITANCE_BELOW;
        const ownFactor = 1 - inheritFactor;
        floors[i].stability = Math.max(-1, Math.min(1,
          belowStability * inheritFactor + ownHealth * ownFactor
        ));
      }
    }

    // MEJORA 4: Calcular drift (FEMA 356)
    if (i > 0) {
      floors[i].drift = Math.abs(floors[i].stability - floors[i - 1].stability);
      floors[i].driftLevel = classifyDrift(floors[i].drift);
    }

    // Recalcular grado de daño con estabilidad final
    // Usamos el peor entre health y stability para el grado
    const worstScore = Math.min(floors[i].health, floors[i].stability);
    floors[i].damageGrade = classifyDamageGrade(worstScore);
  }

  return floors;
}
