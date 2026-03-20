"use client";

import { Floor, getCategoryColor, CapasEvent, BuildingAnalysis, FloorAnalysis, CausalChain } from "@/lib/types";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";

interface BuildingProps {
  floors: Floor[];
  onFloorClick: (floor: Floor) => void;
  aiAnalysis?: BuildingAnalysis | null;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * TETRIS BLOCKS — Life events as stacking blocks
 *
 * Each event = a block. Blocks stack within their floor row.
 * Size based on impact, color by category, cracks for damage.
 * Negative events have rough/cracked edges, positive are solid.
 * ═══════════════════════════════════════════════════════════════════════════ */

const CFG = {
  svgW: 780,
  rowH: 120,           // height per floor row
  gridW: 600,          // width of the play area
  blockUnit: 40,       // base block size unit
  gap: 3,              // gap between blocks
  cornerR: 4,          // block corner radius
  minWidthFactor: 0.55,
  minHeightFactor: 0.55,
};

/* ─── TYPES ────────────────────────────────────────────────────────────── */

interface BlockVisual {
  event: CapasEvent;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  opacity: number;
  isNegative: boolean;
  impact: number;
}

interface RowVisual {
  floor: Floor;
  fi: number;
  y: number;
  h: number;
  blocks: BlockVisual[];
  health: number;
  stability: number;
  damageGrade: string;
  ai?: FloorAnalysis;
}

/* ─── BLOCK SIZE — Impact determines rectangle size ───────────────────── */

function getBlockSize(impact: number, unit: number): { w: number; h: number } {
  // Scale from 1 unit (impact 1) to 2.5 units (impact 10)
  const scale = 0.8 + (impact / 10) * 1.2;
  return { w: Math.round(unit * scale), h: Math.round(unit * scale) };
}

/* ─── PSEUDO-RANDOM ───────────────────────────────────────────────────── */

function seededRand(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s & 0x7fffffff) / 2147483647; };
}

/* ─── CRACK PATTERNS for damaged blocks ───────────────────────────────── */

function crackPath(
  x0: number, y0: number, x1: number, y1: number,
  jitter: number, segs: number, rand: () => number,
): string {
  let p = `M ${x0.toFixed(1)} ${y0.toFixed(1)}`;
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const bx = x0 + (x1 - x0) * t;
    const by = y0 + (y1 - y0) * t;
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const j = (rand() - 0.5) * 2 * jitter;
    p += ` L ${(bx + nx * j).toFixed(1)} ${(by + ny * j).toFixed(1)}`;
  }
  return p;
}

function blockCracks(x: number, y: number, w: number, h: number, damage: number, seed: number): string[] {
  if (damage <= 0.15) return [];
  const paths: string[] = [];
  const rand = seededRand(seed);
  const n = Math.min(4, Math.floor(damage * 4) + 1);
  const jit = 1.5 + damage * 3;
  for (let i = 0; i < n; i++) {
    const sx = x + rand() * w * 0.3;
    const sy = y + rand() * h * 0.3;
    const ex = x + w * 0.4 + rand() * w * 0.6;
    const ey = y + h * 0.4 + rand() * h * 0.6;
    paths.push(crackPath(sx, sy, ex, ey, jit, 3 + Math.floor(damage * 3), rand));
  }
  return paths;
}

/* ─── SINGLE TETRIS BLOCK ─────────────────────────────────────────────── */

function TetrisBlock({
  block, floorIndex, blockIndex,
  onHover, onLeave, onClick,
}: {
  block: BlockVisual;
  floorIndex: number;
  blockIndex: number;
  onHover: (ev: CapasEvent, x: number, y: number) => void;
  onLeave: () => void;
  onClick: () => void;
}) {
  const damage = block.isNegative ? block.impact / 10 : 0;
  const cracks = blockCracks(block.x, block.y, block.w, block.h, damage, floorIndex * 100 + blockIndex);

  return (
    <g
      className="cursor-pointer transition-opacity"
      style={{ opacity: block.opacity }}
      onMouseEnter={() => onHover(block.event, block.x + block.w / 2, block.y)}
      onMouseLeave={onLeave}
      onClick={onClick}
    >
      {/* Shadow */}
      <rect
        x={block.x + 2} y={block.y + 2}
        width={block.w} height={block.h}
        rx={CFG.cornerR}
        fill="rgba(0,0,0,0.1)"
      />
      {/* Main block */}
      <rect
        x={block.x} y={block.y}
        width={block.w} height={block.h}
        rx={CFG.cornerR}
        fill={block.color}
        stroke={block.isNegative ? "#00000033" : "#ffffff33"}
        strokeWidth={1}
      />
      {/* Highlight (top shine) */}
      <rect
        x={block.x + 1} y={block.y + 1}
        width={block.w - 2} height={block.h * 0.35}
        rx={CFG.cornerR - 1}
        fill="rgba(255,255,255,0.25)"
      />
      {/* Negative: darker bottom edge */}
      {block.isNegative && (
        <rect
          x={block.x} y={block.y + block.h * 0.7}
          width={block.w} height={block.h * 0.3}
          rx={CFG.cornerR}
          fill="rgba(0,0,0,0.15)"
        />
      )}

      {/* Impact indicator */}
      <text
        x={block.x + block.w / 2}
        y={block.y + block.h / 2 + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize={Math.max(8, block.w * 0.3)}
        fontWeight="bold"
        style={{ pointerEvents: "none", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
      >
        {block.isNegative ? "−" : "+"}
      </text>

      {/* Cracks overlay for negative/damaged blocks */}
      {cracks.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="rgba(0,0,0,0.4)"
          strokeWidth={0.8}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

/* ─── FLOOR ROW LABEL ─────────────────────────────────────────────────── */

function FloorLabel({ row, gridRight }: { row: RowVisual; gridRight: number }) {
  const healthColor = row.health >= 0.2 ? "#22C55E" : row.health >= -0.2 ? "#EAB308" : "#EF4444";
  const stabilityLabel = row.stability >= 0.2 ? "ESTABLE" : row.stability >= -0.2 ? "FRÁGIL" : "INESTABLE";

  return (
    <g>
      {/* Floor name */}
      <text
        x={gridRight + 12}
        y={row.y + 16}
        fill="#374151"
        fontSize={12}
        fontWeight="bold"
      >
        {row.floor.label}
      </text>
      {/* Age range + event count */}
      <text
        x={gridRight + 12}
        y={row.y + 30}
        fill="#9CA3AF"
        fontSize={9}
      >
        {row.floor.ageRange} · {row.floor.events.length} ev.
      </text>
      {/* Stability + Damage Grade */}
      <text
        x={gridRight + 12}
        y={row.y + 44}
        fill={healthColor}
        fontSize={9}
        fontWeight="600"
      >
        {stabilityLabel} · {row.damageGrade}
      </text>
    </g>
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
  const [hoveredEvent, setHoveredEvent] = useState<{ event: CapasEvent; x: number; y: number } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  const handleHoverEvent = useCallback((ev: CapasEvent, x: number, y: number) => {
    setHoveredEvent({ event: ev, x, y });
  }, []);

  const handleLeaveEvent = useCallback(() => {
    setHoveredEvent(null);
  }, []);

  // Filter visible floors (has events or is foundation)
  const visibleFloors = floors.filter(
    (f) => f.events.length > 0 || f.label === "Cimientos"
  );

  // Build row visuals with block positions
  const rows = useMemo(() => {
    const margin = { left: 10, top: 20 };
    const gridW = CFG.gridW;
    const result: RowVisual[] = [];

    // Stack rows from bottom (Cimientos) to top
    const reversed = [...visibleFloors].reverse();
    let currentY = margin.top;

    for (let ri = 0; ri < reversed.length; ri++) {
      const floor = reversed[ri];
      const fi = visibleFloors.length - 1 - ri;
      const ai = aiAnalysis?.floors?.find(f => f.floorIndex === fi);

      // Calculate blocks for this row
      const blocks: BlockVisual[] = [];
      const events = [...floor.events].sort((a, b) => b.impact - a.impact);

      // Layout blocks left-to-right, wrapping to next sub-row
      let bx = margin.left;
      let by = 0;
      let maxRowH = 0;
      const cellSize = CFG.blockUnit;

      for (let ei = 0; ei < events.length; ei++) {
        const ev = events[ei];
        const size = getBlockSize(ev.impact, cellSize);
        const bw = size.w;
        const bh = size.h;

        // Wrap to next sub-row if exceeds grid width
        if (bx + bw > margin.left + gridW) {
          bx = margin.left;
          by += maxRowH + CFG.gap;
          maxRowH = 0;
        }

        blocks.push({
          event: ev,
          x: bx,
          y: by,
          w: bw,
          h: bh,
          color: getCategoryColor(ev.category),
          opacity: ev.impact_type === "neutro" ? 0.5 : 0.9,
          isNegative: ev.impact_type === "negativo",
          impact: ev.impact,
        });

        bx += bw + CFG.gap;
        maxRowH = Math.max(maxRowH, bh);
      }

      const contentH = events.length > 0 ? by + maxRowH + CFG.gap * 2 : 30;
      const rowH = Math.max(CFG.rowH, contentH + 20);

      // Adjust block Y positions relative to row
      for (const b of blocks) {
        b.y = currentY + 10 + b.y;
        b.x = b.x;
      }

      result.push({
        floor, fi,
        y: currentY,
        h: rowH,
        blocks,
        health: floor.health,
        stability: floor.stability,
        damageGrade: floor.damageGrade,
        ai,
      });

      currentY += rowH;
    }

    // Reverse so index 0 = bottom floor
    return result.reverse();
  }, [visibleFloors, aiAnalysis]);

  // SVG dimensions
  const totalH = rows.reduce((sum, r) => sum + r.h, 0) + 60;
  const svgW = CFG.svgW;
  const svgH = Math.max(400, totalH);

  // Zoom state
  const [vb, setVb] = useState({ x: 0, y: 0, w: svgW, h: svgH });
  const [zoom, setZoom] = useState(100);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, vbX: 0, vbY: 0 });

  // Reset viewBox when dimensions change
  useEffect(() => {
    setVb({ x: 0, y: 0, w: svgW, h: svgH });
    setZoom(100);
  }, [svgW, svgH]);

  // Wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.08 : 0.93;
    setVb(prev => {
      const nw = prev.w * factor;
      const nh = prev.h * factor;
      const cx = prev.x + prev.w / 2;
      const cy = prev.y + prev.h / 2;
      return { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
    });
    setZoom(z => Math.round(z / (e.deltaY > 0 ? 1.08 : 0.93)));
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // Pan handlers
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 1) {
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, vbX: vb.x, vbY: vb.y };
    }
  }, [vb]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = vb.w / rect.width;
    const scaleY = vb.h / rect.height;
    const dx = (e.clientX - panStart.current.x) * scaleX;
    const dy = (e.clientY - panStart.current.y) * scaleY;
    setVb(prev => ({ ...prev, x: panStart.current.vbX - dx, y: panStart.current.vbY - dy }));
  }, [isPanning, vb]);

  const onPointerUp = useCallback(() => setIsPanning(false), []);

  const zoomBy = useCallback((factor: number) => {
    setVb(prev => {
      const nw = prev.w * factor;
      const nh = prev.h * factor;
      const cx = prev.x + prev.w / 2;
      const cy = prev.y + prev.h / 2;
      return { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
    });
    setZoom(z => Math.round(z / factor));
  }, []);

  const resetZoom = useCallback(() => {
    setVb({ x: 0, y: 0, w: svgW, h: svgH });
    setZoom(100);
  }, [svgW, svgH]);

  // Generate facade
  const generateFacade = useCallback(async () => {
    setFacadeLoading(true);
    setFacadeError(null);
    try {
      const floorsData = visibleFloors.map((f, i) => ({
        label: f.label,
        stability: f.stability,
        damageGrade: f.damageGrade,
        failureType: aiAnalysis?.floors?.[i]?.failureType || "none",
        widthFactor: 1,
        heightFactor: 1,
        tiltDeg: 0,
        events: f.events.length,
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
      setFacadeError(err instanceof Error ? err.message : "Error");
    } finally {
      setFacadeLoading(false);
    }
  }, [visibleFloors, aiAnalysis]);

  const gridRight = CFG.gridW + 10;

  // Causal chains from AI analysis
  const causalChains = aiAnalysis?.causalChains || [];

  return (
    <div className="w-full h-full flex flex-col">
      {/* Controls bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-white/80 backdrop-blur-sm border-b border-slate-200">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("section")}
            className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
              viewMode === "section" ? "bg-white shadow text-slate-800" : "text-slate-500"
            }`}
          >
            Bloques
          </button>
          <button
            onClick={() => setViewMode("facade")}
            className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
              viewMode === "facade" ? "bg-white shadow text-slate-800" : "text-slate-500"
            }`}
          >
            Fachada
          </button>
        </div>

        {viewMode === "section" && (
          <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-0.5">
            <button onClick={() => zoomBy(0.85)} className="px-2 py-1 text-xs text-slate-600 hover:text-slate-800">+</button>
            <button onClick={resetZoom} className="px-2 py-1 text-xs text-slate-600 font-mono">{zoom}%</button>
            <button onClick={() => zoomBy(1.18)} className="px-2 py-1 text-xs text-slate-600 hover:text-slate-800">−</button>
          </div>
        )}
      </div>

      {/* Facade view */}
      {viewMode === "facade" && (
        <div className="flex-1 flex items-center justify-center bg-slate-50 p-4">
          {facadeImage ? (
            <div className="relative">
              <img
                src={facadeImage}
                alt="Fachada generada"
                className="max-h-[75vh] rounded-lg shadow-lg"
              />
              <button
                onClick={generateFacade}
                className="absolute top-2 right-2 px-3 py-1.5 bg-white/90 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-800 shadow"
              >
                Regenerar
              </button>
            </div>
          ) : (
            <div className="text-center">
              <button
                onClick={generateFacade}
                disabled={facadeLoading}
                className="px-6 py-3 rounded-xl text-white font-medium transition-all hover:opacity-90"
                style={{ backgroundColor: "#8c52ff" }}
              >
                {facadeLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generando fachada...
                  </span>
                ) : "Generar fachada con IA"}
              </button>
              {facadeError && <p className="text-red-500 text-sm mt-3">{facadeError}</p>}
            </div>
          )}
        </div>
      )}

      {/* Tetris blocks view */}
      {viewMode === "section" && (
        <div className="flex-1 min-h-0 overflow-hidden relative">
          <svg
            ref={svgRef}
            viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
            className="w-full h-full"
            style={{ background: "#FAFAFA" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {/* Grid background pattern */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="url(#grid)" />

            {/* Floor rows — bottom to top */}
            {rows.map((row, ri) => (
              <g key={row.fi}>
                {/* Row background */}
                <rect
                  x={0}
                  y={row.y}
                  width={gridRight}
                  height={row.h}
                  fill={ri % 2 === 0 ? "rgba(241,245,249,0.5)" : "rgba(248,250,252,0.3)"}
                  stroke="#e2e8f0"
                  strokeWidth={0.5}
                  className="cursor-pointer"
                  onClick={() => onFloorClick(row.floor)}
                />

                {/* Row separator line */}
                <line
                  x1={0} y1={row.y}
                  x2={gridRight} y2={row.y}
                  stroke="#cbd5e1"
                  strokeWidth={0.5}
                  strokeDasharray="4 4"
                />

                {/* Blocks */}
                {row.blocks.map((block, bi) => (
                  <TetrisBlock
                    key={block.event.id}
                    block={block}
                    floorIndex={row.fi}
                    blockIndex={bi}
                    onHover={handleHoverEvent}
                    onLeave={handleLeaveEvent}
                    onClick={() => onFloorClick(row.floor)}
                  />
                ))}

                {/* Empty floor message */}
                {row.blocks.length === 0 && (
                  <text
                    x={gridRight / 2}
                    y={row.y + row.h / 2}
                    textAnchor="middle"
                    fill="#cbd5e1"
                    fontSize={11}
                    fontStyle="italic"
                  >
                    Sin eventos registrados
                  </text>
                )}

                {/* Floor label on the right */}
                <FloorLabel row={row} gridRight={gridRight} />
              </g>
            ))}

            {/* Causal chains */}
            {causalChains.map((chain: CausalChain, ci: number) => {
              const fromRow = rows.find(r => r.fi === chain.fromFloor);
              const toRow = rows.find(r => r.fi === chain.toFloor);
              if (!fromRow || !toRow) return null;

              const fromBlock = fromRow.blocks.find(b => b.event.id === chain.fromEvent);
              const toBlock = toRow.blocks.find(b => b.event.id === chain.toEvent);
              if (!fromBlock || !toBlock) return null;

              const x1 = fromBlock.x + fromBlock.w / 2;
              const y1 = fromBlock.y + fromBlock.h / 2;
              const x2 = toBlock.x + toBlock.w / 2;
              const y2 = toBlock.y + toBlock.h / 2;

              return (
                <line
                  key={ci}
                  x1={x1} y1={y1}
                  x2={x2} y2={y2}
                  stroke="#EF4444"
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                  opacity={0.6}
                />
              );
            })}

            {/* Title block */}
            <g transform={`translate(${gridRight - 160}, ${(rows[0]?.y ?? 0) + (rows[0]?.h ?? 0) + 15})`}>
              <rect x={0} y={0} width={170} height={40} fill="white" stroke="#94a3b8" strokeWidth={0.5} rx={4} />
              <text x={85} y={14} textAnchor="middle" fill="#374151" fontSize={10} fontWeight="bold">
                TELOVA — BLOQUES DE VIDA
              </text>
              <text x={85} y={28} textAnchor="middle" fill="#94a3b8" fontSize={8}>
                {visibleFloors.length} pisos · {visibleFloors.reduce((s, f) => s + f.events.length, 0)} eventos
              </text>
            </g>
          </svg>

          {/* Event tooltip */}
          {hoveredEvent && (
            <div
              className="absolute pointer-events-none bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-slate-200 px-3 py-2 z-50"
              style={{
                left: `min(calc(${(hoveredEvent.x - vb.x) / vb.w * 100}% + 10px), calc(100% - 220px))`,
                top: `calc(${(hoveredEvent.y - vb.y) / vb.h * 100}% - 10px)`,
                maxWidth: 210,
                transform: "translateY(-100%)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: getCategoryColor(hoveredEvent.event.category) }}
                />
                <span className="text-[10px] font-bold text-slate-700 truncate">
                  {hoveredEvent.event.title}
                </span>
              </div>
              <div className="text-[9px] text-slate-500">
                {hoveredEvent.event.category} · Impacto {hoveredEvent.event.impact}/10
                <span className="ml-1">
                  ({hoveredEvent.event.impact_type === "positivo" ? "+" : hoveredEvent.event.impact_type === "negativo" ? "−" : "~"})
                </span>
              </div>
              {hoveredEvent.event.description && (
                <p className="text-[8px] text-slate-400 mt-1 line-clamp-2">{hoveredEvent.event.description}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
