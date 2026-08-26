"use client";

import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Canvas } from "@react-three/fiber";
import { BlendFunction, KernelSize } from "postprocessing";
import { useMemo } from "react";
import * as THREE from "three";
import type { GlobeLayer } from "@/lib/db/queries";
import { Atmosphere } from "./Atmosphere";
import { Halo } from "./Halo";
import { LeaderMarkers } from "./LeaderMarkers";
import { CameraRig } from "./CameraRig";
import { Earth } from "./Earth";
import { Starfield } from "./Starfield";
import { ViewOffset } from "./ViewOffset";

function isCoarsePointer(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

export function GlobeScene({ layers }: { layers: GlobeLayer[] }) {
  // Mobile GPUs choke on full-resolution bloom; drop the heavy passes there
  // rather than shipping a globe that stutters on a phone.
  const lowPower = useMemo(() => isCoarsePointer(), []);

  return (
    <Canvas
      dpr={lowPower ? 1 : [1, 1.75]}
      camera={{ position: [0, 0.42, 3.55], fov: 40, near: 0.1, far: 120 }}
      gl={{
        antialias: !lowPower,
        alpha: true,
        powerPreference: "high-performance",
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
      }}
    >
      <Starfield count={lowPower ? 700 : 1800} />

      <Earth layers={layers} />
      <LeaderMarkers layers={layers} />

      {/* One tight shell for the crisp limb, plus a quad-based halo. A second
          shell would draw a hard ring in mid-air at its own radius. */}
      <Atmosphere radius={1.015} intensity={0.34} power={5.5} />
      <Halo size={4.6} intensity={0.42} falloff={6.5} />

      <CameraRig />
      <ViewOffset />

      {!lowPower && (
        <EffectComposer>
          <Bloom
            intensity={0.55}
            luminanceThreshold={0.52}
            luminanceSmoothing={0.28}
            kernelSize={KernelSize.LARGE}
            mipmapBlur
          />
          <Vignette
            offset={0.28}
            darkness={0.72}
            blendFunction={BlendFunction.NORMAL}
          />
        </EffectComposer>
      )}
    </Canvas>
  );
}
