"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * Deterministic PRNG (mulberry32).
 *
 * Math.random() is impure and the React Compiler rejects it during render —
 * correctly, since an unlucky re-render would reshuffle every star. A seeded
 * generator is pure, and the sky is identical on every load.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Depth cue behind the globe. Deliberately dim — stars that read as "stars"
 * pull attention off the data; these exist so the black isn't flat.
 */
export function Starfield({
  count = 1800,
  radius = 42,
  seed = 20260825,
}: {
  count?: number;
  radius?: number;
  seed?: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const { positions, sizes, phases } = useMemo(() => {
    const rand = mulberry32(seed);
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // acos keeps the distribution uniform instead of bunching at the poles.
      const theta = Math.acos(2 * rand() - 1);
      const phi = rand() * Math.PI * 2;
      const r = radius * (0.65 + rand() * 0.35);

      positions[i * 3] = r * Math.sin(theta) * Math.cos(phi);
      positions[i * 3 + 1] = r * Math.cos(theta);
      positions[i * 3 + 2] = r * Math.sin(theta) * Math.sin(phi);

      // Mostly faint, a handful bright.
      sizes[i] = rand() < 0.06 ? 0.16 + rand() * 0.13 : 0.04 + rand() * 0.07;
      phases[i] = rand() * Math.PI * 2;
    }
    return { positions, sizes, phases };
  }, [count, radius, seed]);

  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((_, delta) => {
    // Update through the ref, not the memoized object: mutating a value that
    // was handed to a hook is exactly what the immutability rule forbids.
    const material = materialRef.current;
    if (material?.uniforms["uTime"]) material.uniforms["uTime"].value += delta;
    if (pointsRef.current) pointsRef.current.rotation.y += delta * 0.004;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={
          /* glsl */ `
          attribute float aSize;
          attribute float aPhase;
          uniform float uTime;
          varying float vAlpha;

          void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            vAlpha = 0.72 + 0.28 * sin(uTime * 0.7 + aPhase);
            gl_PointSize = aSize * 220.0 / -mvPosition.z;
          }
        `
        }
        fragmentShader={
          /* glsl */ `
          varying float vAlpha;
          void main() {
            float r = length(gl_PointCoord - vec2(0.5));
            if (r > 0.5) discard;
            gl_FragColor = vec4(vec3(0.82, 0.88, 1.0), smoothstep(0.5, 0.0, r) * vAlpha * 0.85);
          }
        `
        }
      />
    </points>
  );
}
