"use client";

import { Billboard } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { readToken } from "@/lib/metrics/scales";

/**
 * The outer glow.
 *
 * A back-faced sphere shell seems like the obvious way to do atmosphere, but
 * its fresnel term peaks at the SHELL's limb, which draws a hard circle in
 * mid-air at the shell radius. Two shells draw two rings.
 *
 * A camera-facing quad with an analytic radial falloff has no silhouette of
 * its own, so the halo fades to nothing smoothly. Drawn first with depth
 * testing off, so the globe composites cleanly on top.
 */
const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uInner;
  uniform float uFalloff;

  varying vec2 vUv;

  void main() {
    float r = length(vUv - 0.5) * 2.0;

    // Exponential decay outward from the globe's edge. Must be monotonic:
    // any inward ramp meeting the outward one peaks at the silhouette and
    // draws a bright ring instead of a glow.
    float d = max(r - uInner, 0.0) / (1.0 - uInner);
    float a = exp(-d * uFalloff);

    // Kill everything inside the globe; it is occluded anyway, and letting it
    // accumulate washes the map out through bloom.
    a *= step(uInner * 0.98, r);

    gl_FragColor = vec4(uColor, 1.0) * a * uIntensity;
  }
`;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export function Halo({
  size = 4.2,
  intensity = 1.5,
  falloff = 3.4,
}: {
  size?: number;
  intensity?: number;
  falloff?: number;
}) {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(readToken("--accent", "#4cc9f0")) },
      uIntensity: { value: intensity },
      // Globe radius is 1; the quad half-width is size/2.
      uInner: { value: 1 / (size / 2) },
      uFalloff: { value: falloff },
    }),
    [intensity, size, falloff],
  );

  return (
    <Billboard renderOrder={-1}>
      <mesh scale={size}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </Billboard>
  );
}
