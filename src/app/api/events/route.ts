import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: NextRequest) {
  const { user_id, title, description, event_date, category, impact, impact_type, reflection } =
    await req.json();

  if (!user_id || !title || !event_date || !category || !impact || !impact_type) {
    return NextResponse.json(
      { error: "Campos requeridos faltantes" },
      { status: 400 }
    );
  }

  const result = await pool.query(
    `INSERT INTO capas_events (user_id, title, description, event_date, category, impact, impact_type, reflection)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [user_id, title, description || null, event_date, category, impact, impact_type, reflection || null]
  );

  return NextResponse.json(result.rows[0]);
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("user_id");

  if (!userId) {
    return NextResponse.json(
      { error: "user_id es requerido" },
      { status: 400 }
    );
  }

  const result = await pool.query(
    "SELECT * FROM capas_events WHERE user_id = $1 ORDER BY event_date ASC",
    [userId]
  );

  return NextResponse.json(result.rows);
}
