/**
 * Fallback orchestrator — only RapidAPI Cricbuzz is supported.
 *
 * Tier 1: RapidAPI Cricbuzz  (RAPIDAPI_KEY)
 */

import { fetchIPLMatchesFromRapidAPI } from "./rapidapi";
import type { NormalizedMatch } from "./parser";

export type { NormalizedMatch, PlayerMatchStats } from "./parser";
export type WebscrapeProviderId = "rapidapi";

export interface FetchResult {
  matches: NormalizedMatch[];
  source: WebscrapeProviderId;
  errors: Record<string, string>;
}

const PROVIDER_LABELS: Record<WebscrapeProviderId, string> = {
  rapidapi: "RapidAPI / Cricbuzz",
};

function isProviderConfigured(provider: WebscrapeProviderId): boolean {
  switch (provider) {
    case "rapidapi":
      return Boolean(process.env.RAPIDAPI_KEY || process.env.RAPIDAPI_KEY_2);
  }
}

export function getProviderLabel(provider: WebscrapeProviderId): string {
  return PROVIDER_LABELS[provider];
}

export async function fetchIPLMatchesFromProvider(
  provider: WebscrapeProviderId,
  season: string,
  onProgress?: (done: number, total: number, source: string) => void,
): Promise<FetchResult> {
  if (!isProviderConfigured(provider)) {
    throw new Error(`${getProviderLabel(provider)} is not configured`);
  }

  switch (provider) {
    case "rapidapi": {
      const matches = await fetchIPLMatchesFromRapidAPI(season, (d, t) =>
        onProgress?.(d, t, getProviderLabel(provider)),
      );
      return { matches, source: provider, errors: {} };
    }
  }
}

export async function fetchIPLMatchesWithFallback(
  season: string,
  onProgress?: (done: number, total: number, source: string) => void,
): Promise<FetchResult> {
  const errors: Record<string, string> = {};

  // RapidAPI Cricbuzz
  if (process.env.RAPIDAPI_KEY) {
    try {
      const matches = await fetchIPLMatchesFromRapidAPI(season, (d, t) =>
        onProgress?.(d, t, "RapidAPI"),
      );
      return { matches, source: "rapidapi", errors };
    } catch (e) {
      errors["rapidapi"] = String(e);
    }
  } else {
    errors["rapidapi"] = "RAPIDAPI_KEY not set";
  }

  throw new Error(
    `All cricket data providers failed:\n${Object.entries(errors)
      .map(([k, v]) => `  ${k}: ${v}`)
      .join("\n")}`,
  );
}

/** Which API keys are currently configured (for UI display). */
export function availableProviders(): Array<{ id: string; label: string; configured: boolean }> {
  return [
    {
      id: "rapidapi",
      label: PROVIDER_LABELS.rapidapi,
      configured: isProviderConfigured("rapidapi"),
    },
    {
      id: "cricsheet",
      label: "Cricsheet (ball-by-ball)",
      configured: true, // always available — no API key required
    },
  ];
}
