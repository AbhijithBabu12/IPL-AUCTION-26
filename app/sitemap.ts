import type { MetadataRoute } from "next";

const base =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  "https://sfl.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${base}/login`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.4,
    },
  ];
}
