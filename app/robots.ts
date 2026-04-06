import type { MetadataRoute } from "next";

const base =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  "https://sfl.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login"],
        disallow: [
          "/lobby",
          "/room/",
          "/auction/",
          "/results/",
          "/api/",
          "/auth/",
          "/todos",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
