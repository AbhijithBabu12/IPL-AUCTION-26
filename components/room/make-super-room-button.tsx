"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { toErrorMessage } from "@/lib/utils";

interface MakeSuperRoomButtonProps {
  roomCode: string;
}

export function MakeSuperRoomButton({ roomCode }: MakeSuperRoomButtonProps) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${roomCode}/make-super`, { method: "POST" });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to convert room.");
      router.refresh();
    } catch (err) {
      setError(toErrorMessage(err));
      setConfirm(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        className="button ghost"
        style={{ color: "var(--error, #f87171)", fontSize: "0.85rem" }}
        onClick={() => { setError(null); setConfirm(true); }}
        type="button"
      >
        Convert to Super Room
      </button>
      {error && (
        <div className="notice warning" style={{ marginTop: "0.5rem", fontSize: "0.82rem" }}>
          {error}
        </div>
      )}

      {confirm && (
        <div
          className="app-modal-backdrop"
          onClick={() => !pending && setConfirm(false)}
        >
          <div
            className="app-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="app-modal-head">
              <h3 style={{ margin: 0 }}>Convert to Super Room?</h3>
            </div>
            <div className="subtle" style={{ lineHeight: 1.7, fontSize: "0.9rem" }}>
              <p style={{ margin: "0 0 0.6rem" }}>This marks the room as a <strong>super room</strong>. Once set, it cannot be undone from the UI.</p>
              <p style={{ margin: "0 0 0.4rem" }}>A super room:</p>
              <ul style={{ margin: "0 0 0.75rem", paddingLeft: "1.25rem" }}>
                <li>Is excluded from all global score pushes</li>
                <li>Is hidden from the lobby</li>
                <li>Gets Cricsheet Sync and Live Score Sync tools</li>
                <li>Is eligible for Full DB Reset in the admin panel</li>
              </ul>
              <p style={{ margin: 0 }}>Use this for a private sandbox or testing room.</p>
            </div>
            <div className="app-modal-actions">
              <button
                className="button ghost"
                disabled={pending}
                onClick={() => setConfirm(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="button danger"
                disabled={pending}
                onClick={() => void handleConfirm()}
                type="button"
              >
                {pending ? "Converting…" : "Yes, convert"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
