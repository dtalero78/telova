import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Eres un INGENIERO ESTRUCTURAL y PSICÓLOGO CLÍNICO especializado en evaluar la integridad de "edificios de vida". Combinas conocimiento profundo de:

1. INGENIERÍA CIVIL: fallas estructurales reales (asentamiento diferencial, cortante, flexión, torsión, pandeo)
2. PSICOLOGÍA DEL DESARROLLO: Erikson, Bowlby, ACEs, trauma complejo
3. MECÁNICA DE FRACTURA: cómo las grietas se propagan entre pisos

Tu trabajo es analizar TODOS los eventos de vida de una persona y generar un DICTAMEN ESTRUCTURAL COMPLETO del edificio, determinando:

═══════════════════════════════════════════════════════════════
TIPOS DE FALLA ESTRUCTURAL (mapeo psicológico):
═══════════════════════════════════════════════════════════════

• "asentamiento" — Asentamiento diferencial
  El edificio se hunde de un lado. Ocurre cuando hay VACÍO FUNDAMENTAL:
  padre ausente, abandono, negligencia. El suelo no soporta uniformemente.
  Visual: el piso se inclina hacia un lado, hay hundimiento.

• "cortante" — Falla por cortante
  Grietas DIAGONALES cruzando el piso. Ocurre con TRAUMA AGUDO:
  abuso sexual, violencia, evento único devastador. La fuerza es tan
  grande que corta transversalmente la estructura.
  Visual: grietas en X, cortes diagonales pronunciados.

• "flexion" — Falla por flexión
  El piso se CURVA hacia abajo en el centro (pandeo). Ocurre con
  SOBRECARGA EMOCIONAL: demasiados eventos negativos acumulados,
  responsabilidades excesivas, burnout.
  Visual: el piso se comba, las columnas se doblan hacia afuera.

• "torsion" — Falla por torsión
  El piso se TUERCE sobre su eje. Ocurre con IDENTIDAD FRAGMENTADA:
  contradicciones internas, roles conflictivos, doble vida.
  Visual: el piso rota, las ventanas giran en direcciones opuestas.

• "pandeo" — Pandeo de columnas
  Las columnas se DOBLAN bajo presión. Ocurre con PRESIÓN SIN SOPORTE:
  expectativas externas sin recursos internos, éxito sin fundamento.
  Visual: las paredes laterales se curvan hacia afuera.

• "none" — Sin falla significativa
  Piso estructuralmente sano.

═══════════════════════════════════════════════════════════════
CADENAS CAUSALES:
═══════════════════════════════════════════════════════════════

Identifica conexiones CAUSALES entre eventos de DIFERENTES pisos.
Por ejemplo:
- "Padre ausente" (Cimientos) → "Rebeldía y calle" (Piso 2)
  Strength: 0.8, "La búsqueda de pertenencia fuera del hogar es compensación directa por la ausencia paterna"
- "Abuso sexual" (Piso 1) → "Múltiples parejas" (Piso 3)
  Strength: 0.7, "Patrón de revictimización y búsqueda de validación a través del sexo"

═══════════════════════════════════════════════════════════════
PARÁMETROS VISUALES POR PISO:
═══════════════════════════════════════════════════════════════

Para cada piso, genera:
- widthFactor [0.3-1.0]: qué tan ancho es el piso (1.0 = base completa, 0.3 = muy estrecho)
  Más estrecho = menos estabilidad, menos recursos
- heightFactor [0.3-1.0]: qué tan alto es el piso (1.0 = altura completa, 0.3 = aplastado)
  Más bajo = más dañado, menos vitalidad
- tiltDeg [-5, 5]: inclinación del piso en grados
  Positivo = inclina a la derecha, negativo = a la izquierda
  Asentamiento = inclinación consistente; torsión = inclinación alternante
- inheritanceWeight [0-1]: cuánto hereda este piso del inferior
  0.9 = altamente dependiente del piso de abajo (eventos conectados)
  0.3 = relativamente independiente (nuevo capítulo de vida)

REGLAS DE CALIBRACIÓN:
- Un piso con padre ausente desde nacimiento NUNCA tiene widthFactor > 0.55
- Un piso con abuso sexual SIEMPRE tiene cortante y widthFactor < 0.50
- Pisos positivos genuinos pueden tener widthFactor > 0.75
- La inclinación se ACUMULA: si Cimientos tiene tilt -2°, el Piso 1 hereda parte
- Las cadenas causales deben conectar MÍNIMO los traumas más obvios
- El structuralIntegrity global refleja qué tan habitable es el edificio (0-100)

RESPONDE SIEMPRE en formato JSON con esta estructura exacta:
{
  "floors": [
    {
      "floorIndex": 0,
      "failureType": "asentamiento|cortante|flexion|torsion|pandeo|none",
      "widthFactor": 0.3-1.0,
      "heightFactor": 0.3-1.0,
      "tiltDeg": -5 to 5,
      "inheritanceWeight": 0-1,
      "narrative": "Diagnóstico del piso en 1-2 oraciones"
    }
  ],
  "causalChains": [
    {
      "fromEvent": "título del evento origen",
      "fromFloor": 0,
      "toEvent": "título del evento consecuencia",
      "toFloor": 2,
      "description": "Explicación de la conexión causal",
      "strength": 0.8
    }
  ],
  "overallDiagnosis": "Diagnóstico general del edificio (3-5 oraciones)",
  "structuralIntegrity": 0-100
}`;

export async function POST(req: NextRequest) {
  try {
    const { floors, birthDate } = await req.json();

    if (!floors || !birthDate) {
      return NextResponse.json(
        { error: "Pisos y fecha de nacimiento son requeridos" },
        { status: 400 }
      );
    }

    // Build the full context for the AI
    const floorsDescription = floors.map((f: {
      label: string;
      ageRange: string;
      events: { title: string; description: string | null; impact: number; impact_type: string; category: string; event_date: string }[];
      health: number;
      stability: number;
      damageGrade: string;
    }, i: number) => {
      const eventsDesc = f.events.length === 0
        ? "  (Sin eventos registrados)"
        : f.events.map((e) =>
            `  - "${e.title}" [${e.category}, ${e.impact_type} ${e.impact}/10, ${e.event_date}]${e.description ? ` — ${e.description}` : ""}`
          ).join("\n");

      return `PISO ${i} — ${f.label} (${f.ageRange})
  Health: ${f.health.toFixed(2)}, Stability: ${f.stability.toFixed(2)}, Damage: ${f.damageGrade}
  Eventos:
${eventsDesc}`;
    }).join("\n\n");

    const userMessage = `Analiza este edificio de vida y genera el dictamen estructural completo.

FECHA DE NACIMIENTO: ${birthDate}

${floorsDescription}

Responde SOLO con el JSON, sin markdown ni texto adicional.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.4,
      max_tokens: 3000,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json(
        { error: "No se recibió respuesta del agente" },
        { status: 500 }
      );
    }

    let parsed;
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { error: "Respuesta inválida del agente", raw: content },
        { status: 500 }
      );
    }

    // Validate and clamp values
    if (parsed.floors) {
      for (const f of parsed.floors) {
        f.widthFactor = Math.max(0.3, Math.min(1.0, f.widthFactor || 0.5));
        f.heightFactor = Math.max(0.3, Math.min(1.0, f.heightFactor || 0.5));
        f.tiltDeg = Math.max(-5, Math.min(5, f.tiltDeg || 0));
        f.inheritanceWeight = Math.max(0, Math.min(1, f.inheritanceWeight || 0.6));
        const validFailures = ["none", "asentamiento", "cortante", "flexion", "torsion", "pandeo"];
        if (!validFailures.includes(f.failureType)) f.failureType = "none";
      }
    }

    if (parsed.causalChains) {
      for (const c of parsed.causalChains) {
        c.strength = Math.max(0, Math.min(1, c.strength || 0.5));
      }
    }

    parsed.structuralIntegrity = Math.max(0, Math.min(100, Math.round(parsed.structuralIntegrity || 50)));
    parsed.analyzedAt = new Date().toISOString();

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Analyze building error:", error);
    return NextResponse.json(
      { error: "Error al analizar el edificio" },
      { status: 500 }
    );
  }
}
