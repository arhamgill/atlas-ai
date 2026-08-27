"use client";

import type { ReactNode } from "react";
import { useInView } from "./useInView";

/**
 * Fades and lifts a block into place the first time it is scrolled to.
 *
 * CSS transitions rather than an animation library — this wraps ordinary page
 * content, and pulling a runtime in for a fade would put it on every route that
 * uses it. Durations come from the motion tokens, which already collapse to 1ms
 * under prefers-reduced-motion, and the hook reports "in view" immediately in
 * that case so nothing is ever gated behind an animation that will not play.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  /** Stagger, in ms. Keep small — past ~120ms a grid feels sluggish. */
  delay?: number;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "none" : "translateY(10px)",
        transition: `opacity var(--dur-panel) var(--ease) ${delay}ms, transform var(--dur-panel) var(--ease) ${delay}ms`,
        willChange: inView ? "auto" : "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}
