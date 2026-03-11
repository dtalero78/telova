import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// Ensure phone column exists (runs once)
let migrated = false;
async function ensurePhoneColumn() {
  if (migrated) return;
  try {
    await pool.query(
      "ALTER TABLE capas_users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)"
    );
    migrated = true;
  } catch {
    // ignore if column already exists
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensurePhoneColumn();
    const body = await req.json();

    // Login mode
    if (body.action === "login") {
      const { phone } = body;
      if (!phone) {
        return NextResponse.json({ error: "Celular requerido" }, { status: 400 });
      }
      const result = await pool.query(
        "SELECT * FROM capas_users WHERE phone = $1",
        [phone]
      );
      if (result.rows.length === 0) {
        return NextResponse.json({ error: "No encontramos una cuenta con ese celular" }, { status: 404 });
      }
      return NextResponse.json(result.rows[0]);
    }

    // Register mode
    const { name, birth_date, phone } = body;

    if (!name || !birth_date || !phone) {
      return NextResponse.json(
        { error: "name, birth_date y phone son requeridos" },
        { status: 400 }
      );
    }

    // Check if phone already exists
    const existing = await pool.query(
      "SELECT * FROM capas_users WHERE phone = $1",
      [phone]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con ese celular" },
        { status: 409 }
      );
    }

    const result = await pool.query(
      "INSERT INTO capas_users (name, birth_date, phone) VALUES ($1, $2, $3) RETURNING *",
      [name, birth_date, phone]
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
    await ensurePhoneColumn();
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
