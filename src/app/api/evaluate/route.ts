import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Eres un psicólogo estructural experto en desarrollo humano, teoría del apego (Bowlby), ACEs (Adverse Childhood Experiences), y psicología del desarrollo de Erikson.

Tu trabajo es evaluar eventos de vida que un usuario describe y determinar su impacto psicológico real basándote en evidencia científica.

CONTEXTO DE LA APP:
"Telova" visualiza la vida de una persona como un edificio. Cada piso es una etapa de vida:
- Cimientos (0-6 años): Apego, seguridad básica, confianza vs desconfianza
- Piso 1 (7-12 años): Industria vs inferioridad, socialización
- Piso 2 (13-17 años): Identidad vs confusión de roles
- Piso 3 (18-25 años): Intimidad vs aislamiento
- Piso 4 (26-35 años): Generatividad temprana, carrera, familia
- Piso 5 (36-50 años): Generatividad plena, legado
- Piso 6 (51-65 años): Integridad vs desesperación
- Ático (66+): Sabiduría, reflexión

CATEGORÍAS disponibles: familiar, sexual, laboral, económico, salud, social, espiritual, educativo

PRINCIPIOS DE EVALUACIÓN:

1. EVENTOS FUNDACIONALES (0-6 años):
   - La ausencia de un padre/madre es SIEMPRE un evento negativo de alto impacto (8-10), sin importar compensaciones
   - El abuso en esta etapa tiene impacto máximo (9-10) porque afecta el apego base
   - Según ACEs, cada experiencia adversa en la infancia tiene efectos acumulativos y multiplicativos

2. PESO CONTEXTUAL:
   - Un mismo evento tiene diferente impacto según la edad (divorcio a los 4 años ≠ divorcio a los 30)
   - Eventos que violan la confianza básica son más dañinos en etapas tempranas
   - La pérdida de un ser querido tiene impacto variable según el vínculo y la edad

3. NO CANCELACIÓN:
   - Los eventos positivos NO cancelan los negativos — mitigan, pero la cicatriz permanece
   - Una madre amorosa (positivo 8) NO neutraliza un padre ausente (negativo 9)
   - La resiliencia es real, pero no borra el trauma

4. IMPACTO REALISTA:
   - No inflar eventos menores: un cambio de colegio puede ser 3-5, no 8
   - No minimizar traumas reales: abuso sexual infantil es 10, siempre
   - Considerar el efecto cascada: algunos eventos cambian la trayectoria de vida entera

Debes responder SIEMPRE en formato JSON con esta estructura exacta:
{
  "category": "familiar|sexual|laboral|económico|salud|social|espiritual|educativo",
  "impact": 1-10,
  "impact_type": "positivo|negativo|neutro",
  "reasoning": "Explicación breve (2-3 oraciones) de por qué este impacto, basada en psicología real"
}`;

export async function POST(req: NextRequest) {
  try {
    const { title, description, eventDate, userBirthDate, existingEvents } = await req.json();

    if (!title || !eventDate) {
      return NextResponse.json(
        { error: "Título y fecha son requeridos" },
        { status: 400 }
      );
    }

    // Calculate age at event time
    const birth = new Date(userBirthDate);
    const eventD = new Date(eventDate);
    const ageAtEvent = Math.floor(
      (eventD.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    );

    // Build context about existing events for this floor
    let existingContext = "";
    if (existingEvents && existingEvents.length > 0) {
      existingContext = `\n\nEVENTOS EXISTENTES en la vida de esta persona:\n${existingEvents
        .map(
          (e: { title: string; impact_type: string; impact: number; category: string; event_date: string }) =>
            `- "${e.title}" (${e.impact_type}, impacto ${e.impact}/10, categoría: ${e.category}, fecha: ${e.event_date})`
        )
        .join("\n")}`;
    }

    const userMessage = `Evalúa este evento de vida:

TÍTULO: ${title}
DESCRIPCIÓN: ${description || "Sin descripción adicional"}
FECHA DEL EVENTO: ${eventDate}
EDAD DE LA PERSONA AL MOMENTO: ${ageAtEvent} años
${existingContext}

Responde SOLO con el JSON, sin markdown ni texto adicional.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 300,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json(
        { error: "No se recibió respuesta del agente" },
        { status: 500 }
      );
    }

    // Parse JSON response (handle potential markdown wrapping)
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

    // Validate the response
    const validCategories = [
      "familiar", "sexual", "laboral", "económico",
      "salud", "social", "espiritual", "educativo",
    ];
    const validTypes = ["positivo", "negativo", "neutro"];

    if (!validCategories.includes(parsed.category)) parsed.category = "familiar";
    if (!validTypes.includes(parsed.impact_type)) parsed.impact_type = "neutro";
    parsed.impact = Math.max(1, Math.min(10, Math.round(parsed.impact || 5)));

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Evaluate error:", error);
    return NextResponse.json(
      { error: "Error al evaluar el evento" },
      { status: 500 }
    );
  }
}
