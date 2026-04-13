/**
 * lib/server/settings.ts
 *
 * Superadmin-controlled app settings stored in `app_settings` table.
 * Results are Redis-cached (30s TTL) and invalidated on write.
 */
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { cacheGet, cacheSet, cacheDel } from "@/lib/server/redis";

export interface FeatureFlags {
  /** When false, the "Update Scores" button is hidden from regular room members. */
  user_score_fetch: boolean;
}

const FEATURE_FLAGS_KEY = "feature_flags";
const FLAGS_CACHE_KEY = "app:feature-flags";
const FLAGS_CACHE_TTL = 30; // seconds — short so changes propagate within half a minute

const DEFAULTS: FeatureFlags = {
  user_score_fetch: true,
};

export async function getFeatureFlags(): Promise<FeatureFlags> {
  // 1. Redis hit — skip DB entirely
  const cached = await cacheGet<FeatureFlags>(FLAGS_CACHE_KEY);
  if (cached !== null) return cached;

  // 2. DB read
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", FEATURE_FLAGS_KEY)
    .maybeSingle();

  const flags: FeatureFlags = data?.value
    ? { ...DEFAULTS, ...(data.value as Partial<FeatureFlags>) }
    : { ...DEFAULTS };

  // 3. Warm the cache
  await cacheSet(FLAGS_CACHE_KEY, flags, FLAGS_CACHE_TTL);
  return flags;
}

export async function setFeatureFlag<K extends keyof FeatureFlags>(
  flag: K,
  value: FeatureFlags[K],
): Promise<void> {
  const admin = getSupabaseAdminClient();
  const current = await getFeatureFlags();
  const next = { ...current, [flag]: value };

  await admin
    .from("app_settings")
    .upsert({ key: FEATURE_FLAGS_KEY, value: next, updated_at: new Date().toISOString() });

  // Immediately evict the Redis cache so the next read goes to DB
  await cacheDel(FLAGS_CACHE_KEY);
}
