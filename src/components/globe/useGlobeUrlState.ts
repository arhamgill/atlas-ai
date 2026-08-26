"use client";

import { useQueryStates } from "nuqs";
import { parseAsString } from "nuqs/server";
import { useEffect, useRef } from "react";
import type { GlobeLayer } from "@/lib/db/queries";
import { useGlobeStore } from "@/lib/state/globe";

/**
 * Mirrors the globe's view into the URL, so any state is a shareable link:
 *
 *   /?layer=investment&country=BRA
 *
 * History is replaced rather than pushed. Holding an arrow key walks the
 * ranking a country at a time, and pushing each step would bury the back
 * button under a hundred entries.
 *
 * The URL wins on first load; after that the store drives and the URL follows.
 */
export function useGlobeUrlState(layers: GlobeLayer[]) {
  const [params, setParams] = useQueryStates(
    { layer: parseAsString, country: parseAsString },
    { history: "replace" },
  );

  const layerIndex = useGlobeStore((s) => s.layerIndex);
  const selected = useGlobeStore((s) => s.selected);
  const setLayer = useGlobeStore((s) => s.setLayer);
  const setSelected = useGlobeStore((s) => s.setSelected);
  const markInteracted = useGlobeStore((s) => s.markInteracted);

  // --- URL -> store, once, on first load ----------------------------------
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current || layers.length === 0) return;
    hydrated.current = true;

    const wantedLayer = layers.findIndex((l) => l.layer === params.layer);
    if (wantedLayer >= 0) setLayer(wantedLayer);

    const iso3 = params.country?.toUpperCase();
    if (iso3) {
      const target = wantedLayer >= 0 ? layers[wantedLayer] : layers[0];
      // Only honour a country the data actually knows about, so a hand-edited
      // URL can't leave the panel stuck open on nothing.
      if (target?.rows.some((r) => r[0] === iso3)) {
        setSelected(iso3);
        // A deep link is someone arriving at a specific view, not idling —
        // don't spin the globe out from under them.
        markInteracted();
      }
    }
  }, [layers, params.layer, params.country, setLayer, setSelected, markInteracted]);

  // --- store -> URL --------------------------------------------------------
  useEffect(() => {
    if (!hydrated.current) return;
    const layerKey = layers[layerIndex]?.layer ?? null;
    const nextLayer = layerIndex === 0 ? null : layerKey;
    if (params.layer === nextLayer && params.country === selected) return;
    void setParams({ layer: nextLayer, country: selected });
  }, [layerIndex, selected, layers, params.layer, params.country, setParams]);
}
