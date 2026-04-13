-- 012_app_settings.sql
-- Global key-value store for superadmin-controlled feature flags and settings.

CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT        PRIMARY KEY,
  value       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the feature_flags row with all flags defaulting to enabled.
INSERT INTO app_settings (key, value)
VALUES ('feature_flags', '{"user_score_fetch": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;
