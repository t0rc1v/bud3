"use client";

import dynamic from "next/dynamic";

const LandingPage = dynamic(
  () => import("@/components/landing/landing-hero").then(m => ({ default: m.LandingPage })),
  { ssr: false }
);

export default function Page() {
  return <LandingPage />;
}
