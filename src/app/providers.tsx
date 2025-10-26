"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ReactNode } from "react";
import { DashboardNavProvider } from "@/hooks/use-dashboard-nav";

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  const publishableKey =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    process.env.CLERK_PUBLISHABLE_KEY;

  return (
    <ClerkProvider
      publishableKey={
        publishableKey ??
        (process.env.NODE_ENV !== "production"
          ? "pk_test_missing_publishable_key"
          : (() => {
              throw new Error(
                "Clerk publishable key is required in production environment.",
              );
            })())
      }
    >
      <DashboardNavProvider>{children}</DashboardNavProvider>
    </ClerkProvider>
  );
}
