"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ReactNode } from "react";

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return <ClerkProvider>{children}</ClerkProvider>;
}
