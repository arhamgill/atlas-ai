"use client";

import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { geoCentroid } from "d3-geo";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { latLngToVector3 } from "@/lib/geo/sphere";
import { getCountryFeatures } from "@/lib/geo/topology";
import { useGlobeStore } from "@/lib/state/globe";

type Controls = { update: () => void; autoRotate: boolean; target: THREE.Vector3 };

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Orbit controls plus a damped flight to whichever country is selected.
 *
 * The globe mesh itself never rotates — the camera orbits instead. That keeps
 * world space and globe space identical, so a raycast hit can be converted
 * straight to lat/lng without unwinding a rotation.
 */
export function CameraRig() {
  const controlsRef = useRef<Controls | null>(null);
  const camera = useThree((s) => s.camera);

  const selected = useGlobeStore((s) => s.selected);
  const interacted = useGlobeStore((s) => s.interacted);
  const markInteracted = useGlobeStore((s) => s.markInteracted);

  const flightTarget = useRef<THREE.Vector3 | null>(null);
  const flying = useRef(false);

  useEffect(() => {
    if (!selected) {
      flying.current = false;
      return;
    }
    const feature = getCountryFeatures().find((f) => f.iso3 === selected);
    if (!feature) return;

    const [lng, lat] = geoCentroid(feature);
    const distance = camera.position.length();
    const [x, y, z] = latLngToVector3(lat, lng, distance);
    const target = new THREE.Vector3(x, y, z);

    if (prefersReducedMotion()) {
      camera.position.copy(target);
      controlsRef.current?.update();
      flying.current = false;
      return;
    }

    flightTarget.current = target;
    flying.current = true;
  }, [selected, camera]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    // Idle presentation: rotate until the user takes over, then never again.
    controls.autoRotate = !interacted && !selected;

    if (flying.current && flightTarget.current) {
      // Frame-rate independent damping, so the flight feels the same at 60
      // and 144 Hz.
      const t = 1 - Math.pow(0.0016, delta);
      camera.position.lerp(flightTarget.current, t);
      if (camera.position.distanceTo(flightTarget.current) < 0.004) {
        camera.position.copy(flightTarget.current);
        flying.current = false;
      }
    }

    controls.update();
  });

  return (
    <OrbitControls
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={controlsRef as any}
      enablePan={false}
      enableDamping
      dampingFactor={0.055}
      rotateSpeed={0.42}
      zoomSpeed={0.6}
      minDistance={1.9}
      maxDistance={6.0}
      autoRotateSpeed={0.32}
      onStart={() => {
        flying.current = false;
        markInteracted();
      }}
    />
  );
}
