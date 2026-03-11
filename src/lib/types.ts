export type Category =
  | "familiar"
  | "sexual"
  | "laboral"
  | "económico"
  | "salud"
  | "social"
  | "espiritual"
  | "educativo";

export type ImpactType = "positivo" | "negativo" | "neutro";

/** Grados de daño inspirados en EMS-98 European Macroseismic Scale */
export type DamageGrade = "DG0" | "DG1" | "DG2" | "DG3" | "DG4";

/** Niveles de transición entre pisos, inspirados en FEMA 356 inter-story drift */
export type DriftLevel = "suave" | "forzada" | "traumática";

export interface CapasUser {
  id: string;
  name: string;
  birth_date: string;
  created_at: string;
}

export interface CapasEvent {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  event_date: string;
  category: Category;
  impact: number;
  impact_type: ImpactType;
  reflection: string | null;
  created_at: string;
}

export interface Floor {
  label: string;
  ageRange: string;
  startYear: number;
  endYear: number;
  events: CapasEvent[];

  /* ─── Métricas base ─────────────────────────────────────────────── */

  /** Salud bruta (antes de ajustes). [-1, 1] */
  rawHealth: number;
  /** Índice de fatiga cíclica (Park-Ang). >= 0 */
  fatigueIndex: number;
  /** Daño pico: peor evento negativo normalizado (Park-Ang delta_max). [0, 1] */
  peakDamage: number;
  /** Factor de redundancia por diversidad de categorías (ASCE 7 rho). [0.7, 1.0] */
  redundancy: number;
  /** Salud ajustada con fatiga + redundancia. [-1, 1] */
  health: number;

  /* ─── Métricas estructurales ────────────────────────────────────── */

  /** Estabilidad acumulada con amplificación de cimientos. [-1.5, 1.5] clamped a [-1, 1] */
  stability: number;
  /** Drift entre este piso y el de abajo (FEMA 356). >= 0 */
  drift: number;
  /** Clasificación del drift */
  driftLevel: DriftLevel;
  /** Grado de daño (EMS-98 adaptado). DG0-DG4 */
  damageGrade: DamageGrade;
}

export const CATEGORIES: { value: Category; label: string; color: string }[] = [
  { value: "familiar", label: "Familiar", color: "#3B82F6" },
  { value: "sexual", label: "Sexual", color: "#EC4899" },
  { value: "laboral", label: "Laboral", color: "#F97316" },
  { value: "económico", label: "Económico", color: "#22C55E" },
  { value: "salud", label: "Salud", color: "#EF4444" },
  { value: "social", label: "Social", color: "#8B5CF6" },
  { value: "espiritual", label: "Espiritual", color: "#EAB308" },
  { value: "educativo", label: "Educativo", color: "#06B6D4" },
];

export const TOTAL_CATEGORIES = CATEGORIES.length; // 8

export const DAMAGE_GRADES: { grade: DamageGrade; label: string; description: string }[] = [
  { grade: "DG0", label: "Intacto", description: "Cimientos fuertes; recursos de resiliencia" },
  { grade: "DG1", label: "Fisuras", description: "Estrés menor absorbido; algo de afrontamiento necesario" },
  { grade: "DG2", label: "Moderado", description: "Experiencias mixtas; funcional pero con tensión visible" },
  { grade: "DG3", label: "Sustancial", description: "Carga negativa significativa; afecta pisos superiores" },
  { grade: "DG4", label: "Severo", description: "Experiencias abrumadoras; integridad estructural comprometida" },
];

export function getCategoryColor(category: Category): string {
  return CATEGORIES.find((c) => c.value === category)?.color ?? "#9CA3AF";
}

/* ═══════════════════════════════════════════════════════════════════════════
 * ANÁLISIS ESTRUCTURAL IA — Parámetros generados por el agente ingeniero
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Tipo de falla estructural (ingeniería civil real) */
export type FailureType =
  | "none"              // Sin falla
  | "asentamiento"      // Differential settlement — building sinks on one side (abandono, vacío)
  | "cortante"          // Shear failure — diagonal cracks (abuso, trauma agudo)
  | "flexion"           // Flexural failure — bending/bowing (sobrecarga emocional)
  | "torsion"           // Torsional failure — twisting (identidad fragmentada)
  | "pandeo";           // Buckling — columns bowing outward (presión sin soporte)

/** Cadena causal: conexión entre eventos de diferentes pisos */
export interface CausalChain {
  /** Evento origen (título) */
  fromEvent: string;
  /** Piso de origen (index 0-based) */
  fromFloor: number;
  /** Evento consecuencia (título) */
  toEvent: string;
  /** Piso de consecuencia (index 0-based) */
  toFloor: number;
  /** Descripción de la conexión causal */
  description: string;
  /** Intensidad de la conexión [0-1] */
  strength: number;
}

/** Análisis de un piso individual generado por IA */
export interface FloorAnalysis {
  /** Índice del piso (0 = Cimientos) */
  floorIndex: number;
  /** Tipo de falla predominante */
  failureType: FailureType;
  /** Factor de ancho override por IA [0.3 - 1.0] */
  widthFactor: number;
  /** Factor de alto override por IA [0.3 - 1.0] */
  heightFactor: number;
  /** Inclinación específica de este piso en grados [-5, 5] */
  tiltDeg: number;
  /** Peso de herencia del piso inferior [0-1] — cuánto afecta el piso de abajo */
  inheritanceWeight: number;
  /** Diagnóstico narrativo del piso (1-2 oraciones) */
  narrative: string;
}

/** Análisis completo del edificio generado por IA */
export interface BuildingAnalysis {
  /** Análisis por piso */
  floors: FloorAnalysis[];
  /** Cadenas causales entre eventos de distintos pisos */
  causalChains: CausalChain[];
  /** Diagnóstico general del edificio (3-5 oraciones) */
  overallDiagnosis: string;
  /** Score de integridad estructural global [0-100] */
  structuralIntegrity: number;
  /** Timestamp del análisis */
  analyzedAt: string;
}
