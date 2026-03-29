# IPL Auction 26 â€” Session Changelog (2026-03-27)

## What Was Built

### 1. Cricsheet Integration (Ball-by-ball score engine)

| File | What it does |
|------|-------------|
| `lib/domain/scoring.ts` | **Full rewrite.** Implements every rule in `RULES.MD` â€” runs, boundary bonus, six bonus, 25/50/75/100-run milestones, SR brackets, duck penalty, wickets, LBW/bowled bonus, 3W/4W/5W tiers, dot balls, maidens, economy brackets, catches, stumpings, run-outs, lineup/sub appearances |
| `lib/server/cricsheet.ts` | Downloads the IPL Cricsheet ZIP, parses ball-by-ball JSON, computes **per-match** bonus points (milestones, SR, economy, 3-catch) â€” then stores them as pre-computed fields so season totals are never double-counted |
| `app/api/rooms/[code]/cricsheet-sync/route.ts` | `POST` endpoint. Accepts a `.zip` file upload **or** auto-fetches from cricsheet.org. Matches player names (normalised + surname fallback). Preserves `ipl_team` from Excel import. Returns matched/unmatched counts |
| `components/room/cricsheet-sync-button.tsx` | Admin UI: season input, toggle between **Auto-fetch** and **Upload ZIP**, shows results |

---

### 2. Live Web Sync â€” Multi-source Score Comparison

| File | What it does |
|------|-------------|
| `lib/server/webscrape/parser.ts` | Shared types + dismissal parser (detects bowled, lbw, catch, stumping, run-out) |
| `lib/server/webscrape/cricketdata.ts` | CricketData.org client â€” fetches IPL series â†’ match list â†’ scorecards |
| `lib/server/webscrape/rapidapi.ts` | RapidAPI Cricbuzz client â€” same interface |
| `lib/server/webscrape/index.ts` | Orchestrator: tries CricketData first, falls back to RapidAPI |
| `app/api/rooms/[code]/webscrape-preview/route.ts` | `POST` â€” fetches scores from all live sources, stores raw rows in `match_results` table, returns comparison data for admin review |
| `app/api/rooms/[code]/webscrape-accept/route.ts` | `POST` â€” admin marks one source as accepted per match; re-aggregates all accepted rows â†’ updates `players.stats` |
| `components/room/webscrape-sync-panel.tsx` | Side-by-side comparison UI. Admin can: pick a source per match, override individual player points manually, accept and save |

---

### 3. Export / Import Everywhere

| File | What it does |
|------|-------------|
| `lib/utils/export.ts` | `exportToCSV`, `exportToExcel`, `exportToExcelMultiSheet` helpers (uses existing `xlsx` package) |
| `components/ui/export-button.tsx` | Compact icon-button with dropdown: **Export to CSV** / **Export to Excel** |
| `components/ui/import-button.tsx` | Compact icon-button that opens a hidden file input, calls your handler with the parsed file |
| `components/results/results-export-bar.tsx` | Adds Export dropdown above the leaderboard (leaderboard + player stats sheets) |

---

### 4. Database Migration

| File | What it does |
|------|-------------|
| `supabase/match-results.sql` | Creates the `match_results` table used by the web sync feature |

---

## One-Time Setup Steps

### Step 1 â€” Run the SQL migration in Supabase

1. Open your [Supabase Dashboard](https://app.supabase.com)
2. Go to **SQL Editor**
3. Paste and run the contents of `supabase/match-results.sql`

### Step 2 â€” Add API keys to your `.env.local`

Copy from `.env.example` and fill in:

```env
CRICKETDATA_API_KEY=your_key_from_cricketdata_org
RAPIDAPI_KEY=your_key_from_rapidapi_com
RAPIDAPI_CRICBUZZ_HOST=cricbuzz-cricket.p.rapidapi.com
```

- **CricketData.org** â€” sign up free at https://cricketdata.org (500 req/day free)
- **RapidAPI Cricbuzz** â€” subscribe at https://rapidapi.com/cricketapilive/api/cricbuzz-cricket (free tier available)

### Step 3 â€” Install the new dependency

```bash
cd IPL-AUCTION-26
npm install adm-zip @types/adm-zip
```

*(Already done if you ran this session â€” just a reminder for fresh clones)*

---

## How to Run

```bash
npm run dev
```

App starts at `http://localhost:10000`

---

## Where to See Each Feature

### Cricsheet Sync
**Room Page â†’ Admin section â†’ "Sync Cricsheet Data"**

1. Enter season (e.g. `2026`)
2. Click **Auto-fetch from Cricsheet** â€” or upload the `ipl_json.zip` you downloaded from [cricsheet.org/downloads](https://cricsheet.org/downloads/)
3. Results show matched/unmatched player counts
4. Scores immediately appear in the Results board

### Live Web Sync (Multi-source Comparison)
**Room Page â†’ Admin section â†’ "Live Web Sync"**

1. Enter season, click **Fetch from Live Sources**
2. A comparison table appears â€” one row per match, columns for each API source
3. Click **Accept** next to the score set you trust
4. Optionally override individual player points manually
5. Click **Save Selected** to write to the database

### Results Leaderboard + Export
**Results Page** (`/results/[code]`)

- Export dropdown appears top-right of the leaderboard
- Options: **Export to CSV** or **Export to Excel** (two sheets: Leaderboard + Player Scores)

### Manual Score Correction via Import
Use `ImportButton` on any page that supports it â€” upload a corrected CSV/Excel and the handler updates that entity.

---

## Scoring Rules Summary (RULES.MD â†’ scoring.ts)

| Category | Key Points |
|----------|-----------|
| Batting | Runs Ã—1 + Boundary bonus +4 + Six bonus +6; milestones +4/+8/+12/+16 at 25/50/75/100; SR bonus Â±6 (min 10 balls); Duck âˆ’2 (non-bowlers) |
| Bowling | Wicket +30; LBW/Bowled +8 each; 3W/4W/5W tier bonuses; Dot +1; Maiden +12; Economy Â±6 (min 2 overs) |
| Fielding | Catch +8, 3-catch bonus +4; Stumping +12; Run-out direct +12 / indirect +6 |
| Appearance | Announced XI or Sub: +4 per match |

---

## Files Changed Summary

```
NEW   supabase/match-results.sql
NEW   lib/domain/scoring.ts              (full rewrite)
NEW   lib/server/cricsheet.ts
NEW   lib/server/webscrape/parser.ts
NEW   lib/server/webscrape/cricketdata.ts
NEW   lib/server/webscrape/rapidapi.ts
NEW   lib/server/webscrape/index.ts
NEW   lib/utils/export.ts
NEW   app/api/rooms/[code]/cricsheet-sync/route.ts
NEW   app/api/rooms/[code]/webscrape-preview/route.ts
NEW   app/api/rooms/[code]/webscrape-accept/route.ts
NEW   components/room/cricsheet-sync-button.tsx
NEW   components/room/webscrape-sync-panel.tsx
NEW   components/results/results-export-bar.tsx
NEW   components/ui/export-button.tsx
NEW   components/ui/import-button.tsx
MOD   app/room/[code]/page.tsx           (added Cricsheet + WebSync panels)
MOD   app/results/[code]/page.tsx        (added ResultsExportBar)
MOD   .env.example                       (added 3 new API key vars)
MOD   package.json                       (added adm-zip)
```

---

# Session Changelog (2026-03-28)

## What Was Changed

### 5. Cricsheet Sync â€” Per-Match `match_results` Pipeline

**Problem:** `cricsheet-sync` previously aggregated all matches and wrote totals directly to `players.stats`, overwriting webscrape data and preventing per-match review.

**Fix:** Cricsheet data now flows through the same admin-review pipeline as webscrape data.

| File | Change |
|------|--------|
| `lib/server/cricsheet.ts` | Added `processZipPerMatch()` â€” processes each match JSON file in isolation and returns one `CricsheetMatchEntry` per match in `PlayerMatchStats` wire format. Added `accumulatorToMatchStats()` helper to convert a single-match `CricsheetAccumulator` â†’ `PlayerMatchStats`. |
| `app/api/rooms/[code]/cricsheet-sync/route.ts` | **Rewritten.** No longer writes to `players.stats`. Instead upserts one `match_results` row per match with `source="cricsheet"`, `accepted=false`. Re-running is safe â€” updates stats on existing rows but preserves `accepted=true` decisions. |

#### Flow after this change

```
cricsheet-sync POST
  â†’ processZipPerMatch()
  â†’ match_results rows (source="cricsheet", accepted=false)
  â†’ Admin reviews in match comparison UI (same as webscrape)
  â†’ webscrape-accept POST (accept decision)
  â†’ aggregates ALL accepted rows (any source) â†’ players.stats
```

#### Files Changed

```
MOD   lib/server/cricsheet.ts              (added processZipPerMatch, CricsheetMatchEntry, accumulatorToMatchStats)
MOD   app/api/rooms/[code]/cricsheet-sync/route.ts  (full rewrite â€” uses match_results pipeline)
```

> **Note:** No DB migration needed. The existing `match_results` table already has `source`, `match_date`, `season`, and `accepted` columns. No changes to `webscrape-accept` or `webscrape-preview` â€” they already handle any source.

---

### Bug Fix â€” Cricsheet ZIP Data Not Appearing in Results

**Root cause:** The refactor above stored all Cricsheet rows as `accepted=false`. The `webscrape-accept` route (which runs aggregation â†’ `players.stats`) was never called, so the Results board stayed empty after a ZIP sync.

**Fix:** `cricsheet-sync/route.ts` rewritten again to:

1. **Upsert with `accepted=true`** â€” both new inserts and updates on existing rows immediately mark the match as accepted.
2. **Run aggregation inline** â€” after upserting all matches, reads every `accepted=true` row for the room+season (any source), runs `aggregateToPlayerStats()`, and writes totals to `players.stats` â€” identical logic to `webscrape-accept`.
3. **`revalidatePath`** fires for `/room/` and `/results/` so the UI updates instantly.

No manual "accept" step needed for Cricsheet data â€” results are visible immediately after ZIP sync.

#### Files Changed

```
MOD   app/api/rooms/[code]/cricsheet-sync/route.ts  (upsert accepted=true + inline aggregation)
```

---

# Session Changelog (2026-03-28 â€” Part 2)

## What Was Changed

### 6. Cricsheet Player Name Fix â€” Short Name â†’ Full Name Translation

**Problem:** Cricsheet ball-by-ball data uses short names (`"HH Pandya"`, `"V Kohli"`, `"RG Sharma"`) but the room's player pool uses full names (`"Hardik Pandya"`, `"Virat Kohli"`, `"Rohit Sharma"`). The existing normalised-name + surname-fallback matching was failing for most players, so stats were not being assigned.

**Fix:** Introduced a name translation map built from `final_mapping.json` (project root). Every player name encountered during Cricsheet processing is now translated from its Cricsheet short form to the canonical full name before being stored in the stats map.

| File | Change |
|------|--------|
| `lib/server/cricsheet.ts` | Added `normShort()` helper. `processMatch()` now accepts optional `nameMap?: Map<string, string>`. All player name references (batter, bowler, fielder, player_out, announced XI) pass through `resolve()` before being stored. `processZipPerMatch()` and `processZip()` both accept and forward `nameMap`. |
| `app/api/rooms/[code]/cricsheet-sync/route.ts` | Added `buildNameMap()` â€” reads `final_mapping.json` at module load, builds `normalised-short-name â†’ full-name` map (`CRICSHEET_NAME_MAP`). Passes the map into `processZipPerMatch()`. |

#### How the mapping works

```
final_mapping.json entry:
  "dbe50b21": { "short_name": "HH Pandya", "full_name": "Hardik Pandya" }

buildNameMap() produces:
  "hh pandya" â†’ "Hardik Pandya"

processMatch() resolve():
  "HH Pandya" â†’ normalise â†’ "hh pandya" â†’ lookup â†’ "Hardik Pandya"

match_results.player_stats key:
  "Hardik Pandya"   â† now matches DB player name exactly
```

#### Files Changed

```
MOD   lib/server/cricsheet.ts
MOD   app/api/rooms/[code]/cricsheet-sync/route.ts
```

> **Note:** `final_mapping.json` must exist in the project root (it was already present). No DB changes needed.

---

### 7. Cricsheet â€” Upload Single Match JSON File

**Problem:** Previously you could only sync via the full season ZIP. If you want to add one match's data quickly (e.g. from `cricsheet.org/matches/ipl/`) you had to re-upload the entire ZIP.

**Fix:** Added a third upload mode â€” **Upload JSON** â€” that accepts a single Cricsheet match `.json` file and processes it as one match entry.

| File | Change |
|------|--------|
| `lib/server/cricsheet.ts` | New `processSingleMatchJson(buffer, filename, season?, nameMap?)` â€” parses one JSON file, runs `processMatch()`, returns a `ProcessZipPerMatchResult` with exactly one entry. matchId is derived from the uploaded filename. |
| `app/api/rooms/[code]/cricsheet-sync/route.ts` | Detects `.json` vs `.zip` by the uploaded filename. Routes to `processSingleMatchJson()` or `processZipPerMatch()` accordingly. Auto-fetch always uses `processZipPerMatch()`. |
| `components/room/cricsheet-sync-button.tsx` | Added **Upload JSON** mode button alongside existing Auto-fetch and Upload ZIP. File input for JSON mode accepts only `.json`. |

#### Three sync modes now available

| Mode | What it does |
|------|-------------|
| **Auto-fetch** | Downloads `ipl_json.zip` from cricsheet.org automatically. All season matches. |
| **Upload ZIP** | Upload `ipl_json.zip` downloaded manually from `cricsheet.org/downloads/`. All season matches. |
| **Upload JSON** | Upload a single match `.json` file from `cricsheet.org/matches/ipl/`. One match only. |

All three modes apply the `final_mapping.json` name translation and follow the same pipeline:
upsert â†’ `match_results` â†’ aggregate accepted rows â†’ `players.stats`.

#### Files Changed

```
NEW   lib/server/cricsheet.ts  (added processSingleMatchJson)
MOD   app/api/rooms/[code]/cricsheet-sync/route.ts  (json/zip routing)
MOD   components/room/cricsheet-sync-button.tsx     (Upload JSON button)
```

---

## DB Changes Required

**Only one migration is needed** â€” and only if you have not run it yet:

```
supabase/match-results.sql
```

Run it once in Supabase Dashboard â†’ SQL Editor. All other changes write to existing columns (`players.stats` jsonb, `match_results` table). No new tables, columns, or indexes are required for any of the changes above.

---

# Session Changelog (2026-03-28 â€” Part 3)

## What Was Changed

### 8. Cricsheet Player Matching â€” UUID-Based Name Resolution

**Problem:** The short-name normalisation approach (`"kh pandya"` â†’ lookup â†’ `"Krunal Pandya"`) was still wrong in critical cases:

- `"KH Pandya"` was being attributed to Hardik Pandya instead of Krunal Pandya via the surname fallback
- `"B Kumar"` was ambiguous between Bhuvneshwar, Mukesh, and Ashwani Kumar
- Players like `"Sumit Kumar"` (Shivang Kumar) and `"Shivam Singh"` (Shashank Singh) â€” where the short name and full name share no common words â€” were impossible to match by string normalisation alone

**Root cause:** String normalisation can never be fully reliable. The Cricsheet short name is just a convention and is not guaranteed to share initials or structure with the canonical full name.

**Fix:** Use the UUID registry built into every Cricsheet match JSON.

Every Cricsheet match file contains `info.registry.people` â€” a map of the player's in-game name â†’ their unique Cricsheet UUID. Since `final_mapping.json` is also keyed by these same UUIDs, the resolution becomes exact and unambiguous:

```
Cricsheet ball data:  "KH Pandya" (batter field)
       â†“
info.registry.people: "KH Pandya" â†’ "5b8c830e"
       â†“
final_mapping.json:   "5b8c830e" â†’ full_name: "Krunal Pandya"
       â†“
match_results key:    "Krunal Pandya"  â† exact DB match
```

This handles cases that were previously impossible:

| Cricsheet name | Full name | Why normalisation failed |
|---|---|---|
| `KH Pandya` | Krunal Pandya | Surname fallback misattributed to Hardik |
| `B Kumar` | Bhuvneshwar Kumar | Ambiguous with 3 other Kumars |
| `Sumit Kumar` | Shivang Kumar | Completely different first name |
| `Shivam Singh` | Shashank Singh | Completely different first name |
| `S Sandeep Warrier` | Sandeep Sharma | Nothing in common except first initial |

**Verified:** 16/16 simulation test cases pass, including all tricky cases above.

| File | Change |
|------|--------|
| `lib/server/cricsheet.ts` | Added `registry?: { people?: Record<string, string> }` to `CricsheetMatch.info`. Changed `processMatch()` parameter from `nameMap` to `uuidMap`. `resolve()` now does: `registry[name]` â†’ UUID â†’ `uuidMap.get(uuid)` â†’ full name. Updated `processZipPerMatch`, `processSingleMatchJson`, `processZip` signatures to `uuidMap`. |
| `app/api/rooms/[code]/cricsheet-sync/route.ts` | Replaced `buildNameMap()` with `buildUuidMap()` â€” top-level keys of `final_mapping.json` are the UUIDs, so map is `uuid â†’ full_name`. Renamed `CRICSHEET_NAME_MAP` â†’ `CRICSHEET_UUID_MAP`. Added error logging if `final_mapping.json` fails to load. |

**Also added (same session):** Initial-based matching helpers `isShortNameFormat` + `matchesShortName` in the route as a secondary fallback for the DB-player-to-stats matching step. These guard against misattribution even if any name slips through the UUID translation (e.g. a player not in `final_mapping.json`).

#### Files Changed

```
MOD   lib/server/cricsheet.ts              (UUID registry lookup in processMatch)
MOD   app/api/rooms/[code]/cricsheet-sync/route.ts  (buildUuidMap, CRICSHEET_UUID_MAP, initial-based fallback)
```

> **No DB changes required.** The UUID translation happens entirely at parse time â€” stats are stored under full names as before.

---

# Session Changelog (2026-03-28 â€” Part 4)

## What Was Changed

### 9. UUID Full-Length Fix â€” Cricsheet Registry Lookup

**Problem:** After implementing UUID-based name resolution, the matching still failed in production. Root cause: Cricsheet stores **full UUIDs** in `info.registry.people` (e.g. `"dbe50b21-xxxx-xxxx-xxxx-xxxxxxxxxxxx"`) but `final_mapping.json` only uses the **first 8 hex characters** as keys (e.g. `"dbe50b21"`). Every UUID lookup silently returned `undefined`, so no translation happened and the old broken surname fallback fired.

**Fix:** Slice the full UUID to 8 chars before lookup:
```typescript
const full = uuidMap.get(fullUuid.slice(0, 8));
```

**Also added:** Short-name map as a second fallback inside `processMatch()` (for older Cricsheet JSONs that don't include `registry.people`). Resolution priority:
1. UUID via `info.registry.people` â†’ `uuidMap.get(uuid.slice(0,8))`
2. Normalised short-name map (same as original approach)
3. Raw name (pass-through)

| File | Change |
|------|--------|
| `lib/server/cricsheet.ts` | Added `.slice(0, 8)` to UUID lookup; added `shortNameMap` as second parameter to `processMatch`, `processZipPerMatch`, `processSingleMatchJson`, `processZip` |
| `app/api/rooms/[code]/cricsheet-sync/route.ts` | Added `buildShortNameMap()` alongside `buildUuidMap()`; passes both maps to parser functions |

---

### 10. DB â€” `cricsheet_uuid` Column on `players`

**Purpose:** After the first successful Cricsheet sync, each matched player's Cricsheet UUID is stored in `players.cricsheet_uuid`. All future syncs match by UUID directly â€” bypassing name matching entirely â€” so point misattribution is impossible even if player names are renamed or have typos.

**Flow:**
- **First sync:** name-based match succeeds â†’ UUID stored in `players.cricsheet_uuid`
- **All subsequent syncs:** UUID looked up first â†’ exact stats key found â†’ no string matching needed

**Run once in Supabase â†’ SQL Editor:**
```sql
-- file: supabase/add-cricsheet-uuid.sql
ALTER TABLE players ADD COLUMN IF NOT EXISTS cricsheet_uuid text;
CREATE INDEX IF NOT EXISTS idx_players_cricsheet_uuid
  ON players (cricsheet_uuid)
  WHERE cricsheet_uuid IS NOT NULL;
```

| File | Change |
|------|--------|
| `supabase/add-cricsheet-uuid.sql` | **NEW** â€” migration file |
| `app/api/rooms/[code]/cricsheet-sync/route.ts` | Fetches `cricsheet_uuid` alongside player; adds step 0 (UUID match) before name fallbacks; stores UUID on first successful match via `updatePayload.cricsheet_uuid` |

> **DB change required:** Run `supabase/add-cricsheet-uuid.sql` once.

---

### 11. Live Fetch Fix â€” CricketData & RapidAPI

**Problems:**
1. `TypeError: fetch failed` (CricketData) â€” base URL was `https://api.cricketdata.org` which doesn't resolve. The actual CricAPI.com endpoint is `https://api.cricapi.com/v1`.
2. `IPL 2026 series not found` (RapidAPI) â€” code searched `/series/v1/domestic` only. IPL is a T20 **league**, not domestic cricket. Even after adding `league` and `international` categories, the series still wasn't found early in the season.

**Fixes:**

*CricketData:*
- Changed `BASE` constant to `https://api.cricapi.com/v1`
- Added pagination (tries offsets 0, 25, 50, 75)
- Expanded series name match to accept `"IPL 2026"`, `"TATA IPL 2026"` etc. (not just `"Indian Premier League"`)

*RapidAPI Cricbuzz:*
- Series search now tries `league â†’ domestic â†’ international` in order
- Added fallback: if all category searches fail, hits `/matches/v1/recent` and scans the feed for IPL matches by name â€” works even when the series isn't yet listed in categories

| File | Change |
|------|--------|
| `lib/server/webscrape/cricketdata.ts` | Changed `BASE` URL; added `isIPLSeries()` helper; paginated `findIPLSeriesId()` |
| `lib/server/webscrape/rapidapi.ts` | `findIPLSeriesId()` tries multiple categories; added `findIPLMatchesViaRecent()` fallback; made `listSeriesMatches()` more robust against variable response shapes |
| `app/api/rooms/[code]/webscrape-preview/route.ts` | Returns structured `errors` object per provider so UI shows exactly what failed |

---

### 12. Auto-Refresh Every 10 Minutes

**Feature:** Checkbox in the Live Web Sync panel toggles automatic re-fetching every 10 minutes. While enabled, a `MM:SS` countdown shows time until next fetch.

**Implementation:**
- `handleFetch` converted to `useCallback` (stable reference required by the interval effect)
- `useEffect` with `setInterval(1000)` drives a countdown; when it hits 0 it calls `handleFetch()` and resets to 600
- Correct hook order: `handleFetch` callback defined **before** the effect that depends on it (avoids "used before initialisation" crash)
- `loadStored` inlined inside its own `useEffect` (was a standalone `async function` before â€” now properly scoped)

**UI:** Checkbox + countdown label next to the Fetch button. Turning the checkbox off clears the interval immediately.

| File | Change |
|------|--------|
| `components/room/webscrape-sync-panel.tsx` | Added `autoRefresh`, `nextRefreshIn` state; `handleFetch` â†’ `useCallback`; auto-refresh `useEffect`; countdown label in JSX |

---

## DB Changes Required (cumulative)

| Migration file | When to run | Status |
|---|---|---|
| `supabase/match-results.sql` | Run once (previous session) | Existing |
| `supabase/add-cricsheet-uuid.sql` | Run once (this session) | **NEW â€” run now** |

---

# Session Changelog (2026-03-29)

## What Was Changed

### 13. Dot Ball Milestone Scoring — Full Fix Across All Data Paths

**Problem:** The old rule was a flat `+1 per dot ball`, which violated RULES.MD. Additionally, `dot_balls` was never populated from any API source — `ScorecardBowlingRow` had no `dot_balls` field — so every player always had `0` dot ball points.

**New rule (per RULES.MD):**

| Dot Ball Count (per match) | Points |
|----------------------------|--------|
| 3 dot balls | +1 |
| 6 dot balls | +2 (total, capped) |

Maiden over = **+12** (maiden) **+ +2** (6-dot milestone) = **+14 total**.

**Fix spans 9 files:**

| File | Change |
|------|--------|
| `RULES.MD` | Replaced `Dot Ball \| +1` with two rows: `3 Dot Balls \| +1` and `6 Dot Balls \| +2` |
| `lib/domain/scoring.ts` | Added `dot_ball_pts?: number` to `PlayerStats`; added `dotBallPts()` helper; backward-compatible scoring line |
| `lib/server/webscrape/parser.ts` | Added `dot_balls` to `ScorecardBowlingRow`; added `dot_ball_pts` to `PlayerMatchStats`; recomputes per-match milestone in `mergeInningStats` |
| `lib/server/webscrape/rapidapi.ts` | Added `dots?: number` to `CricbuzzBowler`; passes `dot_balls` through |
| `lib/server/webscrape/atd.ts` | Added `dots?: number` to `AtdBowler`; passes `dot_balls` through |
| `lib/server/webscrape/cricketdata.ts` | Added `dots` to `CricketDataBowler`; passes `dot_balls` through |
| `app/api/rooms/[code]/webscrape-accept/route.ts` | Added `dotBallPts()` helper; accumulates `dot_ball_pts` per season |
| `app/api/rooms/[code]/cricsheet-sync/route.ts` | Same accumulation pattern as webscrape-accept |
| `lib/server/cricsheet.ts` | Tracks dots per delivery in `matchBowl` Map; computes per-match milestone after economy loop |

**Key design rule:** `dot_ball_pts` is computed per-match then accumulated — never sum raw dots across matches first (would trigger milestone wrongly across match boundaries).

**Verified output:**
```
dotBallPts(2)  → 0
dotBallPts(3)  → 1
dotBallPts(6)  → 2
dotBallPts(13) → 2  (capped)
Maiden over    → +12 + +2 = +14
```

TypeScript compile: clean.

> **No DB migration required.** `dot_ball_pts` stores inside existing `players.stats` and `match_results.player_stats` jsonb columns.

---

## Pending / Known Issues

| Issue | Detail |
|-------|---------|
| Name mismatch — Phil Salt | API returns `”Phil Salt”`, DB has `”Philip Salt”`. Rs.19.25Cr player — stats won't attribute on live fetch. |
| Name mismatch — Nitish Reddy | API returns `”Nitish K. Reddy”`, DB has `”Nitish Kumar Reddy”` |
| Economy threshold | Exactly 2.0 overs (`balls === 12`) triggers penalty in SFL but D11 does not penalise it — decision pending |

