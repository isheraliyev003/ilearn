"use client";

import { API_PATHS } from "@ilearn/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { fetchCurrentUser, topicQueryKeys } from "@/lib/topic-queries";

type NavItem = {
  href: string;
  label: string;
};

function buildNavItems(topicId?: string): NavItem[] {
  const items: NavItem[] = [{ href: "/topics", label: "Topics" }];

  if (topicId) {
    items.push(
      { href: `/topics/${topicId}`, label: "Words" },
      { href: `/topics/${topicId}/quiz`, label: "Quiz" },
    );
  }

  return items;
}

function isNavActive(pathname: string, item: NavItem, topicId?: string): boolean {
  if (item.href === "/topics") {
    return pathname === "/topics";
  }
  if (!topicId) return false;
  if (item.href.endsWith("/quiz")) {
    return pathname === `/topics/${topicId}/quiz`;
  }
  return pathname === `/topics/${topicId}`;
}

function userInitials(fullName: string | undefined): string {
  if (!fullName?.trim()) return "?";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function NavIcon({ name }: { name: "topics" | "words" | "quiz" }) {
  const common = "h-4 w-4 shrink-0";
  if (name === "topics") {
    return (
      <svg
        className={common}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M4 11h6V4H4v7zM14 11h6V4h-6v7zM4 20h6v-7H4v7zM14 20h6v-7h-6v7z" />
      </svg>
    );
  }
  if (name === "words") {
    return (
      <svg
        className={common}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <path d="M8 7h8" />
        <path d="M8 11h8" />
      </svg>
    );
  }
  return (
    <svg
      className={common}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function navIconName(href: string): "topics" | "words" | "quiz" {
  if (href === "/topics") return "topics";
  if (href.endsWith("/quiz")) return "quiz";
  return "words";
}

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname() ?? "/topics";
  const params = useParams<{ topicId?: string }>();
  const queryClient = useQueryClient();
  const topicId =
    typeof params?.topicId === "string" ? params.topicId : undefined;

  const [scrolled, setScrolled] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  const currentUserQuery = useQuery({
    queryKey: topicQueryKeys.currentUser,
    queryFn: fetchCurrentUser,
  });

  const logout = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(API_PATHS.authLogout, {
        method: "POST",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to sign out");
      }
    },
    onSuccess: () => {
      queryClient.clear();
      router.replace("/auth");
    },
  });

  const navItems = buildNavItems(topicId);
  const user = currentUserQuery.data;
  const initials = userInitials(user?.fullName);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!accountOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (
        accountRef.current &&
        !accountRef.current.contains(e.target as Node)
      ) {
        setAccountOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAccountOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

  const navLinkClass = (active: boolean) =>
    `group inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
      active
        ? "bg-indigo-500/20 text-white shadow-inner shadow-indigo-950/40 ring-1 ring-indigo-400/25"
        : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
    }`;

  return (
    <header
      className={`sticky top-0 z-40 border-b backdrop-blur-xl transition-[box-shadow,border-color] duration-300 ${
        scrolled
          ? "border-white/12 bg-slate-950/88 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.55)]"
          : "border-white/[0.08] bg-slate-950/70"
      }`}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="flex h-[3.25rem] items-center gap-3 sm:h-14 sm:gap-4">
          <Link
            href="/topics"
            className="flex min-w-0 shrink-0 items-center gap-2.5 rounded-2xl outline-none transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:gap-3"
            aria-label="ilearn — Home"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/12 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.32),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.35),transparent_50%),linear-gradient(145deg,rgba(30,41,59,0.96),rgba(15,23,42,0.98))] text-white shadow-lg shadow-indigo-950/35 ring-1 ring-white/10 sm:h-11 sm:w-11">
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="h-[1.15rem] w-[1.15rem] sm:h-5 sm:w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 6.5C5 5.67 5.67 5 6.5 5H18v13H8.25A3.25 3.25 0 0 0 5 21.25V6.5Z" />
                <path d="M18 18H8.25A3.25 3.25 0 0 0 5 21.25" />
                <path d="M9 9h5.5" />
                <path d="M9 12h4" />
              </svg>
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-200/95">
                ilearn
              </p>
              <p className="text-[13px] leading-tight text-slate-400">
                Vocabulary studio
              </p>
            </div>
          </Link>

          <nav
            className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex"
            aria-label="Primary"
          >
            {navItems.map((item) => {
              const active = isNavActive(pathname, item, topicId);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={navLinkClass(active)}
                >
                  <NavIcon name={navIconName(item.href)} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="min-w-0 flex-1 lg:hidden" aria-hidden />

          <div className="relative flex shrink-0 items-center" ref={accountRef}>
            <button
              type="button"
              onClick={() => setAccountOpen((o) => !o)}
              className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] py-1.5 pl-1.5 pr-2.5 text-left outline-none transition hover:border-white/18 hover:bg-white/[0.09] focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:gap-3 sm:pl-2 sm:pr-3"
              aria-expanded={accountOpen}
              aria-haspopup="menu"
              aria-label="Account menu"
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400/90 to-indigo-600/90 text-xs font-bold text-white shadow-md shadow-indigo-950/40 ring-1 ring-white/15"
                aria-hidden
              >
                {initials}
              </span>
              <span className="hidden max-w-[10rem] min-w-0 sm:block">
                <span className="block truncate text-sm font-medium text-white">
                  {user?.fullName ?? "Account"}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {user?.email ?? "Signed in"}
                </span>
              </span>
              <svg
                className={`hidden h-4 w-4 shrink-0 text-slate-500 transition sm:block ${accountOpen ? "rotate-180" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {accountOpen && (
              <div
                className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-white/12 bg-slate-950/95 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl ring-1 ring-white/5"
                role="menu"
                aria-label="Account actions"
              >
                <div className="border-b border-white/8 px-3 py-2.5 sm:hidden">
                  <p className="truncate text-sm font-medium text-white">
                    {user?.fullName ?? "Account"}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {user?.email ?? ""}
                  </p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  disabled={logout.isPending}
                  onClick={() => {
                    setAccountOpen(false);
                    logout.mutate();
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-200 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg
                    className="h-4 w-4 text-slate-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" x2="9" y1="12" y2="12" />
                  </svg>
                  {logout.isPending ? "Signing out…" : "Sign out"}
                </button>
              </div>
            )}
          </div>
        </div>

        <nav
          className="flex snap-x snap-mandatory gap-1.5 overflow-x-auto pb-3 pt-0.5 [-ms-overflow-style:none] [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden"
          aria-label="Primary"
        >
          {navItems.map((item) => {
            const active = isNavActive(pathname, item, topicId);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`${navLinkClass(active)} shrink-0 snap-start`}
              >
                <NavIcon name={navIconName(item.href)} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {logout.isError && (
          <p
            className="mb-3 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100"
            role="alert"
          >
            {logout.error instanceof Error
              ? logout.error.message
              : "Could not sign out"}
          </p>
        )}
      </div>
    </header>
  );
}
