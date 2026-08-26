"use client";

import {
  type CSSProperties,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(callback: () => void): () => void {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

/**
 * Reads the motion preference as an external store rather than into state via
 * an effect, so it is correct on the very first render and never causes a
 * cascading re-render.
 */
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

/** Matches --ease in tokens.css. */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

interface Props {
  value: number;
  format: (v: number) => string;
  durationMs?: number;
  className?: string;
  style?: CSSProperties;
}

function Counting({ value, format, durationMs = 600, className, style }: Props) {
  const [display, setDisplay] = useState(value);
  const frameRef = useRef<number | null>(null);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    const started = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / durationMs);
      const current = from + (to - from) * easeOutCubic(t);
      fromRef.current = current;
      setDisplay(current);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        frameRef.current = null;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [value, durationMs]);

  return (
    <span className={className} style={style}>
      {format(display)}
    </span>
  );
}

/**
 * Counts a figure up to its new value instead of swapping it instantly.
 *
 * This is why every numeric in the design system uses Geist Mono with tabular
 * figures: in a proportional face the digits change width as they count and
 * the whole number shudders. With tabular figures each digit occupies a fixed
 * cell, so only the glyphs change.
 *
 * Interruption is handled by animating from whatever is currently on screen,
 * so switching countries mid-count never jumps backwards.
 */
export function AnimatedNumber(props: Props) {
  const reduced = useReducedMotion();

  if (reduced || props.durationMs === 0) {
    return (
      <span className={props.className} style={props.style}>
        {props.format(props.value)}
      </span>
    );
  }
  return <Counting {...props} />;
}
