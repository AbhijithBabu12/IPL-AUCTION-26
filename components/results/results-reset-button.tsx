"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { toErrorMessage } from "@/lib/utils";

type Mode = "idle" | "confirm" | "ready_to_fetch" | "done";

interface ResultsResetButtonProps {
  roomCode: string;
  /** Super room (and super admin) gets a DB-level reset that also wipes match_results.
   *  Normal rooms get a soft reset that keeps match_results so Update Scores can rebuild. */
  isSuperRoom?: boolean;
}

export function ResultsResetButton({ roomCode, isSuperRoom = false }: ResultsResetButtonProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── DB-level reset (super room / super admin) ────────────────────────────────
  // Zeroes all player stats AND deletes all match_results rows.
  // No rebuild step — user must re-sync from Cricsheet / Live Score after this.
  async function handleDbReset() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/rooms/${roomCode}/results/reset`, { method: "POST" });
      const data = (await res.json()) as {
        ok?: boolean; error?: string;
        playersReset?: number; syncRowsCleared?: number;
      };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Reset failed.");
      setMessage(
        `Reset ${data.playersReset ?? 0} players · cleared ${data.syncRowsCleared ?? 0} match rows. Re-sync data to rebuild.`,
      );
      setMode("done");
      router.refresh();
    } catch (err) {
      setError(toErrorMessage(err));
      setMode("idle");
    } finally {
      setPending(false);
    }
  }

  // ── Soft reset (normal rooms) ────────────────────────────────────────────────
  // Zeroes player stats only. match_results are preserved so Update Scores can
  // immediately rebuild from them without re-fetching.
  async function handleSoftReset() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/rooms/${roomCode}/reset-points`, { method: "POST" });
      const data = (await res.json()) as { ok: boolean; error?: string; playersReset?: number };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Reset failed.");
      setMessage(`${data.playersReset ?? 0} players reset. Click "Update Scores" to rebuild.`);
      setMode("ready_to_fetch");
      router.refresh();
    } catch (err) {
      setError(toErrorMessage(err));
      setMode("idle");
    } finally {
      setPending(false);
    }
  }

  async function handleUpdate() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/rooms/${roomCode}/fetch-points`, { method: "POST" });
      const data = (await res.json()) as { ok: boolean; error?: string; playersUpdated?: number };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Update failed.");
      const n = data.playersUpdated ?? 0;
      setMessage(n > 0 ? `${n} players updated.` : "No accepted match data found for this room.");
      setMode("done");
      router.refresh();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  const confirmDescription = isSuperRoom
    ? "Zeroes all player fantasy points AND deletes all stored match data. You will need to re-sync from Cricsheet or Live Score to rebuild."
    : "Zeroes all player fantasy points. Stored match data is kept — click Update Scores right after to rebuild everything from the existing data.";

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.45rem" }}>
        {mode === "ready_to_fetch" ? (
          // Soft-reset done → show Update Scores (normal rooms only)
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              className="button"
              disabled={pending}
              onClick={() => void handleUpdate()}
              type="button"
            >
              {pending ? "Updating…" : "Update Scores"}
            </button>
            <button
              className="button ghost"
              disabled={pending}
              onClick={() => { setMode("idle"); setMessage(null); }}
              type="button"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            className={`button ${isSuperRoom ? "danger" : "ghost"}`}
            disabled={pending}
            onClick={() => { setError(null); setMessage(null); setMode("confirm"); }}
            type="button"
          >
            {pending ? "Resetting…" : mode === "done" ? "Reset Points Again" : "Reset Points"}
          </button>
        )}

        {message && <div className="notice success" style={{ maxWidth: "340px" }}>{message}</div>}
        {error   && <div className="notice warning" style={{ maxWidth: "340px" }}>{error}</div>}
      </div>

      {mode === "confirm" && (
        <div
          className="app-modal-backdrop"
          onClick={() => !pending && setMode("idle")}
        >
          <div
            className="app-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="app-modal-head">
              <h3 style={{ margin: 0 }}>
                {isSuperRoom ? "Full DB reset" : "Reset room points"}
              </h3>
            </div>
            <p className="subtle" style={{ margin: 0, lineHeight: 1.6 }}>
              {confirmDescription}
            </p>
            <div className="app-modal-actions">
              <button
                className="button ghost"
                disabled={pending}
                onClick={() => setMode("idle")}
                type="button"
              >
                Cancel
              </button>
              <button
                className="button danger"
                disabled={pending}
                onClick={() => void (isSuperRoom ? handleDbReset() : handleSoftReset())}
                type="button"
              >
                {pending ? "Resetting…" : "Confirm reset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
