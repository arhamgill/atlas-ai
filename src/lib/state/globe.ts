import { create } from "zustand";

export interface GlobeState {
  /** Index into the layers array. */
  layerIndex: number;
  hovered: string | null;
  selected: string | null;
  /** Screen position for the hover tooltip. */
  pointer: { x: number; y: number };
  /** Suppresses idle auto-rotation once the user takes control. */
  interacted: boolean;
  ready: boolean;
  /** The opening camera flight has landed. */
  introDone: boolean;

  setLayer: (i: number) => void;
  setHovered: (iso3: string | null) => void;
  setSelected: (iso3: string | null) => void;
  setPointer: (x: number, y: number) => void;
  markInteracted: () => void;
  setReady: (v: boolean) => void;
  finishIntro: () => void;
}

export const useGlobeStore = create<GlobeState>((set) => ({
  layerIndex: 0,
  hovered: null,
  selected: null,
  pointer: { x: 0, y: 0 },
  interacted: false,
  ready: false,
  introDone: false,

  setLayer: (layerIndex) => set({ layerIndex }),
  setHovered: (hovered) => set({ hovered }),
  setSelected: (selected) => set({ selected }),
  setPointer: (x, y) => set({ pointer: { x, y } }),
  markInteracted: () => set({ interacted: true }),
  setReady: (ready) => set({ ready }),
  finishIntro: () => set({ introDone: true }),
}));
