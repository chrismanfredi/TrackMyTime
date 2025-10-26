"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ReactNode } from "react";

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  const publishableKey =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    process.env.CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "Clerk publishable key is missing. ClerkProvider will not be initialized.",
      );
    }
    return <>{children}</>;
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>{children}</ClerkProvider>
  );
}
