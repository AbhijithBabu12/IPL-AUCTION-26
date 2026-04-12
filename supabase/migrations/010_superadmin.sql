-- Migration: 010_superadmin.sql
-- Adds global admin tier above room admins.
-- Global admin controls all score fetching; room admins retain auction management.

-- 1. Add is_superadmin flag to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_superadmin boolean NOT NULL DEFAULT false;

-- To grant superadmin access to an internal team member, run:
-- UPDATE public.users SET is_superadmin = true WHERE email = 'your@email.com';

-- 2. Global match results table
-- One row per match × source. Global admin accepts a row → it propagates to all rooms.
CREATE TABLE IF NOT EXISTS public.global_match_results (
  id                uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id          text         NOT NULL,
  match_date        date,
  season            text         NOT NULL,
  teams             text[]       DEFAULT '{}',
  source            text         NOT NULL,        -- 'cricsheet' | 'rapidapi' | 'cricketdata' | 'atd'
  source_label      text,
  player_stats      jsonb        NOT NULL DEFAULT '{}',
  calculated_points jsonb        DEFAULT '{}',
  accepted          boolean      DEFAULT false,   -- global admin must accept before pushing
  accepted_at       timestamptz,
  pushed_at         timestamptz,                  -- when this row was last pushed to all rooms
  created_at        timestamptz  DEFAULT now()
);

-- Unique: one global row per match per source
CREATE UNIQUE INDEX IF NOT EXISTS global_match_results_match_source_idx
  ON public.global_match_results (match_id, source);

CREATE INDEX IF NOT EXISTS global_match_results_season_idx
  ON public.global_match_results (season);

CREATE INDEX IF NOT EXISTS global_match_results_accepted_idx
  ON public.global_match_results (accepted);

-- RLS: only service role (server) and superadmins can read/write
ALTER TABLE public.global_match_results ENABLE ROW LEVEL SECURITY;

-- Superadmins get full access via authenticated client
CREATE POLICY "Superadmin full access" ON public.global_match_results
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_superadmin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_superadmin = true
    )
  );
