-- Migration 013: Remove super room concept
--
-- The super room was a private admin sandbox isolated from all global operations.
-- All features (Live Score Sync, Cricsheet Sync) are now available to every room.
-- This migration removes the is_super_room column from the rooms table.
--
-- Run in Supabase SQL Editor or via: supabase db push

ALTER TABLE rooms DROP COLUMN IF EXISTS is_super_room;
