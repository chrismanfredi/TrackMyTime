"use client";

import Link from "next/link";
import type { Route } from "next";

export type DashboardNavItem = {
  label: string;
  href: Route;
  active?: boolean;
};

type DashboardShellProps = {
  navigation: DashboardNavItem[];
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: string;
  navActiveLabel?: string;
  actions?: React.ReactNode;
  languageSelector?: React.ReactNode;
};

export function DashboardShell({
  navigation,
  children,
  title,
  subtitle,
  badge,
  navActiveLabel,
  actions,
  languageSelector,
}: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl">
        <div className="flex flex-1 flex-col lg:flex-row">
          <aside className="hidden w-full max-w-[240px] flex-col border-r border-zinc-200 bg-zinc-50/75 px-6 py-8 lg:flex">
            <div className="mb-8">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                TrackMyTime
              </span>
              <h1 className="mt-2 text-xl font-semibold text-zinc-900">
                Admin Center
              </h1>
              {languageSelector ? <div className="mt-4">{languageSelector}</div> : null}
            </div>
            <nav className="flex flex-1 flex-col gap-1">
              {navigation.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition ${
                    item.active
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200/50"
                      : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
                >
                  <span>{item.label}</span>
                  {item.active && (navActiveLabel || badge) ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-white/70">
                      {navActiveLabel ?? badge}
                    </span>
                  ) : null}
                </Link>
              ))}
            </nav>
          </aside>

          <div className="flex flex-1 flex-col">
            <header className="flex flex-col gap-4 border-b border-zinc-200 bg-white px-6 py-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-500">
                  {badge ?? "Dashboard"}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-zinc-900">
                  {title}
                </h2>
                {subtitle ? (
                  <p className="text-sm text-zinc-500">{subtitle}</p>
                ) : null}
              </div>
              {actions ? (
                <div className="flex w-full flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  {actions}
                </div>
              ) : null}
            </header>

            <div className="flex-1 overflow-y-auto bg-zinc-50 px-6 py-10 sm:px-10">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
