"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { GlobeLayer } from "@/lib/db/queries";
import { drawChoropleth, drawMask } from "@/lib/geo/render-maps";
import { vector3ToLatLng } from "@/lib/geo/sphere";
import { findCountryAt, getCountryFeatures } from "@/lib/geo/topology";
import { buildColorScale, readToken } from "@/lib/metrics/scales";
import { useGlobeStore } from "@/lib/state/globe";

/** 2048x1024 is ~5.7px per degree of longitude — comfortably sharper than the
 *  globe ever renders on screen, and 8 MB per layer instead of 33 MB at 4K. */
const MAP_WIDTH = 2048;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uMapA;
  uniform sampler2D uMapB;
  uniform sampler2D uMask;
  uniform float uMix;
  uniform float uTime;
  uniform vec3 uAccent;
  uniform vec3 uLightDir;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vec3 base = mix(texture2D(uMapA, vUv).rgb, texture2D(uMapB, vUv).rgb, uMix);

    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);

    // This is a data map, not a planet simulation: a realistic terminator
    // sinks half the choropleth into unreadable black. Keep a shallow
    // gradient purely for form, never enough to hide a value.
    float ndl = dot(N, normalize(uLightDir)) * 0.5 + 0.5;
    float light = 0.80 + 0.34 * pow(ndl, 1.2);

    // Rim light along the limb — most of the "planet in space" read.
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.2);

    // Slight gamma lift: the ramps are dark by design, and without this the
    // low end of every scale collapses into the ocean.
    vec3 color = pow(base, vec3(0.88)) * light;
    color += uAccent * fres * 0.22;

    // Hover (red channel) and selection (green channel) glow.
    vec3 mask = texture2D(uMask, vUv).rgb;
    float hover = mask.r;
    float selected = mask.g;
    float edge = mask.b;

    // Emphasis comes from the OUTLINE, not from flooding the fill. A country
    // that loses its own colour when selected stops showing its own value,
    // which is the one thing the user selected it to see.
    color += uAccent * hover * 0.09;
    color += uAccent * selected * 0.15;
    color += uAccent * edge * 0.80;
    color *= 1.0 + 0.22 * max(hover, selected);

    // A slow meridian sweep. Very low amplitude — texture, not decoration.
    float sweep = smoothstep(0.985, 1.0, sin(vUv.x * 6.2831 - uTime * 0.22) * 0.5 + 0.5);
    color += uAccent * sweep * 0.05 * light;

    gl_FragColor = vec4(color, 1.0);
  }
`;

function canvasTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function Earth({ layers }: { layers: GlobeLayer[] }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const gl = useThree((s) => s.gl);

  const layerIndex = useGlobeStore((s) => s.layerIndex);
  const hovered = useGlobeStore((s) => s.hovered);
  const selected = useGlobeStore((s) => s.selected);
  const setHovered = useGlobeStore((s) => s.setHovered);
  const setSelected = useGlobeStore((s) => s.setSelected);
  const setPointer = useGlobeStore((s) => s.setPointer);
  const setReady = useGlobeStore((s) => s.setReady);

  const features = useMemo(() => getCountryFeatures(), []);

  // One texture per layer, painted once. Switching layers is then a uniform
  // crossfade rather than a repaint.
  const textures = useMemo(() => {
    const anisotropy = gl.capabilities.getMaxAnisotropy();
    // A touch above the page background, so the globe reads as an object
    // sitting in space rather than a hole cut out of the page.
    const ocean = "#0b0f16";
    const noData = readToken("--no-data", "#22262c");
    const border = "rgba(255,255,255,0.16)";
    const graticule = "rgba(255,255,255,0.045)";

    return layers.map((layer) => {
      const valueByIso3 = new Map(layer.rows.map((r) => [r[0], r[1]]));
      const scale = buildColorScale(
        layer.layer,
        layer.unit,
        layer.rows.map((r) => r[1]),
      );
      const canvas = drawChoropleth({
        features,
        valueByIso3,
        color: scale,
        noDataColor: noData,
        oceanColor: ocean,
        borderColor: border,
        graticuleColor: graticule,
        width: MAP_WIDTH,
      });
      return canvasTexture(canvas, anisotropy);
    });
  }, [layers, features, gl]);

  const maskTexture = useMemo(() => {
    const canvas = drawMask(features, null, null, 1024);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.NoColorSpace;
    return tex;
  }, [features]);

  const uniforms = useMemo(
    () => ({
      uMapA: { value: textures[0] ?? null },
      uMapB: { value: textures[0] ?? null },
      uMask: { value: maskTexture },
      uMix: { value: 0 },
      uTime: { value: 0 },
      uAccent: { value: new THREE.Color(readToken("--accent", "#4cc9f0")) },
      uLightDir: { value: new THREE.Vector3(1, 0.35, 0.7).normalize() },
    }),
    [textures, maskTexture],
  );

  useEffect(() => setReady(true), [setReady]);

  useEffect(() => {
    return () => {
      for (const t of textures) t.dispose();
      maskTexture.dispose();
    };
  }, [textures, maskTexture]);

  // Repaint the hover/selection mask only when it actually changes.
  useEffect(() => {
    const canvas = drawMask(features, hovered, selected, 1024);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.NoColorSpace;
    const material = materialRef.current;
    if (!material) {
      tex.dispose();
      return;
    }
    const previous = material.uniforms["uMask"]?.value as THREE.Texture | undefined;
    if (material.uniforms["uMask"]) material.uniforms["uMask"].value = tex;
    if (previous && previous !== maskTexture) previous.dispose();
    return () => {
      if (material.uniforms["uMask"]?.value === tex) return;
      tex.dispose();
    };
  }, [features, hovered, selected, maskTexture]);

  // Crossfade to the newly selected layer.
  const fadeTarget = useRef(layerIndex);
  useEffect(() => {
    const material = materialRef.current;
    const next = textures[layerIndex];
    if (!material || !next) return;
    const uMapA = material.uniforms["uMapA"];
    const uMapB = material.uniforms["uMapB"];
    const uMix = material.uniforms["uMix"];
    if (!uMapA || !uMapB || !uMix) return;

    // Freeze whatever is on screen into slot A, then fade slot B in.
    uMapA.value = uMix.value > 0.5 ? uMapB.value : uMapA.value;
    uMapB.value = next;
    uMix.value = 0;
    fadeTarget.current = layerIndex;
  }, [layerIndex, textures]);

  useFrame((_, delta) => {
    const material = materialRef.current;
    if (!material) return;
    const uTime = material.uniforms["uTime"];
    const uMix = material.uniforms["uMix"];
    if (uTime) uTime.value += delta;
    if (uMix && uMix.value < 1) {
      uMix.value = Math.min(1, uMix.value + delta * 1.6);
    }
  });

  const lastHover = useRef<string | null>(null);

  return (
    <mesh
      onPointerMove={(e) => {
        e.stopPropagation();
        setPointer(e.clientX, e.clientY);
        const p = e.point;
        const { lat, lng } = vector3ToLatLng(p.x, p.y, p.z);
        const iso3 = findCountryAt(lng, lat)?.iso3 ?? null;
        if (iso3 !== lastHover.current) {
          lastHover.current = iso3;
          setHovered(iso3);
          document.body.style.cursor = iso3 ? "pointer" : "grab";
        }
      }}
      onPointerOut={() => {
        lastHover.current = null;
        setHovered(null);
        document.body.style.cursor = "auto";
      }}
      onClick={(e) => {
        e.stopPropagation();
        const p = e.point;
        const { lat, lng } = vector3ToLatLng(p.x, p.y, p.z);
        const iso3 = findCountryAt(lng, lat)?.iso3 ?? null;
        if (iso3) setSelected(iso3);
      }}
    >
      <sphereGeometry args={[1, 128, 128]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}
