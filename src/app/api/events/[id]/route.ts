import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await pool.query("DELETE FROM capas_events WHERE id = $1", [id]);
  return NextResponse.json({ success: true });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { title, description, event_date, category, impact, impact_type, reflection } =
    await req.json();

  const result = await pool.query(
    `UPDATE capas_events
     SET title = $1, description = $2, event_date = $3, category = $4, impact = $5, impact_type = $6, reflection = $7
     WHERE id = $8 RETURNING *`,
    [title, description, event_date, category, impact, impact_type, reflection || null, id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }

  return NextResponse.json(result.rows[0]);
}
