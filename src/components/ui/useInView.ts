"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./useReducedMotion";

/**
 * True once the element has been scrolled into view, and true from then on.
 *
 * Deliberately one-way: re-hiding content when it leaves the viewport makes a
 * page feel unstable and replays every animation on the way back up.
 *
 * Returns true immediately when the user prefers reduced motion, so content is
 * never gated behind an animation that will not play.
 */
export function useInView<T extends HTMLElement>(rootMargin = "-12% 0px") {
  const ref = useRef<T>(null);
  const reduced = useReducedMotion();
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // setState from an observer callback is asynchronous, not a synchronous
        // set during the effect body, so it does not cascade renders.
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduced, rootMargin]);

  return { ref, inView: reduced || seen };
}
