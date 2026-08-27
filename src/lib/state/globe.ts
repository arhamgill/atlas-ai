import { create } from "zustand";

export interface GlobeState {
  /** Index into the layers array. */
  layerIndex: number;
  /**
   * Index into the active layer's `periods`, or -1 for "latest".
   *
   * Held as -1 rather than a number so switching to a layer with a different
   * number of periods lands on its most recent value instead of whatever
   * position happened to be selected on the previous layer.
   */
  periodIndex: number;
  hovered: string | null;
  selected: string | null;
  /** Screen position for the hover tooltip. */
  pointer: { x: number; y: number };
  /** Suppresses idle auto-rotation once the user takes control. */
  interacted: boolean;
  /** performance.now() of the last deliberate interaction; 0 = never. */
  lastInteraction: number;
  ready: boolean;
  /** The opening camera flight has landed. */
  introDone: boolean;

  setLayer: (i: number) => void;
  setPeriod: (i: number) => void;
  setHovered: (iso3: string | null) => void;
  setSelected: (iso3: string | null) => void;
  setPointer: (x: number, y: number) => void;
  markInteracted: () => void;
  setReady: (v: boolean) => void;
  finishIntro: () => void;
}

export const useGlobeStore = create<GlobeState>((set) => ({
  layerIndex: 0,
  periodIndex: -1,
  hovered: null,
  selected: null,
  pointer: { x: 0, y: 0 },
  interacted: false,
  lastInteraction: 0,
  ready: false,
  introDone: false,

  // Changing layer resets to the latest period: a year that exists on one
  // layer may not exist on the next.
  setLayer: (layerIndex) => set({ layerIndex, periodIndex: -1 }),
  setPeriod: (periodIndex) => set({ periodIndex }),
  setHovered: (hovered) => set({ hovered }),
  setSelected: (selected) => set({ selected }),
  setPointer: (x, y) => set({ pointer: { x, y } }),
  markInteracted: () => set({ interacted: true, lastInteraction: performance.now() }),
  setReady: (ready) => set({ ready }),
  finishIntro: () => set({ introDone: true }),
}));
