"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toErrorMessage } from "@/lib/utils";

interface Provider {
  id: string;
  label: string;
  configured: boolean;
}

interface UpdateScoresButtonProps {
  roomCode: string;
}

export function UpdateScoresButton({ roomCode }: UpdateScoresButtonProps) {
  const router = useRouter();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("auto");
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    async function loadProviders() {
      setLoadingProviders(true);
      try {
        const res = await fetch(`/api/rooms/${roomCode}/auto-sync`);
        const data = (await res.json()) as { ok: boolean; providers?: Provider[]; error?: string };
        if (data.ok && data.providers) {
          setProviders(data.providers);
          // Default to first configured provider
          const first = data.providers.find((p) => p.configured);
          if (first) setSelectedProvider(first.id);
        }
      } catch { /* ignore */ } finally {
        setLoadingProviders(false);
      }
    }
    void loadProviders();
  }, [open, roomCode]);

  async function handleFetch() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      if (selectedProvider === "cricsheet") {
        const res = await fetch(`/api/rooms/${roomCode}/cricsheet-sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ season: "2026" }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          error?: string;
          matchesProcessed?: number;
          matchesAlreadyAccepted?: number;
          playersMatched?: number;
        };
        if (!res.ok || !data.ok) throw new Error(data.error ?? "Cricsheet sync failed.");
        const processed = data.matchesProcessed ?? 0;
        const skipped = data.matchesAlreadyAccepted ?? 0;
        if (processed === 0 && skipped > 0) {
          setMessage(`Already up to date — ${skipped} match(es) already accepted.`);
        } else {
          setMessage(`Done — ${processed} matches synced, ${data.playersMatched ?? 0} players matched.`);
        }
      } else {
        const body: Record<string, string> = { season: "2026" };
        if (selectedProvider !== "auto") body.provider = selectedProvider;
        const res = await fetch(`/api/rooms/${roomCode}/auto-sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as {
          ok: boolean;
          error?: string;
          matchesFetched?: number;
          matchesAlreadyAccepted?: number;
          playersUpdated?: number;
          source?: string;
        };
        if (!res.ok || !data.ok) throw new Error(data.error ?? "Fetch failed.");
        const fetched = data.matchesFetched ?? 0;
        const skipped = data.matchesAlreadyAccepted ?? 0;
        const updated = data.playersUpdated ?? 0;
        if (fetched === 0 && skipped > 0) {
          setMessage(`Already up to date — ${skipped} match(es) already accepted.`);
        } else if (fetched === 0) {
          setMessage("No new matches found from this provider.");
        } else {
          setMessage(`Done — ${fetched} new match(es) synced, ${updated} players updated.`);
        }
      }
      router.refresh();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const configuredProviders = providers.filter((p) => p.configured);

  return (
    <div style={{ position: "relative" }}>
      <button
        className="button secondary"
        onClick={() => { setOpen((v) => !v); setMessage(null); setError(null); }}
        type="button"
        disabled={busy}
      >
        {busy ? "Fetching…" : "Fetch Scores"}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 0.5rem)",
            right: 0,
            zIndex: 50,
            background: "var(--card-bg, #1a1a2e)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "10px",
            padding: "1rem",
            minWidth: "260px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontWeight: 600, marginBottom: "0.6rem", fontSize: "0.9rem" }}>
            Choose API Provider
          </div>

          {loadingProviders ? (
            <div className="subtle" style={{ fontSize: "0.82rem", marginBottom: "0.75rem" }}>
              Loading providers…
            </div>
          ) : configuredProviders.length === 0 ? (
            <div className="notice warning" style={{ marginBottom: "0.75rem", fontSize: "0.82rem" }}>
              No API providers configured on this server.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "0.85rem" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  padding: "0.35rem 0.5rem",
                  borderRadius: "6px",
                  background: selectedProvider === "auto" ? "rgba(116,104,255,0.12)" : "transparent",
                  border: selectedProvider === "auto" ? "1px solid rgba(116,104,255,0.3)" : "1px solid transparent",
                }}
              >
                <input
                  type="radio"
                  name="provider"
                  value="auto"
                  checked={selectedProvider === "auto"}
                  onChange={() => setSelectedProvider("auto")}
                  style={{ accentColor: "var(--accent, #7468ff)" }}
                />
                Auto (best available)
              </label>
              {configuredProviders.map((p) => (
                <label
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontSize: "0.875rem",
                    cursor: "pointer",
                    padding: "0.35rem 0.5rem",
                    borderRadius: "6px",
                    background: selectedProvider === p.id ? "rgba(116,104,255,0.12)" : "transparent",
                    border: selectedProvider === p.id ? "1px solid rgba(116,104,255,0.3)" : "1px solid transparent",
                  }}
                >
                  <input
                    type="radio"
                    name="provider"
                    value={p.id}
                    checked={selectedProvider === p.id}
                    onChange={() => setSelectedProvider(p.id)}
                    style={{ accentColor: "var(--accent, #7468ff)" }}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          )}

          {message && (
            <div className="notice success" style={{ marginBottom: "0.65rem", fontSize: "0.82rem" }}>
              {message}
            </div>
          )}
          {error && (
            <div className="notice warning" style={{ marginBottom: "0.65rem", fontSize: "0.82rem" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              className="button"
              onClick={() => void handleFetch()}
              disabled={busy || loadingProviders || configuredProviders.length === 0}
              type="button"
              style={{ flex: 1, fontSize: "0.85rem" }}
            >
              {busy ? "Fetching…" : "Fetch Scores"}
            </button>
            <button
              className="button ghost"
              onClick={() => setOpen(false)}
              disabled={busy}
              type="button"
              style={{ fontSize: "0.85rem" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
