import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { floors } = await req.json();

    if (!floors || !Array.isArray(floors) || floors.length === 0) {
      return NextResponse.json({ error: "Floors data required" }, { status: 400 });
    }

    const nFloors = floors.length;
    const totalEvents = floors.reduce((s: number, f: { events: number }) => s + f.events, 0);

    // Build structural description per floor
    const floorDescs = floors.map((f: {
      label: string;
      stability: number;
      damageGrade: string;
      failureType: string;
      widthFactor: number;
      heightFactor: number;
      tiltDeg: number;
    }, i: number) => {
      const condition = f.stability > 0.3 ? "pristine, well-maintained"
        : f.stability > 0 ? "slightly worn, minor cracks"
        : f.stability > -0.3 ? "visible damage, peeling paint, cracks in facade"
        : "severely damaged, large cracks, broken windows, exposed concrete";

      const failureDesc: Record<string, string> = {
        none: "",
        asentamiento: "sinking on one side, uneven settlement",
        cortante: "diagonal shear cracks across the facade",
        flexion: "sagging floor line, bowing walls",
        torsion: "twisted floor, rotated windows",
        pandeo: "bulging exterior walls, buckling columns",
      };

      const failure = failureDesc[f.failureType] || "";
      const width = f.widthFactor < 0.6 ? "narrower than other floors" : f.widthFactor > 0.85 ? "full width" : "slightly narrower";
      const tilt = Math.abs(f.tiltDeg) > 1 ? `, tilted ${f.tiltDeg > 0 ? "right" : "left"} ${Math.abs(f.tiltDeg).toFixed(1)} degrees` : "";

      return `Floor ${i} (${f.label}): ${condition}${failure ? ", " + failure : ""}, ${width}${tilt}`;
    }).join(". ");

    // Calculate overall building character
    const avgStability = floors.reduce((s: number, f: { stability: number }) => s + f.stability, 0) / nFloors;
    const overallCondition = avgStability > 0.2 ? "relatively well-maintained residential building"
      : avgStability > -0.1 ? "aging building showing signs of wear"
      : "structurally compromised building with visible damage";

    const hasTilt = floors.some((f: { tiltDeg: number }) => Math.abs(f.tiltDeg) > 1);
    const tiltDesc = hasTilt ? " The building has a slight lean." : "";

    const prompt = `Photorealistic architectural photograph of a ${nFloors}-story ${overallCondition} in a Latin American city, shot from a 3/4 perspective angle showing the front and one side facade. The building is a concrete residential apartment building with ${nFloors} clearly visible floors.

Structural details per floor: ${floorDescs}.

The building has: concrete frame construction, rectangular windows with frames on each floor (3-4 windows per floor on the front face, 2-3 on the side), flat concrete roof with a low parapet, a main entrance door on the ground floor, exposed concrete slabs between floors visible at the edges, and a concrete foundation at the base.${tiltDesc}

Style: Golden hour natural lighting, urban context with a clear sky background. The photograph should look like a real building inspection photo. No text, no labels, no annotations. Realistic materials: painted concrete walls, aluminum window frames, concrete slabs. The ground should show a sidewalk and street.

Camera: Eye-level 3/4 perspective, slightly looking up, professional architectural photography.`;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1792",
      quality: "standard",
    });

    const imageUrl = response.data[0]?.url;
    if (!imageUrl) {
      return NextResponse.json({ error: "No image generated" }, { status: 500 });
    }

    return NextResponse.json({
      imageUrl,
      prompt: response.data[0]?.revised_prompt || prompt,
    });
  } catch (error) {
    console.error("Generate facade error:", error);
    return NextResponse.json(
      { error: "Error generating facade image" },
      { status: 500 }
    );
  }
}
