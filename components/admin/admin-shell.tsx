"use client";

import { useCallback, useEffect, useState } from "react";
import { toErrorMessage } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MatchSource {
  sourceLabel: string;
  calculatedPoints: Record<string, number>;
  accepted: boolean;
  pushedAt: string | null;
}

interface MatchComparison {
  matchId: string;
  matchDate: string;
  teams: string[];
  sources: Record<string, MatchSource>;
}

interface RoomRow {
  id: string;
  code: string;
  name: string;
  players: number;
  teams: number;
  members: number;
  auctionPhase: string;
  lastSync: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function totalPts(pts: Record<string, number>): number {
  return Object.values(pts).reduce((s, v) => s + v, 0);
}

function topScorers(pts: Record<string, number>, n = 5): Array<[string, number]> {
  return Object.entries(pts).sort((a, b) => b[1] - a[1]).slice(0, n);
}

// ── Tab: Score Sync ───────────────────────────────────────────────────────────

function ScoreSyncTab() {
  const [season, setSeason] = useState("2026");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [providers, setProviders] = useState<Array<{ id: string; label: string; configured: boolean }>>([]);
  const [fetching, setFetching] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [acceptingAll, setAcceptingAll] = useState(false);
  const [comparison, setComparison] = useState<MatchComparison[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [fileRef, setFileRef] = useState<HTMLInputElement | null>(null);
  const [syncMode, setSyncMode] = useState<"fetch" | "upload" | "json">("fetch");

  // Load stored comparison on mount / season change
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/live-sync?season=${season}`);
        const data = (await res.json()) as { ok: boolean; comparison?: MatchComparison[]; providers?: typeof providers };
        if (data.ok) {
          setComparison(data.comparison ?? []);
          setProviders(data.providers ?? []);
        }
      } catch { /* ignore */ }
    }
    void load();
  }, [season]);

  useEffect(() => {
    if (!selectedProvider) {
      const first = providers.find((p) => p.configured);
      if (first) setSelectedProvider(first.id);
    }
  }, [providers, selectedProvider]);

  const handleCricsheetSync = useCallback(async () => {
    setSyncing(true);
    setSyncResult(null);
    setFetchError(null);
    try {
      let response: Response;
      if (syncMode === "upload" || syncMode === "json") {
        const file = fileRef?.files?.[0];
        if (!file) { setFetchError("Select a file first."); setSyncing(false); return; }
        const form = new FormData();
        form.append("file", file);
        form.append("season", season);
        response = await fetch("/api/admin/cricsheet-sync", { method: "POST", body: form });
      } else {
        response = await fetch("/api/admin/cricsheet-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ season }),
        });
      }
      const data = (await response.json()) as { ok: boolean; error?: string; matchesProcessed?: number; matchesUpserted?: number; matchesAlreadyAccepted?: number };
      if (!response.ok || !data.ok) { setFetchError(data.error ?? "Sync failed."); return; }
      setSyncResult(`Done. ${data.matchesUpserted ?? 0} new matches stored. ${data.matchesAlreadyAccepted ?? 0} already accepted.`);
    } catch (err) {
      setFetchError(toErrorMessage(err));
    } finally {
      setSyncing(false);
    }
  }, [season, syncMode, fileRef]);

  const handleLiveFetch = useCallback(async () => {
    setFetching(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/admin/live-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season, provider: selectedProvider }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; comparison?: MatchComparison[]; providers?: typeof providers; matchesFetched?: number };
      if (!res.ok || !data.ok) { setFetchError(data.error ?? "Fetch failed."); if (data.providers) setProviders(data.providers); return; }
      setComparison(data.comparison ?? []);
      if (data.providers) setProviders(data.providers);
    } catch (err) {
      setFetchError(toErrorMessage(err));
    } finally {
      setFetching(false);
    }
  }, [season, selectedProvider]);

  async function handleAccept(matchId: string, source: string) {
    setAccepting(matchId);
    try {
      const res = await fetch("/api/admin/accept-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, source }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; roomsUpdated?: number; playersUpdated?: number };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Accept failed.");
      // Optimistically mark accepted in local state
      setComparison((prev) =>
        prev.map((m) => {
          if (m.matchId !== matchId) return m;
          const newSources = Object.fromEntries(
            Object.entries(m.sources).map(([k, v]) => [k, { ...v, accepted: k === source }]),
          );
          return { ...m, sources: newSources };
        }),
      );
      setSyncResult(`Match accepted. ${data.roomsUpdated} rooms updated, ${data.playersUpdated} players updated.`);
    } catch (err) {
      alert(toErrorMessage(err));
    } finally {
      setAccepting(null);
    }
  }

  async function handleAcceptSeason() {
    setAcceptingAll(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/admin/accept-season", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; accepted?: number; pushed?: number };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Bulk accept failed.");
      setSyncResult(`Season accepted: ${data.accepted} matches accepted, ${data.pushed} pushed to all rooms.`);
      // Reload comparison
      const reload = await fetch(`/api/admin/live-sync?season=${season}`);
      const reloadData = (await reload.json()) as { ok: boolean; comparison?: MatchComparison[] };
      if (reloadData.ok) setComparison(reloadData.comparison ?? []);
    } catch (err) {
      alert(toErrorMessage(err));
    } finally {
      setAcceptingAll(false);
    }
  }

  const pendingCount = comparison.reduce((count, m) => {
    const hasAccepted = Object.values(m.sources).some((s) => s.accepted);
    return hasAccepted ? count : count + 1;
  }, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Cricsheet Sync */}
      <div className="panel" style={{ borderColor: "rgba(56,189,248,0.2)", background: "rgba(56,189,248,0.03)" }}>
        <span className="eyebrow">Ball-by-ball data</span>
        <h2 style={{ marginTop: "0.4rem", marginBottom: "1rem" }}>Cricsheet Sync</h2>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "1rem" }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Season</label>
            <input
              className="input"
              style={{ maxWidth: "7rem" }}
              type="text"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              disabled={syncing}
            />
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {(["fetch", "upload", "json"] as const).map((m) => (
              <button key={m} className={`button ${syncMode === m ? "" : "ghost"}`} onClick={() => setSyncMode(m)} disabled={syncing} type="button">
                {m === "fetch" ? "Auto-fetch" : m === "upload" ? "Upload ZIP" : "Upload JSON"}
              </button>
            ))}
          </div>
        </div>

        {(syncMode === "upload" || syncMode === "json") && (
          <div className="field" style={{ marginBottom: "1rem" }}>
            <label>{syncMode === "json" ? "Single match JSON" : "Full season ZIP"}</label>
            <input
              className="input"
              type="file"
              accept={syncMode === "json" ? ".json" : ".zip"}
              ref={(el) => setFileRef(el)}
              disabled={syncing}
            />
          </div>
        )}

        {syncResult && <div className="notice success" style={{ marginBottom: "0.75rem" }}>{syncResult}</div>}
        {fetchError && <div className="notice warning" style={{ marginBottom: "0.75rem" }}>{fetchError}</div>}

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button className="button secondary" onClick={() => void handleCricsheetSync()} disabled={syncing} type="button">
            {syncing ? "Syncing..." : "Sync Cricsheet data"}
          </button>
          {pendingCount > 0 && (
            <button className="button" onClick={() => void handleAcceptSeason()} disabled={acceptingAll} type="button">
              {acceptingAll ? "Pushing..." : `Accept all pending (${pendingCount} matches) → all rooms`}
            </button>
          )}
        </div>
      </div>

      {/* Live Web Sync */}
      <div className="panel" style={{ borderColor: "rgba(99,220,120,0.2)", background: "rgba(99,220,120,0.03)" }}>
        <span className="eyebrow">API data</span>
        <h2 style={{ marginTop: "0.4rem", marginBottom: "1rem" }}>Live Web Sync</h2>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "1rem" }}>
          {providers.length > 0 && (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {providers.map((p) => (
                <button
                  key={p.id}
                  className={`pill ${selectedProvider === p.id ? "highlight" : ""}`}
                  disabled={!p.configured || fetching}
                  onClick={() => setSelectedProvider(p.id)}
                  type="button"
                  style={{ fontSize: "0.78rem", opacity: p.configured ? 1 : 0.5, cursor: p.configured ? "pointer" : "not-allowed" }}
                  title={p.configured ? "API key configured" : "API key missing"}
                >
                  {p.label} {selectedProvider === p.id ? "(Selected)" : p.configured ? "(Ready)" : "(No key)"}
                </button>
              ))}
            </div>
          )}
          <button className="button secondary" onClick={() => void handleLiveFetch()} disabled={fetching || !selectedProvider} type="button" style={{ marginTop: "auto" }}>
            {fetching ? "Fetching..." : `Fetch Live Scores${selectedProvider ? ` (${providers.find((p) => p.id === selectedProvider)?.label ?? selectedProvider})` : ""}`}
          </button>
        </div>
      </div>

      {/* Pending Matches */}
      {comparison.length > 0 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h2 style={{ margin: 0 }}>
              Matches ({comparison.length})
              {pendingCount > 0 && <span className="pill" style={{ marginLeft: "0.5rem", fontSize: "0.78rem" }}>{pendingCount} pending</span>}
            </h2>
          </div>

          {comparison.map((match) => {
            const sourceKeys = Object.keys(match.sources);
            const acceptedSource = sourceKeys.find((k) => match.sources[k]?.accepted);
            const isProcessing = accepting === match.matchId;

            return (
              <div key={match.matchId} className="panel results-panel-accent" style={{ padding: "1rem", marginBottom: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                  <div>
                    <div style={{ fontSize: "0.78rem", color: "var(--subtle, #888)" }}>{match.matchDate}</div>
                    <strong>{match.teams.join(" vs ") || match.matchId}</strong>
                  </div>
                  {acceptedSource && (
                    <span className="pill highlight" style={{ fontSize: "0.78rem" }}>
                      Accepted: {match.sources[acceptedSource]?.sourceLabel ?? acceptedSource}
                      {match.sources[acceptedSource]?.pushedAt && " · pushed"}
                    </span>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(sourceKeys.length, 1)}, 1fr)`, gap: "0.75rem" }}>
                  {sourceKeys.map((srcKey) => {
                    const sd = match.sources[srcKey]!;
                    const top = topScorers(sd.calculatedPoints);
                    const total = totalPts(sd.calculatedPoints);

                    return (
                      <div
                        key={srcKey}
                        style={{
                          background: sd.accepted ? "rgba(99,220,120,0.07)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${sd.accepted ? "rgba(99,220,120,0.3)" : "rgba(255,255,255,0.08)"}`,
                          borderRadius: "8px",
                          padding: "0.75rem",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                          <strong style={{ fontSize: "0.85rem" }}>{sd.sourceLabel}</strong>
                          <span className="subtle" style={{ fontSize: "0.78rem" }}>{total} pts total</span>
                        </div>
                        <div style={{ fontSize: "0.8rem", marginBottom: "0.65rem" }}>
                          {top.map(([name, pts]) => (
                            <div key={name} style={{ display: "flex", justifyContent: "space-between", padding: "0.18rem 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{name}</span>
                              <strong>{pts}</strong>
                            </div>
                          ))}
                          {Object.keys(sd.calculatedPoints).length > 5 && (
                            <div className="subtle" style={{ fontSize: "0.76rem", marginTop: "0.25rem" }}>+{Object.keys(sd.calculatedPoints).length - 5} more</div>
                          )}
                        </div>
                        <button
                          className={`button ${sd.accepted ? "" : "ghost"}`}
                          disabled={isProcessing || sd.accepted}
                          onClick={() => void handleAccept(match.matchId, srcKey)}
                          style={{ width: "100%", fontSize: "0.82rem", padding: "0.45rem" }}
                          type="button"
                        >
                          {sd.accepted ? "Accepted" : isProcessing ? "Pushing to all rooms..." : "Accept + Push to all rooms"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tab: Rooms Overview ───────────────────────────────────────────────────────

function RoomsTab() {
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/rooms");
        const data = (await res.json()) as { ok: boolean; rooms?: RoomRow[]; error?: string };
        if (!res.ok || !data.ok) { setError(data.error ?? "Failed to load rooms."); return; }
        setRooms(data.rooms ?? []);
      } catch (err) {
        setError(toErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) return <p className="subtle">Loading rooms…</p>;
  if (error) return <div className="notice warning">{error}</div>;
  if (rooms.length === 0) return <p className="subtle">No rooms found.</p>;

  return (
    <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {["Code", "Name", "Teams", "Players", "Members", "Phase", "Last Sync", ""].map((h) => (
              <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", color: "var(--subtle, #888)", fontWeight: 600, fontSize: "0.78rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => (
            <tr key={room.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <td style={{ padding: "0.7rem 1rem" }}><code style={{ fontSize: "0.82rem" }}>{room.code}</code></td>
              <td style={{ padding: "0.7rem 1rem" }}>{room.name}</td>
              <td style={{ padding: "0.7rem 1rem" }}>{room.teams}</td>
              <td style={{ padding: "0.7rem 1rem" }}>{room.players}</td>
              <td style={{ padding: "0.7rem 1rem" }}>{room.members}</td>
              <td style={{ padding: "0.7rem 1rem" }}>
                <span className={`pill ${room.auctionPhase === "ACTIVE" ? "highlight" : ""}`} style={{ fontSize: "0.75rem" }}>{room.auctionPhase}</span>
              </td>
              <td style={{ padding: "0.7rem 1rem", color: "var(--subtle, #888)", fontSize: "0.8rem" }}>
                {room.lastSync ? new Date(room.lastSync).toLocaleDateString() : "Never"}
              </td>
              <td style={{ padding: "0.7rem 1rem" }}>
                <a href={`/room/${room.code}`} target="_blank" rel="noopener noreferrer" className="button ghost" style={{ fontSize: "0.78rem", padding: "0.3rem 0.65rem" }}>
                  View
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Tab: Superadmin Management ────────────────────────────────────────────────

function SuperadminTab() {
  const [superadmins, setSuperadmins] = useState<Array<{ id: string; email: string | null; display_name: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [grantEmail, setGrantEmail] = useState("");
  const [granting, setGranting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadAdmins() {
    try {
      // We re-use the Supabase admin client indirectly through a dedicated endpoint
      // For now we'll fetch from /api/admin/rooms which is available, but ideally
      // a dedicated /api/admin/superadmins endpoint would be added.
      // Here we show an explanation and manual SQL instructions.
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAdmins(); }, []);

  async function handleGrant() {
    if (!grantEmail.trim()) return;
    setGranting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/superadmin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: grantEmail.trim(), grant: true }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; message?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed.");
      setMessage(data.message ?? "Done.");
      setGrantEmail("");
    } catch (err) {
      setMessage(toErrorMessage(err));
    } finally {
      setGranting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Grant Superadmin Access</h2>
        <p className="subtle" style={{ marginBottom: "1rem", fontSize: "0.88rem" }}>
          Enter an email address to grant superadmin access. The user must already have an account.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <div className="field" style={{ flex: 1, minWidth: "220px", marginBottom: 0 }}>
            <label>Email address</label>
            <input
              className="input"
              type="email"
              placeholder="user@example.com"
              value={grantEmail}
              onChange={(e) => setGrantEmail(e.target.value)}
              disabled={granting}
            />
          </div>
          <button className="button" onClick={() => void handleGrant()} disabled={granting || !grantEmail.trim()} type="button" style={{ marginTop: "auto" }}>
            {granting ? "Granting…" : "Grant superadmin"}
          </button>
        </div>
        {message && <div className={`notice ${message.includes("Error") || message.includes("fail") ? "warning" : "success"}`} style={{ marginTop: "0.75rem" }}>{message}</div>}
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Manual SQL (Supabase Dashboard)</h2>
        <p className="subtle" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>
          You can also manage superadmins directly in the Supabase SQL Editor:
        </p>
        <pre style={{ background: "rgba(0,0,0,0.3)", borderRadius: "6px", padding: "0.85rem", fontSize: "0.8rem", overflowX: "auto", border: "1px solid rgba(255,255,255,0.08)" }}>
{`-- Grant
UPDATE public.users SET is_superadmin = true WHERE email = 'user@example.com';

-- Revoke
UPDATE public.users SET is_superadmin = false WHERE email = 'user@example.com';

-- List all superadmins
SELECT id, email, display_name FROM public.users WHERE is_superadmin = true;`}
        </pre>
      </div>
    </div>
  );
}

// ── Main shell ────────────────────────────────────────────────────────────────

type Tab = "sync" | "rooms" | "admins";

export function AdminShell({ adminName }: { adminName: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("sync");

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "sync", label: "Score Sync" },
    { id: "rooms", label: "Rooms" },
    { id: "admins", label: "Superadmins" },
  ];

  return (
    <main className="shell" style={{ paddingTop: "2rem" }}>
      {/* Header */}
      <div className="panel" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <span className="eyebrow">Internal</span>
            <h1 className="page-title" style={{ fontSize: "2rem", marginTop: "0.3rem", marginBottom: 0 }}>
              IPL Auction — Admin Panel
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span className="pill highlight" style={{ fontSize: "0.78rem" }}>Superadmin</span>
            <span className="subtle" style={{ fontSize: "0.85rem" }}>{adminName}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "0" }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0.6rem 1.1rem",
              fontSize: "0.9rem",
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? "var(--accent, #7468ff)" : "var(--subtle, #888)",
              borderBottom: activeTab === tab.id ? "2px solid var(--accent, #7468ff)" : "2px solid transparent",
              marginBottom: "-1px",
              transition: "color 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "sync" && <ScoreSyncTab />}
      {activeTab === "rooms" && <RoomsTab />}
      {activeTab === "admins" && <SuperadminTab />}
    </main>
  );
}
