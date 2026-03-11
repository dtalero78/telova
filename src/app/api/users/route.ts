import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { name, birth_date } = await req.json();

    if (!name || !birth_date) {
      return NextResponse.json(
        { error: "name y birth_date son requeridos" },
        { status: 400 }
      );
    }

    const result = await pool.query(
      "INSERT INTO capas_users (name, birth_date) VALUES ($1, $2) RETURNING *",
      [name, birth_date]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error: unknown) {
    console.error("POST /api/users error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("id");

    if (userId) {
      const result = await pool.query(
        "SELECT * FROM capas_users WHERE id = $1",
        [userId]
      );
      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: "Usuario no encontrado" },
          { status: 404 }
        );
      }
      return NextResponse.json(result.rows[0]);
    }

    const result = await pool.query(
      "SELECT * FROM capas_users ORDER BY created_at DESC"
    );
    return NextResponse.json(result.rows);
  } catch (error: unknown) {
    console.error("GET /api/users error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
