"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { readToken } from "@/lib/metrics/scales";

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

/**
 * A back-faced shell slightly larger than the globe, additively blended.
 * Because we only draw its inside surface, the fresnel term peaks exactly at
 * the planet's limb — which is what reads as atmosphere rather than as a
 * blurry ring stuck behind a sphere.
 */
const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uPower;

  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), uPower);
    gl_FragColor = vec4(uColor, 1.0) * fres * uIntensity;
  }
`;

export function Atmosphere({
  radius = 1.16,
  intensity = 1.05,
  power = 3.0,
  token = "--accent",
}: {
  radius?: number;
  intensity?: number;
  power?: number;
  token?: string;
}) {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(readToken(token, "#4cc9f0")) },
      uIntensity: { value: intensity },
      uPower: { value: power },
    }),
    [intensity, power, token],
  );

  return (
    <mesh scale={radius}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
