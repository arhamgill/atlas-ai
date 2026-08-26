"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { useGlobeStore } from "@/lib/state/globe";

/** Matches the panel's max-w-[340px]. */
const PANEL_WIDTH = 340;
/** Below this the panel is full-width, so there is nothing to make room for. */
const MIN_WIDTH_FOR_OFFSET = 640;

/**
 * Slides the globe clear of the country panel.
 *
 * Flying a country to the centre of the viewport puts it directly behind the
 * panel that just opened to describe it. Rather than skewing the orbit — which
 * would fight the camera rig and distort the flight — this shifts the camera's
 * projection window with setViewOffset. The globe stays perfectly round, the
 * orbit maths is untouched, and because raycasting goes through the same
 * projection matrix, picking stays exact while the offset is applied.
 */
export function ViewOffset() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const selected = useGlobeStore((s) => s.selected);

  const current = useRef(0);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30);

    const wanted = selected && size.width >= MIN_WIDTH_FOR_OFFSET ? PANEL_WIDTH / 2 : 0;

    // Frame-rate independent easing, tuned to land alongside the panel's
    // 350ms slide rather than racing it.
    const t = 1 - Math.pow(0.0009, delta);
    current.current += (wanted - current.current) * t;

    if (Math.abs(current.current) < 0.25) {
      current.current = 0;
      if (camera.view?.enabled) {
        camera.clearViewOffset();
        camera.updateProjectionMatrix();
      }
      return;
    }

    camera.setViewOffset(
      size.width,
      size.height,
      current.current,
      0,
      size.width,
      size.height,
    );
    camera.updateProjectionMatrix();
  });

  return null;
}
