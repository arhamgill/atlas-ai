"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SearchEntry } from "@/lib/db/queries";

interface Item {
  id: string;
  /** First item of its group, so it carries the heading. */
  startsGroup?: boolean;
  label: string;
  hint?: string;
  group: string;
  href: string;
}

const NAV: Item[] = [
  { id: "nav-globe", label: "Globe", group: "Go to", href: "/" },
  { id: "nav-countries", label: "All countries", group: "Go to", href: "/countries" },
  { id: "nav-compare", label: "Compare countries", group: "Go to", href: "/compare" },
  { id: "nav-about", label: "About this project", group: "Go to", href: "/about" },
];

const LAYERS: Item[] = [
  {
    id: "l-adoption",
    label: "Adoption",
    group: "Globe layer",
    href: "/?layer=adoption",
  },
  {
    id: "l-investment",
    label: "Investment",
    group: "Globe layer",
    href: "/?layer=investment",
  },
  {
    id: "l-development",
    label: "Development",
    group: "Globe layer",
    href: "/?layer=development",
  },
  {
    id: "l-research",
    label: "Research",
    group: "Globe layer",
    href: "/?layer=research",
  },
];

/**
 * Rank a candidate against the query.
 *
 * Prefix beats word-start beats substring, so typing "ind" surfaces India
 * ahead of British Indian Ocean Territory. Returns -1 for no match.
 */
function score(text: string, query: string): number {
  const t = text.toLowerCase();
  const i = t.indexOf(query);
  if (i === -1) return -1;
  if (i === 0) return 0;
  return t[i - 1] === " " ? 1 : 2;
}

/**
 * Global search, opened with Cmd/Ctrl-K.
 *
 * Animated with CSS rather than a motion library on purpose: this component
 * lives in the root layout, so anything it imports is downloaded on every
 * route. Using Motion here put 121 KB on pages with no animation at all — the
 * About page was paying for an animation runtime to render static prose.
 *
 * The dialog therefore stays mounted and toggles `inert` plus opacity, which
 * keeps the exit transition working without a JS animation runtime while
 * keeping it out of the tab order and the accessibility tree when closed.
 */
export function CommandPalette({ countries }: { countries: SearchEntry[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const countryItems: Item[] = countries.map((c) => ({
      id: `c-${c.iso3}`,
      label: c.name,
      hint: `${c.iso3}${c.region ? ` · ${c.region}` : ""}`,
      group: "Country",
      href: `/countries/${c.iso3.toLowerCase()}`,
    }));

    const withHeadings = (list: Item[]): Item[] =>
      list.map((item, i) => ({
        ...item,
        startsGroup: item.group !== list[i - 1]?.group,
      }));

    if (!q) return withHeadings([...NAV, ...LAYERS, ...countryItems.slice(0, 8)]);

    const ranked = [...NAV, ...LAYERS, ...countryItems]
      .map((item) => {
        const s = Math.min(
          ...[score(item.label, q), item.hint ? score(item.hint, q) : -1]
            .filter((v) => v >= 0)
            .concat([99]),
        );
        return { item, s };
      })
      .filter((r) => r.s < 99)
      .sort((a, b) => a.s - b.s || a.item.label.localeCompare(b.item.label));

    return withHeadings(ranked.slice(0, 30).map((r) => r.item));
  }, [query, countries]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setCursor(0);
  }, []);

  const go = useCallback(
    (item: Item | undefined) => {
      if (!item) return;
      close();
      router.push(item.href);
    },
    [close, router],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (!open) return;

      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(items.length - 1, c + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        go(items[cursor]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, items, cursor, close, go]);

  // Focus has to wait for the commit that clears `inert`: a requestAnimationFrame
  // scheduled during the state update still runs while the subtree is inert, and
  // focus() on an inert element is silently ignored — which left every keystroke
  // going nowhere.
  useEffect(() => {
    if (!open) return;
    // One frame later, so the commit that clears `inert` has been applied.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  return (
    <div
      inert={!open}
      aria-hidden={!open}
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]"
      style={{
        opacity: open ? 1 : 0,
        // pointer-events rather than visibility: a visibility:hidden element
        // cannot take focus, and the style recalc had not landed by the time the
        // open effect ran, so focus() was silently dropped and every keystroke
        // went nowhere. `inert` already handles the tab order and a11y tree.
        pointerEvents: open ? "auto" : "none",
        transition: "opacity var(--dur-ui) var(--ease)",
      }}
    >
      <button
        aria-label="Close search"
        onClick={close}
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--bg-base)_72%,transparent)] backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="relative w-full max-w-lg overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg-raised)] shadow-2xl"
        style={{
          transform: open ? "translateY(0) scale(1)" : "translateY(-8px) scale(0.98)",
          transition: "transform var(--dur-ui-slow) var(--ease)",
        }}
      >
        <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-4">
          <span aria-hidden className="text-[var(--text-tertiary)]">
            ⌕
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            placeholder="Search countries, layers, pages…"
            aria-label="Search"
            className="w-full bg-transparent py-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
          />
          <kbd className="numeric rounded border border-[var(--border-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--text-tertiary)]">
            esc
          </kbd>
        </div>

        <ul ref={listRef} className="max-h-[52vh] overflow-y-auto py-1.5">
          {items.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">
              Nothing matches “{query}”.
            </li>
          )}
          {items.map((item, i) => (
            <li key={item.id}>
              {item.startsGroup && (
                <p className="text-2xs px-4 pt-3 pb-1 tracking-[0.16em] text-[var(--text-tertiary)] uppercase">
                  {item.group}
                </p>
              )}
              <button
                data-index={i}
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(item)}
                className="flex w-full items-baseline gap-3 px-4 py-2 text-left"
                style={{
                  background: i === cursor ? "var(--bg-overlay)" : "transparent",
                }}
              >
                <span
                  className="text-sm"
                  style={{
                    color:
                      i === cursor ? "var(--text-primary)" : "var(--text-secondary)",
                  }}
                >
                  {item.label}
                </span>
                {item.hint && (
                  <span className="numeric text-2xs text-[var(--text-tertiary)]">
                    {item.hint}
                  </span>
                )}
                {i === cursor && (
                  <span
                    aria-hidden
                    className="text-2xs ml-auto text-[var(--text-tertiary)]"
                  >
                    ↵
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
