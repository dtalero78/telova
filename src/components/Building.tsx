"use client";

import { Floor, getCategoryColor, CapasEvent, DAMAGE_GRADES, BuildingAnalysis, FloorAnalysis, CausalChain } from "@/lib/types";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";

interface BuildingProps {
  floors: Floor[];
  onFloorClick: (floor: Floor) => void;
  aiAnalysis?: BuildingAnalysis | null;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * ARCHITECTURAL SECTION CUT — Subtle, clean line drawing
 *
 * Reference: Clean architectural sections with:
 * - Walls as thick-outlined rectangles with light gray fill
 * - Floor slabs as thin dark gray bands
 * - Individual stair treads (zigzag)
 * - Detailed but subtle furniture line drawings
 * - Overall LIGHT, CLEAN, SUBTLE aesthetic
 * ═══════════════════════════════════════════════════════════════════════════ */

const CFG = {
  svgW: 820,
  floorH: 130,
  floorW: 520,
  extWallT: 6,
  intWallT: 1,
  coreWallT: 4,
  slabT: 4,
  coreW: 50,
  foundationH: 45,
  footingExtra: 14,
  footingH: 12,
  minWidthFactor: 0.55,
  minHeightFactor: 0.55,
  maxTilt: 3.5,
};

// Drawing style — architectural section cut (black structural, like reference)
const S = {
  wallFill: "#333",            // structural walls: near-black
  wallStroke: "#222",          // wall outline
  wallStrokeW: 0.3,
  slabFill: "#333",            // slab fill
  slabStroke: "#222",
  slabStrokeW: 0.3,
  partStroke: "#444",          // partition walls: thin, dark
  thinLine: "#666",            // details
  thinLineW: 0.4,
  veryThin: "#999",            // very subtle
  veryThinW: 0.3,
  stairFill: "#333",           // stair section fill: same as walls
  stairStroke: "#222",
  stairStrokeW: 0.3,
  textColor: "#555",
  textLight: "#999",
};

/* ─── MATH ─────────────────────────────────────────────────────────────── */

function normalize(x: number): number {
  return Math.max(0, Math.min(1, (x + 1) / 2));
}

function wFactor(stability: number): number {
  return CFG.minWidthFactor + (1 - CFG.minWidthFactor) * normalize(stability);
}

function hFactor(health: number): number {
  return CFG.minHeightFactor + (1 - CFG.minHeightFactor) * normalize(health);
}

/* ─── TYPES ────────────────────────────────────────────────────────────── */

interface FloorVisual {
  floor: Floor;
  fi: number;
  wF: number;
  hF: number;
  instability: number;
  damage: number;
  floorW: number;
  floorH: number;
  failureType: string;
  floorTilt: number;
  ai?: FloorAnalysis;
}

function computeVisuals(
  visibleFloors: Floor[],
  aiAnalysis?: BuildingAnalysis | null
): FloorVisual[] {
  return visibleFloors.map((floor, fi) => {
    const ai = aiAnalysis?.floors?.find((f) => f.floorIndex === fi);
    const w = ai ? ai.widthFactor : wFactor(floor.stability);
    const h = ai ? ai.heightFactor : hFactor(floor.health);
    return {
      floor, fi, wF: w, hF: h,
      instability: Math.max(0, -floor.stability),
      damage: Math.max(0, -floor.health),
      floorW: CFG.floorW * w,
      floorH: CFG.floorH * h,
      failureType: ai?.failureType || "none",
      floorTilt: ai?.tiltDeg || 0,
      ai,
    };
  });
}

/* ─── CRACKS — Patrones reales según tipo de falla ─────────────────────── */

/** Pseudo-random determinista basado en seed */
function seededRand(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s & 0x7fffffff) / 2147483647; };
}

/** Genera un path de grieta irregular (zigzag) entre dos puntos */
function crackPath(
  x0: number, y0: number, x1: number, y1: number,
  jitter: number, segs: number, rand: () => number,
): string {
  let p = `M ${x0.toFixed(1)} ${y0.toFixed(1)}`;
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const bx = x0 + (x1 - x0) * t;
    const by = y0 + (y1 - y0) * t;
    // Perpendicular jitter
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const j = (rand() - 0.5) * 2 * jitter;
    const fx = bx + nx * j;
    const fy = by + ny * j;
    p += ` L ${fx.toFixed(1)} ${fy.toFixed(1)}`;
  }
  return p;
}

function genCracks(
  fi: number, inst: number, w: number, h: number, failureType: string,
): string[] {
  if (inst <= 0.1) return [];
  const paths: string[] = [];
  const rand = seededRand(fi * 137 + 42);
  const n = Math.min(6, Math.floor(inst * 5) + 1);
  const jit = 3 + inst * 5; // jitter increases with instability
  const segs = 4 + Math.floor(inst * 4);

  switch (failureType) {
    case "cortante": {
      // Diagonal cracks at ~45° on walls — classic shear pattern
      for (let i = 0; i < n; i++) {
        const side = i % 2 === 0; // alternate left/right wall zone
        const baseX = side ? w * 0.02 + rand() * w * 0.15 : w * 0.83 + rand() * w * 0.15;
        const startY = rand() * h * 0.3;
        const endX = baseX + (side ? 1 : -1) * (w * 0.12 + rand() * w * 0.08);
        const endY = startY + h * 0.4 + rand() * h * 0.3;
        paths.push(crackPath(baseX, startY, endX, endY, jit, segs, rand));
      }
      break;
    }
    case "flexion": {
      // Horizontal cracks near mid-height — bending/bowing
      for (let i = 0; i < n; i++) {
        const cy = h * 0.35 + rand() * h * 0.3;
        const startX = w * 0.05 + rand() * w * 0.1;
        const endX = startX + w * 0.15 + rand() * w * 0.15;
        paths.push(crackPath(startX, cy, endX, cy + (rand() - 0.5) * 6, jit * 0.7, segs, rand));
        // Mirror on right side
        const rx = w - startX;
        const rex = w - endX;
        paths.push(crackPath(rx, cy, rex, cy + (rand() - 0.5) * 6, jit * 0.7, segs, rand));
      }
      break;
    }
    case "asentamiento": {
      // Cracks radiating upward from base — differential settlement
      for (let i = 0; i < n; i++) {
        const baseX = w * 0.15 + rand() * w * 0.7;
        const baseY = h; // start from bottom
        const angle = -Math.PI / 2 + (rand() - 0.5) * 1.2; // fan upward
        const length = h * 0.3 + rand() * h * 0.4;
        const endX = baseX + Math.cos(angle) * length * 0.4;
        const endY = baseY + Math.sin(angle) * length;
        paths.push(crackPath(baseX, baseY, endX, endY, jit, segs, rand));
      }
      break;
    }
    case "torsion": {
      // Crossed diagonal cracks — twisting pattern
      const half = Math.ceil(n / 2);
      for (let i = 0; i < half; i++) {
        const sx = w * 0.1 + rand() * w * 0.3;
        const sy = rand() * h * 0.3;
        paths.push(crackPath(sx, sy, sx + w * 0.2, sy + h * 0.5 + rand() * h * 0.2, jit, segs, rand));
      }
      for (let i = 0; i < half; i++) {
        const sx = w * 0.6 + rand() * w * 0.3;
        const sy = rand() * h * 0.3;
        paths.push(crackPath(sx, sy, sx - w * 0.2, sy + h * 0.5 + rand() * h * 0.2, jit, segs, rand));
      }
      break;
    }
    case "pandeo": {
      // Vertical cracks with outward bow — buckling columns
      for (let i = 0; i < n; i++) {
        const cx = w * 0.1 + rand() * w * 0.8;
        const startY = h * 0.05 + rand() * h * 0.1;
        const endY = h * 0.7 + rand() * h * 0.25;
        const midY = (startY + endY) / 2;
        const bow = (rand() - 0.5) * w * 0.06;
        let p = `M ${cx.toFixed(1)} ${startY.toFixed(1)}`;
        p += ` Q ${(cx + bow).toFixed(1)} ${midY.toFixed(1)} ${cx.toFixed(1)} ${endY.toFixed(1)}`;
        paths.push(p);
      }
      break;
    }
    default: {
      // Generic random cracks for unknown/none with some instability
      for (let i = 0; i < n; i++) {
        const sx = w * 0.1 + rand() * w * 0.8;
        const sy = i % 2 === 0 ? 0 : h;
        const dir = i % 2 === 0 ? 1 : -1;
        const endX = sx + (rand() - 0.5) * w * 0.2;
        const endY = sy + dir * (h * 0.2 + rand() * h * 0.3);
        paths.push(crackPath(sx, sy, endX, endY, jit, segs, rand));
      }
    }
  }
  return paths;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * DRAWING ELEMENTS
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Staircase — two half-width flights, base at center of core */
function StairCase({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const halfW = w / 2;
  const halfH = h / 2;
  const n = 8;
  const treadW = halfW / n;
  const treadH = halfH / n;
  const stroke = S.stairStroke;
  const sw = S.stairStrokeW;

  // Flight 1 (left half, bottom): base at center, zigzag up to the left
  // Starts at bottom-center, goes up-left to mid-landing at top-left
  let f1 = `M ${x + halfW} ${y + h}`;
  for (let i = 0; i < n; i++) {
    const tx = x + halfW - i * treadW;
    const ty = y + h - i * treadH;
    f1 += ` L ${tx} ${ty - treadH}`; // riser ↑
    f1 += ` L ${tx - treadW} ${ty - treadH}`; // tread ←
  }

  // Flight 2 (right half, top): base at center, zigzag up to the right
  // Starts at mid-center, goes up-right to top-right
  let f2 = `M ${x + halfW} ${y + halfH}`;
  for (let i = 0; i < n; i++) {
    const tx = x + halfW + i * treadW;
    const ty = y + halfH - i * treadH;
    f2 += ` L ${tx} ${ty - treadH}`; // riser ↑
    f2 += ` L ${tx + treadW} ${ty - treadH}`; // tread →
  }

  return (
    <g>
      <path d={f1} fill="none" stroke={stroke} strokeWidth={sw} />
      <path d={f2} fill="none" stroke={stroke} strokeWidth={sw} />
      {/* Mid-landing */}
      <line x1={x} y1={y + halfH} x2={x + w} y2={y + halfH}
        stroke={stroke} strokeWidth={sw} />
    </g>
  );
}

/** Door — thin line with swing arc */
function Door({ x, y, doorH, flip }: { x: number; y: number; doorH: number; flip?: boolean }) {
  const dw = doorH * 0.65;
  const dir = flip ? -1 : 1;
  return (
    <g>
      {/* Door opening (gap in wall) */}
      <line x1={x} y1={y} x2={x} y2={y - doorH}
        stroke={S.thinLine} strokeWidth={S.thinLineW} />
      {/* Swing arc */}
      <path
        d={`M ${x} ${y - doorH} A ${dw} ${dw} 0 0 ${flip ? 0 : 1} ${x + dir * dw} ${y}`}
        fill="none" stroke={S.thinLine} strokeWidth={S.thinLineW}
        strokeDasharray="3 2" />
    </g>
  );
}


/** Event dot inside a room — colored circle with hover tooltip */
function EventDot({
  event, cx, cy, r, onHoverEvent, onLeaveEvent, isHovered,
}: {
  event: CapasEvent; cx: number; cy: number; r: number;
  onHoverEvent: (ev: CapasEvent, x: number, y: number) => void;
  onLeaveEvent: () => void;
  isHovered: boolean;
}) {
  const color = getCategoryColor(event.category);
  const isNeg = event.impact_type === "negativo";
  const isPos = event.impact_type === "positivo";
  const hitR = Math.max(r, 5); // min hit area for small dots
  const sw = Math.max(0.4, r * 0.2); // stroke scales with size
  return (
    <g
      className="cursor-pointer"
      onMouseEnter={() => onHoverEvent(event, cx, cy)}
      onMouseLeave={onLeaveEvent}
    >
      <title>{event.title}</title>
      {/* Invisible hit area */}
      <circle cx={cx} cy={cy} r={hitR} fill="transparent" />
      {/* Outer glow on hover */}
      {isHovered && (
        <circle cx={cx} cy={cy} r={r + 3} fill={color} opacity={0.2} />
      )}
      {/* Main dot */}
      <circle cx={cx} cy={cy} r={r} fill={color} opacity={0.85}
        stroke={isHovered ? "#333" : "white"} strokeWidth={isHovered ? 0.8 : sw} />
      {/* Negative: small X mark (only if dot big enough) */}
      {isNeg && r >= 2.5 && (
        <>
          <line x1={cx - r * 0.35} y1={cy - r * 0.35} x2={cx + r * 0.35} y2={cy + r * 0.35}
            stroke="white" strokeWidth={sw} />
          <line x1={cx + r * 0.35} y1={cy - r * 0.35} x2={cx - r * 0.35} y2={cy + r * 0.35}
            stroke="white" strokeWidth={sw} />
        </>
      )}
      {/* Positive: small + mark (only if dot big enough) */}
      {isPos && r >= 2.5 && (
        <>
          <line x1={cx} y1={cy - r * 0.4} x2={cx} y2={cy + r * 0.4}
            stroke="white" strokeWidth={sw} />
          <line x1={cx - r * 0.4} y1={cy} x2={cx + r * 0.4} y2={cy}
            stroke="white" strokeWidth={sw} />
        </>
      )}
    </g>
  );
}

/** Group events by category */
function groupByCategory(events: CapasEvent[]): { category: string; color: string; events: CapasEvent[] }[] {
  const map = new Map<string, CapasEvent[]>();
  for (const ev of events) {
    const list = map.get(ev.category) || [];
    list.push(ev);
    map.set(ev.category, list);
  }
  return Array.from(map.entries()).map(([cat, evs]) => ({
    category: cat,
    color: getCategoryColor(evs[0].category),
    events: evs,
  }));
}

/** Layout event dots inside a single apartment/room — auto-scales to fit any count */
function ApartmentEvents({
  events, x, y, w, h, color,
  onHoverEvent, onLeaveEvent, hoveredEventId,
}: {
  events: CapasEvent[];
  x: number; y: number; w: number; h: number; color: string;
  onHoverEvent: (ev: CapasEvent, x: number, y: number) => void;
  onLeaveEvent: () => void;
  hoveredEventId: string | null;
}) {
  const pad = 4;
  const labelH = 10;
  const areaW = w - pad * 2;
  const areaH = h - pad - labelH - 2;
  const count = events.length;

  // Find optimal grid: pick cols that best fills the area without overlap
  // Try different column counts and pick the one that maximizes dot size
  let bestR = 1;
  let bestCols = 1;
  for (let c = 1; c <= count; c++) {
    const r = Math.ceil(count / c);
    const rByW = areaW / (c * 2.3);
    const rByH = areaH / (r * 2.3);
    const radius = Math.min(rByW, rByH);
    if (radius >= bestR) { bestR = radius; bestCols = c; }
  }

  const dotR = Math.min(5, Math.max(1.5, bestR));
  const cols = bestCols;
  const rows = Math.ceil(count / cols);
  const cellW = areaW / cols;
  const cellH = areaH / Math.max(rows, 1);

  return (
    <g>
      {events.map((ev, ei) => {
        const col = ei % cols;
        const row = Math.floor(ei / cols);
        const cx = x + pad + col * cellW + cellW / 2;
        const cy = y + labelH + 2 + row * cellH + cellH / 2;
        return (
          <EventDot
            key={ev.id}
            event={ev}
            cx={cx} cy={cy} r={dotR}
            onHoverEvent={onHoverEvent}
            onLeaveEvent={onLeaveEvent}
            isHovered={hoveredEventId === ev.id}
          />
        );
      })}
    </g>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * FLOOR SECTION — One story of the building
 * ═══════════════════════════════════════════════════════════════════════════ */

function FloorSection({
  v, x, y, isHovered, onClick, onHover, onLeave,
  onHoverEvent, onLeaveEvent, hoveredEventId,
}: {
  v: FloorVisual;
  x: number; y: number;
  isHovered: boolean;
  onClick: () => void;
  onHover: () => void;
  onLeave: () => void;
  onHoverEvent: (ev: CapasEvent, x: number, y: number) => void;
  onLeaveEvent: () => void;
  hoveredEventId: string | null;
}) {
  const { floorW, floorH, fi } = v;
  const ewt = CFG.extWallT;
  const cwt = CFG.coreWallT;
  const coreW = CFG.coreW;
  const slabT = CFG.slabT;
  const clearH = floorH - slabT;

  // Core centered
  const coreX = x + floorW / 2 - coreW / 2;

  // Usable zones (left and right of core)
  const leftX = x + ewt;
  const leftW = coreX - cwt - leftX;
  const rightX = coreX + coreW + cwt;
  const rightW = x + floorW - ewt - rightX;

  // Group events by category → apartments
  const apartments = groupByCategory(v.floor.events);
  const numApts = apartments.length;
  const intW = CFG.intWallT;

  // Two zones: left and right of core
  // Split apartments across both zones, filling left first
  // Total wall space used by partitions
  const totalPartitions = Math.max(0, numApts - 1) * intW;
  const totalUsable = leftW + rightW - totalPartitions;

  // Proportional widths based on event count
  const totalEvents = v.floor.events.length || 1;
  const aptPositions: { x: number; w: number }[] = [];

  // Determine how many apartments fit on left side
  // Strategy: fill left proportionally, then right
  let leftBudget = leftW;
  let rightBudget = rightW;
  const aptSizes = apartments.map(a => a.events.length / totalEvents);

  // First pass: assign to left or right zone
  type ZoneAssign = { zone: "left" | "right"; frac: number };
  const assignments: ZoneAssign[] = [];
  let leftUsed = 0;

  for (let ai = 0; ai < numApts; ai++) {
    const frac = aptSizes[ai];
    const idealW = frac * totalUsable;
    const wallCost = (ai > 0 && assignments[ai - 1]?.zone === "left") ? intW : 0;

    if (leftUsed + idealW + wallCost <= leftBudget + 2) {
      assignments.push({ zone: "left", frac });
      leftUsed += idealW + wallCost;
    } else {
      assignments.push({ zone: "right", frac });
    }
  }

  // Compute actual widths within each zone
  const leftApts = assignments.map((a, i) => ({ ...a, idx: i })).filter(a => a.zone === "left");
  const rightApts = assignments.map((a, i) => ({ ...a, idx: i })).filter(a => a.zone === "right");

  const leftTotalFrac = leftApts.reduce((s, a) => s + a.frac, 0) || 1;
  const rightTotalFrac = rightApts.reduce((s, a) => s + a.frac, 0) || 1;
  const leftAvail = leftW - Math.max(0, leftApts.length - 1) * intW;
  const rightAvail = rightW - Math.max(0, rightApts.length - 1) * intW;

  // Position left-zone apartments
  let cursor = leftX;
  for (let li = 0; li < leftApts.length; li++) {
    const a = leftApts[li];
    const w = Math.max(30, (a.frac / leftTotalFrac) * leftAvail);
    aptPositions[a.idx] = { x: cursor, w };
    cursor += w + intW;
  }

  // Position right-zone apartments
  cursor = rightX;
  for (let ri = 0; ri < rightApts.length; ri++) {
    const a = rightApts[ri];
    const w = Math.max(30, (a.frac / rightTotalFrac) * rightAvail);
    aptPositions[a.idx] = { x: cursor, w };
    cursor += w + intW;
  }

  const cracks = genCracks(fi, v.instability, floorW, clearH, v.failureType);

  return (
    <g
      className="cursor-pointer"
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {/* ── FLOOR SLAB at bottom ── */}
      <rect x={x} y={y + clearH} width={floorW} height={slabT}
        fill={S.slabFill} stroke={S.slabStroke} strokeWidth={S.slabStrokeW} />

      {/* ── EXTERIOR WALLS with large windows ── */}
      {/* Left wall - bottom sill */}
      <rect x={x} y={y + clearH * 0.75} width={ewt} height={clearH * 0.25}
        fill={S.wallFill} stroke={S.wallStroke} strokeWidth={S.wallStrokeW} />
      {/* Left wall - top lintel */}
      <rect x={x} y={y} width={ewt} height={clearH * 0.15}
        fill={S.wallFill} stroke={S.wallStroke} strokeWidth={S.wallStrokeW} />
      {/* Left wall window */}
      <rect x={x} y={y + clearH * 0.15} width={ewt} height={clearH * 0.6}
        fill="white" stroke={S.wallStroke} strokeWidth={S.wallStrokeW * 0.6} />
      {/* Left window mullion (horizontal) */}
      <line x1={x} y1={y + clearH * 0.45} x2={x + ewt} y2={y + clearH * 0.45}
        stroke={S.veryThin} strokeWidth={S.veryThinW} />
      {/* Left window mullion (vertical) */}
      <line x1={x + ewt / 2} y1={y + clearH * 0.15} x2={x + ewt / 2} y2={y + clearH * 0.75}
        stroke={S.veryThin} strokeWidth={S.veryThinW} />

      {/* Right wall - bottom sill */}
      <rect x={x + floorW - ewt} y={y + clearH * 0.75} width={ewt} height={clearH * 0.25}
        fill={S.wallFill} stroke={S.wallStroke} strokeWidth={S.wallStrokeW} />
      {/* Right wall - top lintel */}
      <rect x={x + floorW - ewt} y={y} width={ewt} height={clearH * 0.15}
        fill={S.wallFill} stroke={S.wallStroke} strokeWidth={S.wallStrokeW} />
      {/* Right wall window */}
      <rect x={x + floorW - ewt} y={y + clearH * 0.15} width={ewt} height={clearH * 0.6}
        fill="white" stroke={S.wallStroke} strokeWidth={S.wallStrokeW * 0.6} />
      {/* Right window mullion (horizontal) */}
      <line x1={x + floorW - ewt} y1={y + clearH * 0.45} x2={x + floorW} y2={y + clearH * 0.45}
        stroke={S.veryThin} strokeWidth={S.veryThinW} />
      {/* Right window mullion (vertical) */}
      <line x1={x + floorW - ewt / 2} y1={y + clearH * 0.15} x2={x + floorW - ewt / 2} y2={y + clearH * 0.75}
        stroke={S.veryThin} strokeWidth={S.veryThinW} />

      {/* ── CORE WALLS ── */}
      <rect x={coreX - cwt} y={y} width={cwt} height={clearH}
        fill={S.wallFill} stroke={S.wallStroke} strokeWidth={S.wallStrokeW} />
      <rect x={coreX + coreW} y={y} width={cwt} height={clearH}
        fill={S.wallFill} stroke={S.wallStroke} strokeWidth={S.wallStrokeW} />

      {/* ── STAIRS in core ── */}
      <StairCase x={coreX} y={y} w={coreW} h={clearH} />

      {/* ── APARTMENTS (category rooms) ── */}
      {apartments.map((apt, ai) => {
        const pos = aptPositions[ai];
        if (!pos) return null;
        const isLast = ai === numApts - 1;

        return (
          <g key={apt.category}>
            {/* Partition wall (thin line between apartments) */}
            {!isLast && (
              <line
                x1={pos.x + pos.w + intW / 2} y1={y + clearH * 0.12}
                x2={pos.x + pos.w + intW / 2} y2={y + clearH}
                stroke={S.partStroke} strokeWidth={intW} />
            )}

            {/* Category label at top of room */}
            <text
              x={pos.x + pos.w / 2} y={y + 10}
              fill={apt.color} fontSize={7} fontWeight="600"
              fontFamily="'Helvetica Neue', Arial, sans-serif"
              textAnchor="middle" opacity={0.7}>
              {apt.category.toUpperCase()}
            </text>

            {/* Subtle color tint on floor */}
            <rect x={pos.x} y={y + clearH - 3} width={pos.w} height={3}
              fill={apt.color} opacity={0.2} />

            {/* Event dots */}
            <ApartmentEvents
              events={apt.events}
              x={pos.x} y={y} w={pos.w} h={clearH}
              color={apt.color}
              onHoverEvent={onHoverEvent}
              onLeaveEvent={onLeaveEvent}
              hoveredEventId={hoveredEventId}
            />
          </g>
        );
      })}

      {/* ── DAMAGE CRACKS (clipped to exclude core/stair area) ── */}
      <defs>
        <clipPath id={`crack-clip-${fi}`}>
          <rect x={x} y={y} width={coreX - cwt - x} height={clearH} />
          <rect x={coreX + coreW + cwt} y={y} width={x + floorW - coreX - coreW - cwt} height={clearH} />
        </clipPath>
      </defs>
      <g clipPath={`url(#crack-clip-${fi})`}>
        {cracks.map((path, ci) => (
          <g key={`c${ci}`} transform={`translate(${x}, ${y})`}>
            <path d={path} fill="none" stroke="#999"
              strokeWidth={0.6 + v.instability * 0.5}
              opacity={0.3 + v.instability * 0.3} />
          </g>
        ))}
      </g>

      {/* ── HOVER ── */}
      {isHovered && (
        <rect x={x - 1} y={y - 1} width={floorW + 2} height={floorH + 2}
          fill="none" stroke="#3498DB" strokeWidth={1.8} opacity={0.6} />
      )}
    </g>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * FACADE VIEW — Front elevation of the building
 * ═══════════════════════════════════════════════════════════════════════════ */

interface FacadeViewProps {
  visuals: FloorVisual[];
  positions: { x: number; y: number }[];
  maxW: number;
  margin: { top: number; bottom: number; left: number; right: number };
  svgW: number;
  svgH: number;
  groundY: number;
  baseX: number;
  baseW: number;
  centerX: number;
  tilt: number;
  hoveredFloor: number | null;
  onFloorHover: (fi: number) => void;
  onFloorLeave: () => void;
  onFloorClick: (floor: Floor) => void;
}

function FacadeView({
  visuals, positions, maxW, margin, svgW, svgH, groundY,
  baseX, baseW, centerX, tilt,
  hoveredFloor, onFloorHover, onFloorLeave, onFloorClick,
}: FacadeViewProps) {
  const ewt = CFG.extWallT;

  // Facade uses full building width (baseW) for all floors to show exterior
  const facadeW = baseW;
  const facadeX = baseX;

  // Window grid params
  const winH = 28;
  const winW = 16;
  const winGap = 8;

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="w-full"
      style={{ minHeight: "85vh", background: "white" }}
      preserveAspectRatio="xMidYMid meet"
    >
      <rect width={svgW} height={svgH} fill="white" />

      {/* Ground */}
      <line x1={0} y1={groundY} x2={svgW} y2={groundY}
        stroke={S.wallStroke} strokeWidth={2} />
      <rect x={0} y={groundY} width={svgW} height={CFG.foundationH + CFG.footingH + margin.bottom}
        fill="#F5F5F0" />

      {/* Tilt transform */}
      <g transform={`rotate(${tilt}, ${centerX}, ${groundY})`}>

        {/* Foundation */}
        <rect x={facadeX - CFG.footingExtra / 2} y={groundY - CFG.foundationH}
          width={facadeW + CFG.footingExtra} height={CFG.foundationH}
          fill={S.wallFill} stroke={S.wallStroke} strokeWidth={S.wallStrokeW} />

        {/* Floors — bottom up */}
        {visuals.map((v, i) => {
          const pos = positions[i];
          if (!pos) return null;
          const clearH = v.floorH - CFG.slabT;
          const floorY = pos.y;
          const isHovered = hoveredFloor === v.fi;

          // How many windows fit
          const innerW = facadeW - ewt * 2;
          const nWins = Math.max(1, Math.floor((innerW + winGap) / (winW + winGap)));
          const totalWinW = nWins * winW + (nWins - 1) * winGap;
          const winStartX = facadeX + ewt + (innerW - totalWinW) / 2;
          const winY = floorY + (clearH - winH) / 2;

          // Floor color tint based on stability
          const stabilityColor = v.floor.stability > 0.3 ? "rgba(46,204,113,0.06)"
            : v.floor.stability > 0 ? "rgba(241,196,15,0.06)"
            : v.floor.stability > -0.3 ? "rgba(230,126,34,0.06)"
            : "rgba(231,76,60,0.06)";

          return (
            <g key={`facade-floor-${v.fi}`}
              className="cursor-pointer"
              onClick={() => onFloorClick(v.floor)}
              onMouseEnter={() => onFloorHover(v.fi)}
              onMouseLeave={onFloorLeave}
              opacity={isHovered ? 1 : 0.92}
            >
              {/* Floor slab (top of this floor) */}
              <rect x={facadeX} y={floorY + clearH}
                width={facadeW} height={CFG.slabT}
                fill={S.slabFill} stroke={S.slabStroke} strokeWidth={S.slabStrokeW} />

              {/* Facade wall background */}
              <rect x={facadeX} y={floorY} width={facadeW} height={clearH}
                fill={stabilityColor} />

              {/* Left exterior wall */}
              <rect x={facadeX} y={floorY} width={ewt} height={clearH}
                fill={S.wallFill} stroke={S.wallStroke} strokeWidth={S.wallStrokeW} />

              {/* Right exterior wall */}
              <rect x={facadeX + facadeW - ewt} y={floorY} width={ewt} height={clearH}
                fill={S.wallFill} stroke={S.wallStroke} strokeWidth={S.wallStrokeW} />

              {/* Windows */}
              {Array.from({ length: nWins }).map((_, wi) => {
                const wx = winStartX + wi * (winW + winGap);
                // Ground floor: make middle window(s) a door
                const isDoor = i === 0 && wi === Math.floor(nWins / 2);
                const wh = isDoor ? clearH - 4 : winH;
                const wy = isDoor ? floorY + clearH - wh : winY;
                return (
                  <g key={wi}>
                    <rect x={wx} y={wy} width={winW} height={wh}
                      fill="white" stroke={S.wallStroke} strokeWidth={0.6} />
                    {/* Window mullions */}
                    {!isDoor && (
                      <>
                        <line x1={wx + winW / 2} y1={wy} x2={wx + winW / 2} y2={wy + wh}
                          stroke={S.thinLine} strokeWidth={0.3} />
                        <line x1={wx} y1={wy + wh / 2} x2={wx + winW} y2={wy + wh / 2}
                          stroke={S.thinLine} strokeWidth={0.3} />
                      </>
                    )}
                    {/* Door lintel */}
                    {isDoor && (
                      <line x1={wx} y1={wy} x2={wx + winW} y2={wy}
                        stroke={S.wallStroke} strokeWidth={1} />
                    )}
                  </g>
                );
              })}

              {/* Hover highlight */}
              {isHovered && (
                <rect x={facadeX} y={floorY} width={facadeW} height={v.floorH}
                  fill="rgba(0,0,0,0.04)" />
              )}
            </g>
          );
        })}

        {/* Roof slab */}
        {positions.length > 0 && (() => {
          const topPos = positions[positions.length - 1];
          if (!topPos) return null;
          return (
            <rect x={facadeX - 3} y={topPos.y - CFG.slabT}
              width={facadeW + 6} height={CFG.slabT + 2}
              fill={S.slabFill} stroke={S.slabStroke} strokeWidth={0.5} />
          );
        })()}

        {/* Roof parapet */}
        {positions.length > 0 && (() => {
          const topPos = positions[positions.length - 1];
          if (!topPos) return null;
          const parapetH = 8;
          return (
            <g>
              <rect x={facadeX} y={topPos.y - CFG.slabT - parapetH}
                width={ewt} height={parapetH}
                fill={S.wallFill} stroke={S.wallStroke} strokeWidth={S.wallStrokeW} />
              <rect x={facadeX + facadeW - ewt} y={topPos.y - CFG.slabT - parapetH}
                width={ewt} height={parapetH}
                fill={S.wallFill} stroke={S.wallStroke} strokeWidth={S.wallStrokeW} />
              <line x1={facadeX} y1={topPos.y - CFG.slabT - parapetH}
                x2={facadeX + facadeW} y2={topPos.y - CFG.slabT - parapetH}
                stroke={S.wallStroke} strokeWidth={0.8} />
            </g>
          );
        })()}
      </g>

      {/* Floor labels — right side */}
      {visuals.map((v, i) => {
        const pos = positions[i];
        if (!pos) return null;
        const ly = pos.y + v.floorH / 2;
        const lx = facadeX + facadeW + 25;
        return (
          <g key={`flbl${v.fi}`} opacity={hoveredFloor === v.fi ? 1 : 0.55}>
            <line x1={facadeX + facadeW + 2} y1={ly}
              x2={lx - 5} y2={ly}
              stroke="#CCC" strokeWidth={0.4} strokeDasharray="2 2" />
            <text x={lx} y={ly - 3} fill={S.textColor} fontSize={11} fontWeight="600"
              fontFamily="'Helvetica Neue', Arial, sans-serif">
              {v.floor.label}
            </text>
            <text x={lx} y={ly + 10} fill={S.textLight} fontSize={8}
              fontFamily="'Helvetica Neue', Arial, sans-serif">
              {v.floor.ageRange} · {v.floor.events.length} ev.
            </text>
          </g>
        );
      })}

      {/* Title block */}
      <g>
        <rect x={svgW - 220} y={svgH - 55} width={210} height={45}
          fill="white" stroke={S.wallStroke} strokeWidth={1.2} />
        <line x1={svgW - 220} y1={svgH - 40} x2={svgW - 10} y2={svgH - 40}
          stroke={S.wallStroke} strokeWidth={0.6} />
        <text x={svgW - 115} y={svgH - 43} fill={S.textColor} fontSize={9}
          fontFamily="'Helvetica Neue', Arial, sans-serif" textAnchor="middle" fontWeight="bold"
          letterSpacing={1}>
          CAPAS — FACHADA PRINCIPAL
        </text>
        <text x={svgW - 215} y={svgH - 28} fill={S.textLight} fontSize={7}
          fontFamily="monospace">
          Edificio de Vida · {visuals.length} pisos
        </text>
        <text x={svgW - 215} y={svgH - 17} fill={S.textLight} fontSize={7}
          fontFamily="monospace">
          Esc. 1:100 · {new Date().toLocaleDateString()}
        </text>
      </g>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * MAIN COMPONENT
 * ═══════════════════════════════════════════════════════════════════════════ */

export default function Building({ floors, onFloorClick, aiAnalysis }: BuildingProps) {
  const [viewMode, setViewMode] = useState<"section" | "facade">("section");
  const [facadeImage, setFacadeImage] = useState<string | null>(null);
  const [facadeLoading, setFacadeLoading] = useState(false);
  const [facadeError, setFacadeError] = useState<string | null>(null);
  const [hoveredFloor, setHoveredFloor] = useState<number | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<{ event: CapasEvent; x: number; y: number } | null>(null);
  const [hoveredAnnotation, setHoveredAnnotation] = useState<{
    x: number; y: number; title: string; description: string; color: string;
  } | null>(null);

  const handleHoverEvent = useCallback((ev: CapasEvent, x: number, y: number) => {
    setHoveredEvent({ event: ev, x, y });
  }, []);

  const handleLeaveEvent = useCallback(() => {
    setHoveredEvent(null);
  }, []);

  const visibleFloors = floors.filter(
    (f) => f.events.length > 0 || f.label === "Cimientos"
  );

  const visuals = useMemo(
    () => computeVisuals(visibleFloors, aiAnalysis),
    [visibleFloors, aiAnalysis]
  );

  // Tilt
  let cumTilt = 0;
  for (const v of visuals) {
    cumTilt += aiAnalysis ? Math.abs(v.floorTilt) * 0.3 : v.instability * CFG.maxTilt * 0.3;
  }
  const tilt = Math.min(cumTilt, CFG.maxTilt);

  // Generate facade image with DALL-E
  const generateFacade = useCallback(async () => {
    setFacadeLoading(true);
    setFacadeError(null);
    try {
      const floorsData = visuals.map(v => ({
        label: v.floor.label,
        stability: v.floor.stability,
        damageGrade: v.floor.damageGrade,
        failureType: v.failureType,
        widthFactor: v.wF,
        heightFactor: v.hF,
        tiltDeg: v.floorTilt,
        events: v.floor.events.length,
      }));
      const res = await fetch("/api/generate-facade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ floors: floorsData }),
      });
      if (!res.ok) throw new Error("Error generating image");
      const data = await res.json();
      setFacadeImage(data.imageUrl);
    } catch (err) {
      setFacadeError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setFacadeLoading(false);
    }
  }, [visuals]);

  // Dimensions
  const totalH = visuals.reduce((s, v) => s + v.floorH, 0);
  const maxW = Math.max(...visuals.map(v => v.floorW), CFG.floorW * 0.5);
  const margin = { top: 50, bottom: 80, left: 70, right: 170 };
  const svgW = margin.left + maxW + margin.right;
  const svgH = margin.top + totalH + CFG.foundationH + CFG.footingH + margin.bottom;
  const groundY = margin.top + totalH + CFG.foundationH;

  // Floor positions (bottom up)
  const positions: { x: number; y: number }[] = [];
  let cy = groundY - CFG.foundationH;
  for (let i = 0; i < visuals.length; i++) {
    cy -= visuals[i].floorH;
    positions.push({ x: margin.left + (maxW - visuals[i].floorW) / 2, y: cy });
  }

  const centerX = margin.left + maxW / 2;
  const baseW = visuals[0]?.floorW ?? CFG.floorW * 0.5;
  const baseX = margin.left + (maxW - baseW) / 2;

  // ── Zoom & Pan ──
  const svgRef = useRef<SVGSVGElement>(null);
  const [vb, setVb] = useState({ x: 0, y: 0, w: svgW, h: svgH });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, vbX: 0, vbY: 0 });
  const [zoom, setZoom] = useState(1);

  // Reset viewBox when SVG dimensions change
  useEffect(() => {
    setVb({ x: 0, y: 0, w: svgW, h: svgH });
    setZoom(1);
  }, [svgW, svgH]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    // Mouse position as fraction of SVG element
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;
    // Zoom factor
    const delta = e.deltaY > 0 ? 1.1 : 0.9;
    setVb(prev => {
      const newW = Math.min(svgW * 3, Math.max(svgW * 0.15, prev.w * delta));
      const newH = Math.min(svgH * 3, Math.max(svgH * 0.15, prev.h * delta));
      const newX = prev.x + (prev.w - newW) * mx;
      const newY = prev.y + (prev.h - newH) * my;
      setZoom(svgW / newW);
      return { x: newX, y: newY, w: newW, h: newH };
    });
  }, [svgW, svgH]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle click or Alt+click to pan
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, vbX: vb.x, vbY: vb.y };
      (e.target as Element).setPointerCapture?.(e.pointerId);
      e.preventDefault();
    }
  }, [vb.x, vb.y]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const dx = (e.clientX - panStart.current.x) / rect.width * vb.w;
    const dy = (e.clientY - panStart.current.y) / rect.height * vb.h;
    setVb(prev => ({ ...prev, x: panStart.current.vbX - dx, y: panStart.current.vbY - dy }));
  }, [isPanning, vb.w, vb.h]);

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const resetZoom = useCallback(() => {
    setVb({ x: 0, y: 0, w: svgW, h: svgH });
    setZoom(1);
  }, [svgW, svgH]);

  const zoomBy = useCallback((factor: number) => {
    setVb(prev => {
      const newW = Math.min(svgW * 3, Math.max(svgW * 0.15, prev.w * factor));
      const newH = Math.min(svgH * 3, Math.max(svgH * 0.15, prev.h * factor));
      const newX = prev.x + (prev.w - newW) * 0.5;
      const newY = prev.y + (prev.h - newH) * 0.5;
      setZoom(svgW / newW);
      return { x: newX, y: newY, w: newW, h: newH };
    });
  }, [svgW, svgH]);

  return (
    <div className="relative">
      {/* View mode toggle */}
      <div className="absolute top-2 left-2 z-10 flex gap-0 bg-white/90 rounded-lg shadow-sm border border-gray-200 p-1">
        <button
          onClick={() => setViewMode("section")}
          className={`h-7 px-2.5 flex items-center justify-center rounded text-[11px] font-medium transition-colors ${
            viewMode === "section" ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-100"
          }`}
          title="Vista de corte arquitectónico"
        >Corte</button>
        <button
          onClick={() => setViewMode("facade")}
          className={`h-7 px-2.5 flex items-center justify-center rounded text-[11px] font-medium transition-colors ${
            viewMode === "facade" ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-100"
          }`}
          title="Vista de fachada frontal"
        >Fachada</button>
      </div>
      {/* Zoom controls */}
      <div className="absolute top-2 right-2 z-10 flex gap-1 bg-white/90 rounded-lg shadow-sm border border-gray-200 p-1">
        <button
          onClick={() => zoomBy(0.75)}
          className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded text-sm font-mono"
          title="Acercar"
        >+</button>
        <button
          onClick={resetZoom}
          className="h-7 px-1.5 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded text-[10px] font-mono"
          title="Restablecer zoom"
        >{Math.round(zoom * 100)}%</button>
        <button
          onClick={() => zoomBy(1.33)}
          className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded text-sm font-mono"
          title="Alejar"
        >-</button>
      </div>
    {viewMode === "facade" ? (
      <div className="flex flex-col items-center justify-center" style={{ minHeight: "85vh", background: "#F5F3EE" }}>
        {facadeLoading && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-3 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">Generando fachada con IA...</p>
            <p className="text-gray-400 text-xs">Esto puede tomar 15-30 segundos</p>
          </div>
        )}
        {facadeError && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-red-500 text-sm">{facadeError}</p>
            <button
              onClick={generateFacade}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-700"
            >Reintentar</button>
          </div>
        )}
        {!facadeLoading && !facadeError && !facadeImage && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-gray-500 text-sm">Genera una imagen realista de tu edificio emocional</p>
            <button
              onClick={generateFacade}
              className="px-5 py-2.5 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
            >Generar fachada con IA</button>
          </div>
        )}
        {facadeImage && !facadeLoading && (
          <div className="relative w-full max-w-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={facadeImage}
              alt="Fachada del edificio emocional"
              className="w-full rounded-lg shadow-lg"
            />
            <button
              onClick={generateFacade}
              className="absolute top-3 right-3 px-3 py-1.5 bg-white/90 text-gray-700 rounded-lg text-xs font-medium hover:bg-white shadow-sm border border-gray-200"
            >Regenerar</button>
          </div>
        )}
      </div>
    ) : (
    <svg
      ref={svgRef}
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      className="w-full"
      style={{ minHeight: "85vh", background: "white", cursor: isPanning ? "grabbing" : "default" }}
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <rect width={svgW} height={svgH} fill="white" />

      {/* ═══ GROUND LINE ═══ */}
      <line x1={0} y1={groundY} x2={svgW} y2={groundY}
        stroke={S.wallStroke} strokeWidth={2} />

      {/* Ground hatching below */}
      {Array.from({ length: Math.floor(svgW / 8) }).map((_, i) => (
        <line key={`g${i}`}
          x1={i * 8} y1={groundY + 1} x2={i * 8 - 10} y2={groundY + 11}
          stroke={S.veryThin} strokeWidth={S.veryThinW} />
      ))}

      {/* ═══ BUILDING GROUP (with tilt) ═══ */}
      <g transform={tilt > 0.1 ? `rotate(${-tilt}, ${centerX}, ${groundY})` : undefined}>

        {/* ── FOUNDATION ── */}
        {/* Foundation walls */}
        <rect x={baseX} y={groundY - CFG.foundationH} width={baseW} height={CFG.foundationH}
          fill="white" stroke={S.wallStroke} strokeWidth={S.wallStrokeW} />
        {/* Exterior foundation walls filled */}
        <rect x={baseX} y={groundY - CFG.foundationH}
          width={CFG.extWallT} height={CFG.foundationH}
          fill={S.wallFill} stroke={S.wallStroke} strokeWidth={S.wallStrokeW} />
        <rect x={baseX + baseW - CFG.extWallT} y={groundY - CFG.foundationH}
          width={CFG.extWallT} height={CFG.foundationH}
          fill={S.wallFill} stroke={S.wallStroke} strokeWidth={S.wallStrokeW} />
        {/* Core walls in foundation */}
        {(() => {
          const coreX = baseX + baseW / 2 - CFG.coreW / 2;
          return (
            <>
              <rect x={coreX - CFG.coreWallT} y={groundY - CFG.foundationH}
                width={CFG.coreWallT} height={CFG.foundationH}
                fill={S.wallFill} stroke={S.wallStroke} strokeWidth={S.wallStrokeW} />
              <rect x={coreX + CFG.coreW} y={groundY - CFG.foundationH}
                width={CFG.coreWallT} height={CFG.foundationH}
                fill={S.wallFill} stroke={S.wallStroke} strokeWidth={S.wallStrokeW} />
            </>
          );
        })()}
        {/* Foundation slab */}
        <rect x={baseX - CFG.footingExtra} y={groundY}
          width={baseW + CFG.footingExtra * 2} height={CFG.slabT}
          fill={S.slabFill} stroke={S.slabStroke} strokeWidth={S.slabStrokeW} />
        {/* Footings */}
        <rect x={baseX - CFG.footingExtra} y={groundY + CFG.slabT}
          width={CFG.extWallT + CFG.footingExtra + 10} height={CFG.footingH}
          fill={S.wallFill} stroke={S.wallStroke} strokeWidth={S.wallStrokeW} />
        <rect x={baseX + baseW - CFG.extWallT - 10} y={groundY + CFG.slabT}
          width={CFG.extWallT + CFG.footingExtra + 10} height={CFG.footingH}
          fill={S.wallFill} stroke={S.wallStroke} strokeWidth={S.wallStrokeW} />
        {/* Central footing */}
        {(() => {
          const coreX = baseX + baseW / 2 - CFG.coreW / 2;
          return (
            <rect x={coreX - CFG.coreWallT - 8} y={groundY + CFG.slabT}
              width={CFG.coreW + CFG.coreWallT * 2 + 16} height={CFG.footingH}
              fill={S.wallFill} stroke={S.wallStroke} strokeWidth={S.wallStrokeW} />
          );
        })()}

        {/* ── FLOORS ── */}
        {visuals.map((v, i) => {
          const pos = positions[i];
          if (!pos) return null;
          return (
            <FloorSection
              key={v.fi}
              v={v}
              x={pos.x}
              y={pos.y}
              isHovered={hoveredFloor === v.fi}
              onClick={() => onFloorClick(v.floor)}
              onHover={() => setHoveredFloor(v.fi)}
              onLeave={() => setHoveredFloor(null)}
              onHoverEvent={handleHoverEvent}
              onLeaveEvent={handleLeaveEvent}
              hoveredEventId={hoveredEvent?.event.id ?? null}
            />
          );
        })}

        {/* ── TOP SLAB / ROOF ── */}
        {visuals.length > 0 && (() => {
          const topV = visuals[visuals.length - 1];
          const topPos = positions[visuals.length - 1];
          if (!topPos) return null;
          const roofY = topPos.y - CFG.slabT;
          return (
            <>
              {/* Top slab */}
              <rect x={topPos.x - 6} y={roofY} width={topV.floorW + 12} height={CFG.slabT}
                fill={S.slabFill} stroke={S.slabStroke} strokeWidth={S.slabStrokeW} />
              {/* Parapet walls */}
              <rect x={topPos.x - 6} y={roofY - 18} width={CFG.extWallT * 0.5} height={18}
                fill={S.wallFill} stroke={S.wallStroke} strokeWidth={S.wallStrokeW * 0.7} />
              <rect x={topPos.x + topV.floorW + 6 - CFG.extWallT * 0.5} y={roofY - 18}
                width={CFG.extWallT * 0.5} height={18}
                fill={S.wallFill} stroke={S.wallStroke} strokeWidth={S.wallStrokeW * 0.7} />
              {/* Roof core extension (elevator shaft / stair bulkhead) */}
              {(() => {
                const coreX = topPos.x + topV.floorW / 2 - CFG.coreW / 2;
                return (
                  <>
                    <rect x={coreX - CFG.coreWallT} y={roofY - 35}
                      width={CFG.coreWallT} height={35}
                      fill={S.wallFill} stroke={S.wallStroke} strokeWidth={S.wallStrokeW} />
                    <rect x={coreX + CFG.coreW} y={roofY - 35}
                      width={CFG.coreWallT} height={35}
                      fill={S.wallFill} stroke={S.wallStroke} strokeWidth={S.wallStrokeW} />
                    {/* Top cap */}
                    <rect x={coreX - CFG.coreWallT - 3} y={roofY - 38}
                      width={CFG.coreW + CFG.coreWallT * 2 + 6} height={CFG.slabT * 0.7}
                      fill={S.slabFill} stroke={S.slabStroke} strokeWidth={S.slabStrokeW} />
                  </>
                );
              })()}
            </>
          );
        })()}

        {/* ── CAUSAL CHAINS ── */}
        {aiAnalysis?.causalChains?.map((chain, ci) => {
          const fp = positions[chain.fromFloor];
          const tp = positions[chain.toFloor];
          const fv = visuals[chain.fromFloor];
          const tv = visuals[chain.toFloor];
          if (!fp || !tp || !fv || !tv) return null;
          const mx = (fp.x + tp.x) / 2 - 12;
          const my = (fp.y + fv.floorH / 2 + tp.y + tv.floorH / 2) / 2;
          const strengthPct = Math.round(chain.strength * 100);
          return (
            <g key={`ch${ci}`} className="cursor-help"
              onMouseEnter={() => setHoveredAnnotation({
                x: mx, y: my,
                title: "Cadena causal",
                description: `"${chain.fromEvent}" → "${chain.toEvent}". ${chain.description} (Intensidad: ${strengthPct}%)`,
                color: "#C0392B",
              })}
              onMouseLeave={() => setHoveredAnnotation(null)}>
              <line
                x1={fp.x - 12} y1={fp.y + fv.floorH / 2}
                x2={tp.x - 12} y2={tp.y + tv.floorH / 2}
                stroke="#C0392B" strokeWidth={0.8 + chain.strength}
                strokeDasharray="5 3" opacity={0.35 + chain.strength * 0.25} />
              {/* Invisible wider hit area */}
              <line
                x1={fp.x - 12} y1={fp.y + fv.floorH / 2}
                x2={tp.x - 12} y2={tp.y + tv.floorH / 2}
                stroke="transparent" strokeWidth={12} />
            </g>
          );
        })}
      </g>

      {/* ═══ ANNOTATIONS ═══ */}

      {/* Floor labels — right side */}
      {visuals.map((v, i) => {
        const pos = positions[i];
        if (!pos) return null;
        const lx = margin.left + maxW + 25;
        const ly = pos.y + v.floorH / 2;
        const sc = v.floor.stability > 0.3 ? "#27AE60"
          : v.floor.stability > 0 ? "#B8A000"
          : v.floor.stability > -0.3 ? "#D4760A" : "#C0392B";
        const sl = v.floor.stability > 0.3 ? "SÓLIDO"
          : v.floor.stability > 0 ? "ESTABLE"
          : v.floor.stability > -0.3 ? "FRÁGIL" : "INESTABLE";

        return (
          <g key={`lbl${v.fi}`} opacity={hoveredFloor === v.fi ? 1 : 0.55}>
            <line x1={pos.x + v.floorW + 2} y1={ly}
              x2={lx - 5} y2={ly}
              stroke="#CCC" strokeWidth={0.4} strokeDasharray="2 2" />
            <text x={lx} y={ly - 5} fill={S.textColor} fontSize={11} fontWeight="600"
              fontFamily="'Helvetica Neue', Arial, sans-serif">
              {v.floor.label}
            </text>
            <text x={lx} y={ly + 8} fill={S.textLight} fontSize={8}
              fontFamily="'Helvetica Neue', Arial, sans-serif">
              {v.floor.ageRange} · {v.floor.events.length} ev.
            </text>
            <g className="cursor-help"
              onMouseEnter={() => {
                const stabilityDesc = v.floor.stability > 0.3
                  ? "Este periodo tiene una base emocional sólida. Las experiencias positivas superan significativamente las negativas."
                  : v.floor.stability > 0
                  ? "Periodo estable con balance emocional positivo, aunque con algunas tensiones."
                  : v.floor.stability > -0.3
                  ? "Periodo frágil. Las experiencias negativas generan tensión visible en la estructura emocional."
                  : "Periodo de alta inestabilidad. Experiencias abrumadoras comprometen la integridad emocional.";
                const dmgDesc: Record<string, string> = {
                  DG0: "Sin daño — Cimientos fuertes, recursos de resiliencia intactos.",
                  DG1: "Fisuras leves — Estrés menor absorbido, algo de afrontamiento necesario.",
                  DG2: "Daño moderado — Experiencias mixtas, funcional pero con tensión visible.",
                  DG3: "Daño sustancial — Carga negativa significativa que afecta pisos superiores.",
                  DG4: "Daño severo — Experiencias abrumadoras, integridad estructural comprometida.",
                };
                const failDesc: Record<string, string> = {
                  none: "",
                  asentamiento: "Asentamiento: vacíos o abandono causan hundimiento en un lado.",
                  cortante: "Falla por corte: trauma agudo genera grietas diagonales.",
                  flexion: "Falla por flexión: sobrecarga emocional causa curvatura.",
                  torsion: "Falla por torsión: identidad fragmentada genera torsión.",
                  pandeo: "Pandeo: presión sin soporte causa deformación de columnas.",
                };
                setHoveredAnnotation({
                  x: lx, y: ly + 19,
                  title: `${sl} · ${v.floor.damageGrade}`,
                  description: `${stabilityDesc} ${dmgDesc[v.floor.damageGrade] ?? ""}${v.failureType !== "none" ? ` ${failDesc[v.failureType] ?? ""}` : ""}`,
                  color: sc,
                });
              }}
              onMouseLeave={() => setHoveredAnnotation(null)}>
              <rect x={lx - 2} y={ly + 11} width={100} height={v.failureType !== "none" ? 22 : 12}
                fill="transparent" />
              <text x={lx} y={ly + 19} fill={sc} fontSize={7.5}
                fontFamily="monospace" fontWeight="bold">
                {sl} · {v.floor.damageGrade}
              </text>
              {v.failureType !== "none" && (
                <text x={lx} y={ly + 29} fill="#999" fontSize={7}
                  fontFamily="monospace">
                  [{v.failureType}]
                </text>
              )}
            </g>
          </g>
        );
      })}

      {/* Elevation markers — left side */}
      {visuals.map((v, i) => {
        const pos = positions[i];
        if (!pos) return null;
        const slabY = pos.y + v.floorH;
        const elev = visuals.slice(0, i + 1).reduce((s, vv) => s + vv.floorH, 0);
        const elevM = (elev / 35).toFixed(2);
        const elevDesc = i === 0
          ? "Base emocional: el punto de partida de tu historia. Aquí se asientan los cimientos de tu identidad."
          : `Altura acumulada: +${elevM}m. Representa el peso emocional acumulado desde tus cimientos hasta "${v.floor.label}". Mayor altura = más experiencias construidas.`;
        const wallX = pos.x; // left edge of the building floor
        return (
          <g key={`elv${v.fi}`} opacity={0.45} className="cursor-help"
            onMouseEnter={() => setHoveredAnnotation({
              x: margin.left - 10, y: slabY,
              title: i === 0 ? "Nivel de referencia (±0.00)" : `Cota +${elevM}m`,
              description: elevDesc,
              color: S.textColor,
            })}
            onMouseLeave={() => setHoveredAnnotation(null)}>
            <rect x={margin.left - 60} y={slabY - 8} width={wallX - margin.left + 60} height={16}
              fill="transparent" />
            <line x1={margin.left - 18} y1={slabY} x2={wallX} y2={slabY}
              stroke={S.textColor} strokeWidth={0.6} />
            <polygon
              points={`${margin.left - 18},${slabY - 3} ${margin.left - 18},${slabY + 3} ${margin.left - 13},${slabY}`}
              fill={S.textColor} />
            <text x={margin.left - 22} y={slabY + 3} fill={S.textColor} fontSize={7}
              fontFamily="monospace" textAnchor="end">
              {i === 0 ? "±0.00" : `+${elevM}`}
            </text>
          </g>
        );
      })}

      {/* Ground label */}
      <text x={margin.left - 22} y={groundY + 4} fill={S.textColor} fontSize={7}
        fontFamily="monospace" textAnchor="end" fontWeight="bold">N.T.N.</text>

      {/* Title block */}
      <g>
        <rect x={svgW - 220} y={svgH - 55} width={210} height={45}
          fill="white" stroke={S.wallStroke} strokeWidth={1.2} />
        <line x1={svgW - 220} y1={svgH - 40} x2={svgW - 10} y2={svgH - 40}
          stroke={S.wallStroke} strokeWidth={0.6} />
        <text x={svgW - 115} y={svgH - 43} fill={S.textColor} fontSize={9}
          fontFamily="'Helvetica Neue', Arial, sans-serif" textAnchor="middle" fontWeight="bold"
          letterSpacing={1}>
          TELOVA — CORTE A-A&apos;
        </text>
        <text x={svgW - 215} y={svgH - 28} fill={S.textLight} fontSize={7}
          fontFamily="monospace">
          Edificio de Vida · {visibleFloors.length} pisos · {visibleFloors.reduce((s, f) => s + f.events.length, 0)} eventos
        </text>
        <text x={svgW - 215} y={svgH - 17} fill={S.textLight} fontSize={7}
          fontFamily="monospace">
          Esc. 1:100 · {new Date().toLocaleDateString()}
          {aiAnalysis ? ` · Integridad: ${aiAnalysis.structuralIntegrity}%` : ""}
        </text>
      </g>

      {/* ═══ EVENT TOOLTIP ═══ */}
      {hoveredEvent && (() => {
        const ev = hoveredEvent.event;
        const color = getCategoryColor(ev.category);
        const impactLabel = ev.impact_type === "positivo" ? "+" + ev.impact
          : ev.impact_type === "negativo" ? "-" + ev.impact : "~" + ev.impact;
        const title = ev.title.length > 40 ? ev.title.substring(0, 38) + "…" : ev.title;
        const tooltipW = 200;
        const tooltipH = 52;
        // Position tooltip above the dot, clamped to SVG bounds
        let tx = hoveredEvent.x - tooltipW / 2;
        let ty = hoveredEvent.y - tooltipH - 12;
        if (tx < 5) tx = 5;
        if (tx + tooltipW > svgW - 5) tx = svgW - tooltipW - 5;
        if (ty < 5) ty = hoveredEvent.y + 15; // flip below if too high

        return (
          <g>
            {/* Shadow */}
            <rect x={tx + 2} y={ty + 2} width={tooltipW} height={tooltipH}
              rx={4} fill="black" opacity={0.1} />
            {/* Background */}
            <rect x={tx} y={ty} width={tooltipW} height={tooltipH}
              rx={4} fill="white" stroke={color} strokeWidth={1.5} />
            {/* Category color bar */}
            <rect x={tx} y={ty} width={4} height={tooltipH} rx={2} fill={color} />
            {/* Title */}
            <text x={tx + 12} y={ty + 16} fill="#333" fontSize={10} fontWeight="600"
              fontFamily="'Helvetica Neue', Arial, sans-serif">
              {title}
            </text>
            {/* Category + impact */}
            <text x={tx + 12} y={ty + 30} fill="#777" fontSize={8}
              fontFamily="'Helvetica Neue', Arial, sans-serif">
              {ev.category} · Impacto: {impactLabel}
            </text>
            {/* Date */}
            <text x={tx + 12} y={ty + 43} fill="#999" fontSize={7.5}
              fontFamily="monospace">
              {new Date(ev.event_date).toLocaleDateString()}
            </text>
            {/* Impact type badge */}
            <rect x={tx + tooltipW - 40} y={ty + 6} width={32} height={14} rx={3}
              fill={ev.impact_type === "positivo" ? "#27AE60"
                : ev.impact_type === "negativo" ? "#E74C3C" : "#999"}
              opacity={0.85} />
            <text x={tx + tooltipW - 24} y={ty + 16} fill="white" fontSize={7}
              fontFamily="monospace" textAnchor="middle" fontWeight="bold">
              {ev.impact_type === "positivo" ? "POS" : ev.impact_type === "negativo" ? "NEG" : "NEU"}
            </text>
          </g>
        );
      })()}

      {/* ═══ ANNOTATION TOOLTIP ═══ */}
      {hoveredAnnotation && (() => {
        const tooltipW = 230;
        // Word-wrap description into lines of ~38 chars
        const words = hoveredAnnotation.description.split(" ");
        const lines: string[] = [];
        let cur = "";
        for (const w of words) {
          if ((cur + " " + w).length > 38 && cur) { lines.push(cur); cur = w; }
          else { cur = cur ? cur + " " + w : w; }
        }
        if (cur) lines.push(cur);
        const tooltipH = 30 + lines.length * 13;
        let tx = hoveredAnnotation.x + 12;
        let ty = hoveredAnnotation.y - tooltipH / 2;
        if (tx + tooltipW > svgW - 5) tx = hoveredAnnotation.x - tooltipW - 12;
        if (ty < 5) ty = 5;
        if (ty + tooltipH > svgH - 5) ty = svgH - tooltipH - 5;

        return (
          <g style={{ pointerEvents: "none" }}>
            <rect x={tx + 2} y={ty + 2} width={tooltipW} height={tooltipH}
              rx={5} fill="black" opacity={0.08} />
            <rect x={tx} y={ty} width={tooltipW} height={tooltipH}
              rx={5} fill="white" stroke={hoveredAnnotation.color} strokeWidth={1.2} />
            <rect x={tx} y={ty} width={4} height={tooltipH} rx={2}
              fill={hoveredAnnotation.color} />
            <text x={tx + 12} y={ty + 16} fill="#333" fontSize={10} fontWeight="600"
              fontFamily="'Helvetica Neue', Arial, sans-serif">
              {hoveredAnnotation.title}
            </text>
            {lines.map((line, li) => (
              <text key={li} x={tx + 12} y={ty + 30 + li * 13} fill="#666" fontSize={8.5}
                fontFamily="'Helvetica Neue', Arial, sans-serif">
                {line}
              </text>
            ))}
          </g>
        );
      })()}
    </svg>
    )}
    </div>
  );
}
