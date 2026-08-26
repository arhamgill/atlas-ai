"use client";

import { useEffect } from "react";
import type { GlobeLayer } from "@/lib/db/queries";
import { useGlobeStore } from "@/lib/state/globe";

/**
 * Keyboard control for the globe.
 *
 * Two jobs at once. It is the accessibility path — the plan requires every
 * country to be reachable without a mouse — and it is the fastest way to
 * actually read the data: holding an arrow key walks the leaderboard, flying
 * the camera country by country down the ranking.
 *
 *   1-4          switch layer
 *   arrow keys   step through the ranking, camera follows
 *   Home / End   jump to first / last rank
 *   Escape       close the panel
 */
export function useGlobeKeyboard(layers: GlobeLayer[]) {
  const layerIndex = useGlobeStore((s) => s.layerIndex);
  const selected = useGlobeStore((s) => s.selected);
  const setLayer = useGlobeStore((s) => s.setLayer);
  const setSelected = useGlobeStore((s) => s.setSelected);
  const markInteracted = useGlobeStore((s) => s.markInteracted);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Never hijack typing in a field, or a browser/OS shortcut.
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Escape") {
        if (selected) {
          e.preventDefault();
          setSelected(null);
        }
        return;
      }

      // 1-4 select a layer.
      if (/^[1-9]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        if (i < layers.length) {
          e.preventDefault();
          setLayer(i);
        }
        return;
      }

      const layer = layers[layerIndex];
      if (!layer) return;

      // Ranked walk. Sorting a copy keeps the payload order untouched.
      const ranked = [...layer.rows].sort((a, b) => a[2] - b[2]);
      if (ranked.length === 0) return;

      const step = (delta: number) => {
        e.preventDefault();
        markInteracted();
        const at = selected ? ranked.findIndex((r) => r[0] === selected) : -1;
        // From nothing, either direction should land somewhere sensible.
        const next =
          at === -1
            ? delta > 0
              ? 0
              : ranked.length - 1
            : (at + delta + ranked.length) % ranked.length;
        const row = ranked[next];
        if (row) setSelected(row[0]);
      };

      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          step(1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          step(-1);
          break;
        case "Home":
          e.preventDefault();
          markInteracted();
          if (ranked[0]) setSelected(ranked[0][0]);
          break;
        case "End": {
          e.preventDefault();
          markInteracted();
          const last = ranked[ranked.length - 1];
          if (last) setSelected(last[0]);
          break;
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [layers, layerIndex, selected, setLayer, setSelected, markInteracted]);
}
