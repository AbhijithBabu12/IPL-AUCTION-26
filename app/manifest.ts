import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SFL — St. Thomas Fantasy League",
    short_name: "SFL",
    description:
      "Live fantasy IPL auction game. Build your IPL squad through real-time player auctions, manage your purse, and track results.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0f",
    theme_color: "#0a0a0f",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/images/sfl.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
    categories: ["games", "sports", "entertainment"],
    lang: "en",
  };
}
