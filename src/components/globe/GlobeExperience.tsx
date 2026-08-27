"use client";

import dynamic from "next/dynamic";
import type { GlobeLayer } from "@/lib/db/queries";
import { useGlobeStore } from "@/lib/state/globe";
import { GlobeHud, type CountryMeta } from "./GlobeHud";
import { useGlobeKeyboard } from "./useGlobeKeyboard";
import { useGlobeUrlState } from "./useGlobeUrlState";

/**
 * three.js is ~600 KB and touches `window` at import time, so the scene is
 * client-only and code-split away from every other route's bundle.
 */
const GlobeScene = dynamic(() => import("./GlobeScene").then((m) => m.GlobeScene), {
  ssr: false,
});

export function GlobeExperience({
  layers,
  countries,
}: {
  layers: GlobeLayer[];
  countries: CountryMeta[];
}) {
  const ready = useGlobeStore((s) => s.ready);
  const selected = useGlobeStore((s) => s.selected);

  useGlobeKeyboard(layers);
  useGlobeUrlState(layers);

  return (
    <div className="relative h-[100svh] w-full overflow-hidden">
      {/* Ambient wash behind the globe so the canvas edge never reads as a seam. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 55% at 50% 45%, color-mix(in srgb, var(--accent) 8%, transparent) 0%, transparent 70%)",
        }}
      />

      <GlobeScene layers={layers} />

      {/* Fades in once the first frame is on screen, so nothing pops. */}
      {/* pointer-events-none is load-bearing: this div covers the whole canvas,
          and without it the globe receives no hover or click at all. Individual
          HUD pieces opt back in with pointer-events-auto. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: ready ? 1 : 0,
          transition: "opacity 700ms var(--ease)",
        }}
      >
        <GlobeHud layers={layers} countries={countries} />
      </div>

      {!ready && (
        <div className="absolute inset-0 z-40 grid place-items-center">
          <p className="numeric text-2xs animate-pulse tracking-[0.24em] text-[var(--text-tertiary)] uppercase">
            Rendering globe
          </p>
        </div>
      )}

      {!selected && (
        <p className="numeric text-2xs pointer-events-none absolute top-20 right-8 z-10 hidden tracking-[0.14em] text-[var(--text-tertiary)] uppercase sm:block">
          Drag to rotate · 1-4 layers · ← → ranking
        </p>
      )}
    </div>
  );
}
