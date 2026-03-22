"use client";

import Papa from "papaparse";
import { useState } from "react";
import type { ChangeEvent } from "react";
import * as XLSX from "xlsx";

import { toErrorMessage } from "@/lib/utils";

async function readTabularRows(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "csv") {
    const text = await file.text();
    return new Promise<Record<string, unknown>[]>((resolve, reject) => {
      Papa.parse<Record<string, unknown>>(text, {
        header: true,
        skipEmptyLines: true,
        complete(results) {
          resolve(results.data);
        },
        error(err: Error) {
          reject(err);
        },
      });
    });
  }

  if (extension === "xlsx" || extension === "xls") {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });
  }

  throw new Error("Only CSV and Excel files are supported.");
}

function normalizeHeaderKey(key: string) {
  return key.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function normalizePlayers(rows: Record<string, unknown>[]) {
  return rows
    .map((row) => {
      const normalizedRow = Object.fromEntries(
        Object.entries(row).map(([key, value]) => [normalizeHeaderKey(key), value]),
      );

      const name = normalizedRow.name ?? normalizedRow.player;
      const role = normalizedRow.role;
      const nationality = normalizedRow.nationality;
      const basePrice = normalizedRow.baseprice;
      const iplTeam = normalizedRow.iplteam;
      const sourceIndex = normalizedRow["#"];

      const stats = Object.fromEntries(
        Object.entries(normalizedRow).filter(([key]) =>
          !["#", "name", "player", "role", "nationality", "baseprice", "iplteam"].includes(
            key,
          ),
        ),
      );

      if (iplTeam) {
        stats.iplTeam = String(iplTeam).trim();
      }

      if (sourceIndex !== undefined && sourceIndex !== null && sourceIndex !== "") {
        const parsedIndex = Number(sourceIndex);
        stats.sourceIndex = Number.isFinite(parsedIndex)
          ? parsedIndex
          : String(sourceIndex).trim();
      }

      const parsedBasePrice = Number(basePrice ?? 0);

      return {
        name: String(name ?? "").trim(),
        role: String(role ?? "").trim(),
        nationality: nationality ? String(nationality).trim() : null,
        basePrice: Number.isFinite(parsedBasePrice) ? parsedBasePrice : 0,
        stats: Object.keys(stats).length > 0 ? stats : null,
      };
    })
    .filter((player) => player.name && player.role);
}

export function UploadPlayersForm({
  roomCode,
  defaultPlayerCount,
}: {
  roomCode: string;
  defaultPlayerCount: number;
}) {
  const [pendingAction, setPendingAction] = useState<"upload" | "default" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = pendingAction !== null;

  function refreshRoomPage() {
    window.setTimeout(() => {
      window.location.reload();
    }, 300);
  }

  async function importPlayers(players: ReturnType<typeof normalizePlayers>) {
    const response = await fetch(`/api/rooms/${roomCode}/players`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ players }),
    });

    const payload = (await response.json()) as {
      error?: string;
      imported?: number;
    };

    if (!response.ok) {
      throw new Error(payload.error ?? "Player upload failed.");
    }

    setMessage(`Imported ${payload.imported ?? players.length} players.`);
    refreshRoomPage();
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setPendingAction("upload");
    setMessage(null);
    setError(null);

    try {
      const rows = await readTabularRows(file);
      const players = normalizePlayers(rows);
      if (players.length === 0) {
        throw new Error("No valid players were found in this spreadsheet.");
      }
      await importPlayers(players);
    } catch (uploadError) {
      setError(toErrorMessage(uploadError));
    } finally {
      setPendingAction(null);
      event.target.value = "";
    }
  }

  async function handleLoadDefaultPlayers() {
    setPendingAction("default");
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/rooms/${roomCode}/players/default`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        imported?: number;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Default player pool import failed.");
      }

      setMessage(`Loaded ${payload.imported ?? defaultPlayerCount} default players.`);
      refreshRoomPage();
    } catch (loadError) {
      setError(toErrorMessage(loadError));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="form-grid">
      <div className="field">
        <label htmlFor="players-upload">Players CSV/XLSX</label>
        <input
          accept=".csv,.xlsx,.xls"
          className="input"
          disabled={pending}
          id="players-upload"
          onChange={handleFile}
          type="file"
        />
      </div>
      <div className="subtle">
        Accepted columns: <span className="mono">name</span> or{" "}
        <span className="mono">Player</span>, <span className="mono">role</span> or{" "}
        <span className="mono">Role</span>, optional{" "}
        <span className="mono">nationality</span>, and optional{" "}
        <span className="mono">basePrice</span>. If pricing is missing, the room
        bid increment becomes the opening bid. Columns like{" "}
        <span className="mono">IPL Team</span> are preserved in player stats.
      </div>
      <button
        className="button secondary"
        disabled={pending}
        onClick={handleLoadDefaultPlayers}
        type="button"
      >
        {pendingAction === "default"
          ? "Loading player pool..."
          : `Load default IPL player pool (${defaultPlayerCount} players)`}
      </button>
      <div className="subtle">
        The built-in pool comes from your uploaded workbook and can seed a fresh
        room in one click.
      </div>
      {message ? <div className="notice">{message}</div> : null}
      {error ? <div className="notice warning">{error}</div> : null}
    </div>
  );
}
