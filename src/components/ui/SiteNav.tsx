"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Globe" },
  { href: "/countries", label: "Countries" },
  { href: "/compare", label: "Compare" },
  { href: "/about", label: "About" },
] as const;

/**
 * One bar across every route.
 *
 * It floats over the globe rather than pushing it down — the globe is meant to
 * fill the viewport — so the bar has no background of its own and relies on a
 * gradient scrim for legibility over bright land.
 */
export function SiteNav() {
  const pathname = usePathname();

  return (
    <header
      className="pointer-events-none fixed inset-x-0 top-0 z-50"
      style={{ viewTransitionName: "site-header" }}
    >
      <div className="absolute inset-0 h-20 bg-gradient-to-b from-[var(--bg-base)] via-[color-mix(in_srgb,var(--bg-base)_70%,transparent)] to-transparent" />

      <nav
        aria-label="Primary"
        className="relative mx-auto flex h-14 w-full max-w-[var(--shell-max)] items-center justify-between px-4 sm:px-8"
      >
        <Link
          href="/"
          className="text-2xs pointer-events-auto tracking-[0.24em] text-[var(--text-secondary)] uppercase transition-colors hover:text-[var(--text-primary)]"
        >
          AI&nbsp;Atlas
        </Link>

        <ul className="pointer-events-auto flex items-center gap-1 sm:gap-2">
          <li className="mr-1 hidden sm:block">
            <button
              onClick={() =>
                window.dispatchEvent(
                  new KeyboardEvent("keydown", { key: "k", metaKey: true }),
                )
              }
              aria-label="Open search"
              className="text-2xs flex items-center gap-2 rounded-[var(--radius)] border border-[var(--border-subtle)] px-2.5 py-1.5 text-[var(--text-tertiary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)]"
            >
              <span aria-hidden>⌕</span>
              <kbd className="numeric text-[10px]">⌘K</kbd>
            </button>
          </li>
          {LINKS.map((link) => {
            const active =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className="text-2xs relative block rounded-[var(--radius)] px-2.5 py-1.5 tracking-[0.14em] uppercase transition-colors sm:px-3"
                  style={{
                    color: active ? "var(--text-primary)" : "var(--text-tertiary)",
                    transitionDuration: "var(--dur-ui)",
                  }}
                >
                  {link.label}
                  {active && (
                    <span
                      className="absolute inset-x-2.5 -bottom-0.5 h-px sm:inset-x-3"
                      style={{ background: "var(--accent)" }}
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
