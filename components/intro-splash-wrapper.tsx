"use client";

import dynamic from "next/dynamic";

const IntroSplash = dynamic(() => import("./intro-splash"), { ssr: false });

export default function IntroSplashWrapper() {
  return <IntroSplash />;
}
