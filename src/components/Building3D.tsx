"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Floor } from "@/lib/types";

interface FloorData {
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
}

interface Building3DProps {
  floors: Floor[];
  visuals: FloorData[];
  tilt: number;
}

/* ── Color helpers ── */
function stabilityColor(stability: number): string {
  if (stability > 0.3) return "#E8F5E9";   // green-ish
  if (stability > 0) return "#FFF8E1";      // yellow-ish
  if (stability > -0.3) return "#FFF3E0";   // orange-ish
  return "#FFEBEE";                          // red-ish
}

function wallColor(damage: number): string {
  // Interpolate from clean concrete to damaged
  const r = Math.round(220 + damage * 20);
  const g = Math.round(215 - damage * 40);
  const b = Math.round(210 - damage * 50);
  return `rgb(${r},${g},${b})`;
}

/* ── Single Window ── */
function WindowPane({ position, size }: {
  position: [number, number, number];
  size: [number, number];
}) {
  return (
    <group position={position}>
      {/* Glass */}
      <mesh>
        <planeGeometry args={[size[0], size[1]]} />
        <meshPhysicalMaterial
          color="#87CEEB"
          transparent
          opacity={0.4}
          roughness={0.1}
          metalness={0.1}
        />
      </mesh>
      {/* Frame */}
      {[
        // top
        { pos: [0, size[1] / 2, 0.01] as [number, number, number], s: [size[0] + 0.04, 0.04, 0.02] as [number, number, number] },
        // bottom
        { pos: [0, -size[1] / 2, 0.01] as [number, number, number], s: [size[0] + 0.04, 0.04, 0.02] as [number, number, number] },
        // left
        { pos: [-size[0] / 2, 0, 0.01] as [number, number, number], s: [0.04, size[1], 0.02] as [number, number, number] },
        // right
        { pos: [size[0] / 2, 0, 0.01] as [number, number, number], s: [0.04, size[1], 0.02] as [number, number, number] },
        // vertical mullion
        { pos: [0, 0, 0.01] as [number, number, number], s: [0.02, size[1], 0.02] as [number, number, number] },
        // horizontal mullion
        { pos: [0, 0, 0.01] as [number, number, number], s: [size[0], 0.02, 0.02] as [number, number, number] },
      ].map((bar, i) => (
        <mesh key={i} position={bar.pos}>
          <boxGeometry args={bar.s} />
          <meshStandardMaterial color="#555" />
        </mesh>
      ))}
    </group>
  );
}

/* ── Door ── */
function DoorMesh({ position, size }: {
  position: [number, number, number];
  size: [number, number];
}) {
  return (
    <group position={position}>
      <mesh>
        <planeGeometry args={[size[0], size[1]]} />
        <meshStandardMaterial color="#5D4037" />
      </mesh>
      {/* Frame */}
      {[
        { pos: [0, size[1] / 2, 0.01] as [number, number, number], s: [size[0] + 0.06, 0.05, 0.03] as [number, number, number] },
        { pos: [-size[0] / 2, 0, 0.01] as [number, number, number], s: [0.05, size[1], 0.03] as [number, number, number] },
        { pos: [size[0] / 2, 0, 0.01] as [number, number, number], s: [0.05, size[1], 0.03] as [number, number, number] },
      ].map((bar, i) => (
        <mesh key={i} position={bar.pos}>
          <boxGeometry args={bar.s} />
          <meshStandardMaterial color="#3E2723" />
        </mesh>
      ))}
      {/* Handle */}
      <mesh position={[size[0] / 2 - 0.12, 0, 0.03]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#B8860B" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
}

/* ── Single Floor Block ── */
function FloorBlock({ y, width, height, depth, damage, stability, isGround, tiltX }: {
  y: number;
  width: number;
  height: number;
  depth: number;
  damage: number;
  stability: number;
  isGround: boolean;
  tiltX: number;
}) {
  const wallH = height - 0.08; // clearance minus slab
  const slabH = 0.08;
  const col = useMemo(() => wallColor(damage), [damage]);
  const stabCol = useMemo(() => stabilityColor(stability), [stability]);

  // Windows per face
  const winW = 0.5;
  const winH = 0.65;
  const winGap = 0.35;
  const nWinsFront = Math.max(1, Math.floor((width - 0.4) / (winW + winGap)));
  const nWinsSide = Math.max(1, Math.floor((depth - 0.4) / (winW + winGap)));

  const frontWins = useMemo(() => {
    const arr: number[] = [];
    const totalW = nWinsFront * winW + (nWinsFront - 1) * winGap;
    const startX = -totalW / 2;
    for (let i = 0; i < nWinsFront; i++) {
      arr.push(startX + i * (winW + winGap) + winW / 2);
    }
    return arr;
  }, [nWinsFront]);

  const sideWins = useMemo(() => {
    const arr: number[] = [];
    const totalD = nWinsSide * winW + (nWinsSide - 1) * winGap;
    const startZ = -totalD / 2;
    for (let i = 0; i < nWinsSide; i++) {
      arr.push(startZ + i * (winW + winGap) + winW / 2);
    }
    return arr;
  }, [nWinsSide]);

  const doorIdx = Math.floor(nWinsFront / 2);

  return (
    <group position={[tiltX, y, 0]}>
      {/* Main wall block */}
      <mesh position={[0, wallH / 2, 0]}>
        <boxGeometry args={[width, wallH, depth]} />
        <meshStandardMaterial color={col} />
      </mesh>

      {/* Slab on top */}
      <mesh position={[0, wallH + slabH / 2, 0]}>
        <boxGeometry args={[width + 0.02, slabH, depth + 0.02]} />
        <meshStandardMaterial color="#888" />
      </mesh>

      {/* Floor tint (inside faces visible when cut) */}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[width - 0.2, 0.02, depth - 0.2]} />
        <meshStandardMaterial color={stabCol} />
      </mesh>

      {/* Front windows */}
      {frontWins.map((wx, i) => {
        if (isGround && i === doorIdx) {
          return (
            <DoorMesh
              key={`fd${i}`}
              position={[wx, 0.55, depth / 2 + 0.01]}
              size={[0.55, 1.1]}
            />
          );
        }
        return (
          <WindowPane
            key={`fw${i}`}
            position={[wx, wallH / 2 + 0.05, depth / 2 + 0.01]}
            size={[winW, winH]}
          />
        );
      })}

      {/* Back windows */}
      {frontWins.map((wx, i) => (
        <group key={`bw${i}`} position={[wx, wallH / 2 + 0.05, -depth / 2 - 0.01]} rotation={[0, Math.PI, 0]}>
          <WindowPane position={[0, 0, 0]} size={[winW, winH]} />
        </group>
      ))}

      {/* Right side windows */}
      {sideWins.map((wz, i) => (
        <group key={`rw${i}`} position={[width / 2 + 0.01, wallH / 2 + 0.05, wz]} rotation={[0, Math.PI / 2, 0]}>
          <WindowPane position={[0, 0, 0]} size={[winW, winH]} />
        </group>
      ))}

      {/* Left side windows */}
      {sideWins.map((wz, i) => (
        <group key={`lw${i}`} position={[-width / 2 - 0.01, wallH / 2 + 0.05, wz]} rotation={[0, -Math.PI / 2, 0]}>
          <WindowPane position={[0, 0, 0]} size={[winW, winH]} />
        </group>
      ))}
    </group>
  );
}

/* ── Roof ── */
function Roof({ y, width, depth }: { y: number; width: number; depth: number }) {
  return (
    <group position={[0, y, 0]}>
      {/* Flat roof slab */}
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[width + 0.1, 0.08, depth + 0.1]} />
        <meshStandardMaterial color="#777" />
      </mesh>
      {/* Parapet walls */}
      {[
        { pos: [0, 0.18, depth / 2 + 0.02] as [number, number, number], s: [width + 0.15, 0.2, 0.04] as [number, number, number] },
        { pos: [0, 0.18, -depth / 2 - 0.02] as [number, number, number], s: [width + 0.15, 0.2, 0.04] as [number, number, number] },
        { pos: [width / 2 + 0.02, 0.18, 0] as [number, number, number], s: [0.04, 0.2, depth + 0.15] as [number, number, number] },
        { pos: [-width / 2 - 0.02, 0.18, 0] as [number, number, number], s: [0.04, 0.2, depth + 0.15] as [number, number, number] },
      ].map((w, i) => (
        <mesh key={i} position={w.pos}>
          <boxGeometry args={w.s} />
          <meshStandardMaterial color="#999" />
        </mesh>
      ))}
    </group>
  );
}

/* ── Ground Plane ── */
function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial color="#E8E5DE" />
    </mesh>
  );
}

/* ── Animated building group ── */
function BuildingGroup({ visuals, tilt }: { visuals: FloorData[]; tilt: number }) {
  const groupRef = useRef<THREE.Group>(null);

  // Gentle idle rotation
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.05;
    }
  });

  const bWidth = 4;
  const bDepth = 2.5;
  const floorScale = 1.3; // scale SVG floor heights to 3D

  // Accumulate floor positions
  const floorPositions = useMemo(() => {
    let cy = 0;
    return visuals.map((v) => {
      const h = (v.floorH / 100) * floorScale;
      const pos = cy;
      cy += h;
      return { y: pos, h };
    });
  }, [visuals, floorScale]);

  const totalH = floorPositions.reduce((s, fp) => Math.max(s, fp.y + fp.h), 0);
  const tiltRad = (tilt * Math.PI) / 180;

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <group rotation={[0, 0, tiltRad]}>
        {/* Foundation */}
        <mesh position={[0, -0.1, 0]}>
          <boxGeometry args={[bWidth + 0.3, 0.2, bDepth + 0.3]} />
          <meshStandardMaterial color="#666" />
        </mesh>

        {/* Floors */}
        {visuals.map((v, i) => {
          const fp = floorPositions[i];
          if (!fp) return null;
          // Slight width variation per floor based on wF
          const fw = bWidth * Math.max(0.7, v.wF);
          const tiltOffset = i * tiltRad * 0.15;
          return (
            <FloorBlock
              key={v.fi}
              y={fp.y}
              width={fw}
              height={fp.h}
              depth={bDepth}
              damage={v.damage}
              stability={v.floor.stability}
              isGround={i === 0}
              tiltX={tiltOffset}
            />
          );
        })}

        {/* Roof */}
        <Roof y={totalH} width={bWidth * Math.max(0.7, visuals[visuals.length - 1]?.wF ?? 1)} depth={bDepth} />
      </group>

      <Ground />
    </group>
  );
}

/* ── Main 3D Canvas ── */
export default function Building3DView({ floors, visuals, tilt }: Building3DProps) {
  const totalH = visuals.reduce((s, v) => s + (v.floorH / 100) * 1.3, 0);
  const camY = totalH / 2;

  return (
    <div style={{ width: "100%", height: "85vh", background: "#F5F3EE" }}>
      <Canvas
        camera={{
          position: [6, camY + 2, 6],
          fov: 40,
          near: 0.1,
          far: 100,
        }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => gl.setClearColor("#F5F3EE")}
      >
        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[8, 12, 5]} intensity={1.2} />
        <directionalLight position={[-5, 8, -3]} intensity={0.3} />
        <hemisphereLight args={["#b1e1ff", "#b97a20", 0.3]} />

        {/* Building */}
        <BuildingGroup visuals={visuals} tilt={tilt} />

        {/* Controls */}
        <OrbitControls
          target={[0, camY, 0]}
          enablePan
          enableZoom
          enableRotate
          minDistance={3}
          maxDistance={20}
          maxPolarAngle={Math.PI / 2.1}
        />
      </Canvas>
    </div>
  );
}
