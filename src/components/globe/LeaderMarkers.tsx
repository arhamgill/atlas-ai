"use client";

import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { geoCentroid } from "d3-geo";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { GlobeLayer } from "@/lib/db/queries";
import { latLngToVector3 } from "@/lib/geo/sphere";
import { getCountryFeatures } from "@/lib/geo/topology";
import { formatMetric } from "@/lib/metrics/scales";
import { useGlobeStore } from "@/lib/state/globe";

/**
 * How many ranked countries to label. Past this the pills collide over Europe
 * and the map stops being readable — and a phone runs out of room far sooner
 * than a desktop does.
 */
function leaderCount(width: number): number {
  return width < 640 ? 3 : 5;
}

interface Rect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Rectangles claimed so far this frame, in rank order.
 *
 * Module-level rather than a ref threaded through props: there is exactly one
 * globe per page, and the React Compiler (rightly) forbids mutating something
 * handed in as a prop or hook argument.
 */
const occupied: Rect[] = [];

function intersects(a: Rect, b: Rect): boolean {
  return !(
    a.right < b.left ||
    a.left > b.right ||
    a.bottom < b.top ||
    a.top > b.bottom
  );
}

/**
 * Clears the claimed-rectangle list at the top of every frame.
 *
 * Mounted before the markers so its useFrame callback runs first — R3F invokes
 * them in registration order, which is mount order, which is rank order.
 */
function ClearOccupied() {
  useFrame(() => {
    occupied.length = 0;
  });
  return null;
}

interface Leader {
  iso3: string;
  name: string;
  value: number;
  rank: number;
  position: THREE.Vector3;
}

function useLeaders(layer: GlobeLayer | undefined, count: number): Leader[] {
  return useMemo(() => {
    if (!layer) return [];
    const features = getCountryFeatures();
    const byIso3 = new Map(features.filter((f) => f.iso3).map((f) => [f.iso3!, f]));

    return [...layer.rows]
      .sort((a, b) => a[2] - b[2])
      .slice(0, count)
      .flatMap((row) => {
        const feature = byIso3.get(row[0]);
        if (!feature) return [];
        const [lng, lat] = geoCentroid(feature);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
        const [x, y, z] = latLngToVector3(lat, lng, 1.015);
        return [
          {
            iso3: row[0],
            name: feature.name,
            value: row[1],
            rank: row[2],
            position: new THREE.Vector3(x, y, z),
          },
        ];
      });
  }, [layer, count]);
}

/** Vertical nudges tried, in order, before a label gives up and hides. */
const NUDGES = [0, -22, 22, -44, 44];

function Marker({
  leader,
  unit,
  precision,
}: {
  leader: Leader;
  unit: string;
  precision: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const camera = useThree((s) => s.camera);
  const setSelected = useGlobeStore((s) => s.setSelected);

  const normal = useMemo(() => leader.position.clone().normalize(), [leader.position]);
  const toCamera = useMemo(() => new THREE.Vector3(), []);
  const offsetRef = useRef(0);

  useFrame(() => {
    const el = wrapRef.current;
    if (!el) return;

    // Hide markers on the far side, and fade them as they approach the limb —
    // a label sliding off the edge of a sphere looks broken.
    toCamera.copy(camera.position).normalize();
    const facing = normal.dot(toCamera);
    const opacity = THREE.MathUtils.clamp((facing - 0.15) / 0.28, 0, 1);

    if (opacity <= 0.01) {
      el.style.opacity = "0";
      el.style.pointerEvents = "none";
      return;
    }

    // Labels are placed in rank order, so the highest-ranked country always
    // keeps its natural position and lower ranks move out of its way. Without
    // this, neighbours like Germany and the United Kingdom overlap into an
    // unreadable stack.
    const box = el.getBoundingClientRect();
    const height = box.height || 22;
    const width = box.width || 120;
    const baseTop = box.top - offsetRef.current;

    let placed = false;
    for (const nudge of NUDGES) {
      const candidate: Rect = {
        top: baseTop + nudge,
        bottom: baseTop + nudge + height,
        left: box.left,
        right: box.left + width,
      };
      if (occupied.some((r) => intersects(candidate, r))) continue;
      occupied.push(candidate);
      offsetRef.current = nudge;
      placed = true;
      break;
    }

    if (!placed) {
      // Every slot taken: yield entirely rather than stack.
      el.style.opacity = "0";
      el.style.pointerEvents = "none";
      return;
    }

    el.style.transform = `translateY(${offsetRef.current}px)`;
    el.style.opacity = String(opacity);
    // Never let a barely-visible label intercept a click meant for the globe.
    el.style.pointerEvents = opacity > 0.6 ? "auto" : "none";
  });

  return (
    <Html
      position={leader.position}
      center
      zIndexRange={[15, 10]}
      style={{ pointerEvents: "none" }}
    >
      <div ref={wrapRef} style={{ opacity: 0 }}>
        <button
          onClick={() => setSelected(leader.iso3)}
          className="group flex -translate-y-1/2 cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-[color-mix(in_srgb,var(--bg-raised)_88%,transparent)] py-1 pr-2.5 pl-1.5 whitespace-nowrap backdrop-blur-sm transition-colors hover:border-[var(--accent)]"
        >
          <span
            className="numeric grid size-4 place-items-center rounded-full text-[9px] leading-none text-[var(--text-inverse)]"
            style={{ background: "var(--accent)" }}
          >
            {leader.rank}
          </span>
          <span className="text-[11px] leading-none font-medium text-[var(--text-primary)]">
            {leader.name}
          </span>
          <span className="numeric text-[11px] leading-none text-[var(--text-secondary)]">
            {formatMetric(leader.value, unit, precision)}
          </span>
        </button>
      </div>
    </Html>
  );
}

/**
 * Labels the top-ranked countries for the active layer directly on the globe.
 *
 * Without these the globe is a pretty colour field: you can see that somewhere
 * is dark teal but not that it is the United Arab Emirates at 70%.
 */
export function LeaderMarkers({ layers }: { layers: GlobeLayer[] }) {
  const layerIndex = useGlobeStore((s) => s.layerIndex);
  const introDone = useGlobeStore((s) => s.introDone);
  const size = useThree((s) => s.size);
  const layer = layers[layerIndex];
  const leaders = useLeaders(layer, leaderCount(size.width));

  // Holding them back during the opening flight keeps the arrival clean.
  if (!layer || !introDone) return null;

  return (
    <>
      <ClearOccupied />
      {leaders.map((leader) => (
        <Marker
          key={`${layer.key}-${leader.iso3}`}
          leader={leader}
          unit={layer.unit}
          precision={layer.precision}
        />
      ))}
    </>
  );
}
