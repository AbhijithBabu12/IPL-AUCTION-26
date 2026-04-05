"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { toErrorMessage } from "@/lib/utils";

export function ResultsResetButton({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    const confirmed = window.confirm(
      "Reset all player points in this room? You can sync or calculate them again after reset.",
    );

    if (!confirmed) return;

    setPending(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/rooms/${roomCode}/results/reset`, {
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string; playersReset?: number };

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not reset points.");
      }

      setMessage(`Reset points for ${payload.playersReset ?? 0} players.`);
      router.refresh();
    } catch (resetError) {
      setError(toErrorMessage(resetError));
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.45rem" }}>
      <button className="button danger" disabled={pending} onClick={() => void handleReset()} type="button">
        {pending ? "Resetting..." : "Reset points"}
      </button>
      {message ? <div className="notice success" style={{ maxWidth: "320px" }}>{message}</div> : null}
      {error ? <div className="notice warning" style={{ maxWidth: "320px" }}>{error}</div> : null}
    </div>
  );
}
