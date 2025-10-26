"use client";

import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import { useDashboardNav } from "@/hooks/use-dashboard-nav";

export function AppHeader() {
  const { user } = useUser();
  const { open } = useDashboardNav();
  const displayName =
    user?.fullName ??
    user?.username ??
    user?.primaryEmailAddress?.emailAddress ??
    "Team member";

  return (
    <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3 text-sm">
      <span className="font-semibold text-zinc-800">TrackMyTime</span>
      <div className="flex items-center gap-3">
        <SignedOut>
          <SignInButton mode="modal">
            <button className="rounded-lg border border-indigo-200 bg-white px-3 py-1 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50">
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="rounded-lg bg-indigo-600 px-3 py-1 text-sm font-medium text-white transition hover:bg-indigo-500">
              Sign up
            </button>
          </SignUpButton>
        </SignedOut>
        <SignedIn>
          <span className="hidden rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 sm:inline-flex">
            {displayName}
          </span>
          <UserButton />
          <button
            type="button"
            onClick={open}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 text-zinc-600 transition hover:border-indigo-300 hover:text-indigo-600 lg:hidden"
            aria-label="Open navigation menu"
          >
            <span className="sr-only">Open navigation</span>
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" />
            </svg>
          </button>
        </SignedIn>
      </div>
    </header>
  );
}
