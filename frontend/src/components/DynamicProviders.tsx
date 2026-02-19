'use client';

import dynamic from "next/dynamic";

// Dynamic import to prevent SSR issues with localStorage
export const Providers = dynamic(
  () => import("./ClientProviders").then((mod) => mod.ClientProviders),
  { ssr: false }
);
