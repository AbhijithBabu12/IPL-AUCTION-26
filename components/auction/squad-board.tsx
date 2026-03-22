"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { AuctionPhase, Player, SquadEntry, Team } from "@/lib/domain/types";
import { formatCurrencyShort } from "@/lib/utils";

async function renameTeam(
  roomCode: string,
  teamId: string,
  name: string,
): Promise<string | null> {
  const res = await fetch(`/api/rooms/${roomCode}/teams/${teamId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const payload = (await res.json()) as { error?: string };
  if (!res.ok) return payload.error ?? "Rename failed.";
  return null;
}

function PlayerRow({
  entry,
  player,
  canRelease,
  roomCode,
}: {
  entry: SquadEntry;
  player: Player | null;
  canRelease: boolean;
  roomCode: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRelease() {
    if (!window.confirm(`Release ${player?.name ?? "this player"}? Their purchase price will be returned to the team purse.`)) return;
    setPending(true);
    const err = await releasePlayer(roomCode, entry.id);
    if (err) setError(err);
    else router.refresh();
    setPending(false);
  }

  return (
    <div className="squad-player-row" style={{ gap: "0.4rem" }}>
      <span className="squad-player-name">{player?.name ?? "Unknown"}</span>
      <span className="squad-player-role">{player?.role ?? ""}</span>
      <span className="squad-player-price">{formatCurrencyShort(entry.purchasePrice)}</span>
      {canRelease && (
        <button
          className="squad-edit-btn"
          disabled={pending}
          onClick={() => void handleRelease()}
          style={{ color: "var(--danger)", opacity: 0.7 }}
          title="Release player (return to pool)"
          type="button"
        >
          ✕
        </button>
      )}
      {error && (
        <span style={{ fontSize: "0.7rem", color: "var(--danger)" }}>{error}</span>
      )}
    </div>
  );
}

async function releasePlayer(roomCode: string, entryId: string): Promise<string | null> {
  const res = await fetch(`/api/rooms/${roomCode}/squad/${entryId}`, { method: "DELETE" });
  const payload = (await res.json()) as { error?: string };
  if (!res.ok) return payload.error ?? "Release failed.";
  return null;
}

function TeamSection({
  team,
  entries,
  players,
  canRename,
  canRelease,
  roomCode,
  phase,
}: {
  team: Team;
  entries: SquadEntry[];
  players: Map<string, Player>;
  canRename: boolean;
  canRelease: boolean;
  roomCode: string;
  phase: AuctionPhase;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(team.name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLive = phase === "LIVE";

  async function handleRename() {
    if (nameInput.trim() === team.name || !nameInput.trim()) {
      setEditing(false);
      return;
    }
    setPending(true);
    const err = await renameTeam(roomCode, team.id, nameInput.trim());
    setPending(false);
    if (err) {
      setError(err);
    } else {
      setError(null);
      setEditing(false);
      router.refresh();
    }
  }

  return (
    <div className="squad-team">
      <div className="squad-team-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, minWidth: 0 }}>
          <span className="squad-shortcode">{team.shortCode}</span>
          {editing ? (
            <input
              autoFocus
              className="input squad-rename-input"
              disabled={pending}
              value={nameInput}
              onBlur={() => void handleRename()}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleRename();
                if (e.key === "Escape") { setEditing(false); setNameInput(team.name); }
              }}
            />
          ) : (
            <span className="squad-team-name" title={team.name}>{team.name}</span>
          )}
          {canRename && !isLive && !editing && (
            <button
              className="squad-edit-btn"
              title="Rename team"
              type="button"
              onClick={() => { setEditing(true); setNameInput(team.name); }}
            >
              ✎
            </button>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
          <span className="subtle" style={{ fontSize: "0.78rem" }}>
            {entries.length}/{team.squadLimit}
          </span>
          <span className="squad-purse">{formatCurrencyShort(team.purseRemaining)}</span>
        </div>
      </div>
      {error ? (
        <div style={{ padding: "0.25rem 0.75rem", fontSize: "0.78rem", color: "var(--danger)" }}>
          {error}
        </div>
      ) : null}
      {entries.length === 0 ? (
        <div className="squad-empty">No players yet</div>
      ) : (
        <div className="squad-players">
          {entries.map((entry) => {
            const player = players.get(entry.playerId);
            return (
              <PlayerRow
                canRelease={canRelease}
                entry={entry}
                key={entry.id}
                player={player ?? null}
                roomCode={roomCode}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SquadBoard({
  teams,
  squads,
  players,
  roomCode,
  phase,
  currentUserId,
  isAdmin = false,
}: {
  teams: Team[];
  squads: SquadEntry[];
  players: Player[];
  roomCode: string;
  phase: AuctionPhase;
  currentUserId: string | null;
  isAdmin?: boolean;
}) {
  const playerById = new Map(players.map((p) => [p.id, p]));

  return (
    <div className="panel squad-board-panel">
      <h2>Squads</h2>
      <div className="squad-board">
        {teams.map((team) => {
          const entries = squads.filter((s) => s.teamId === team.id);
          const isOwner = currentUserId !== null && team.ownerUserId === currentUserId;
          const canRename = isOwner;
          const canRelease = isAdmin || isOwner;

          return (
            <TeamSection
              canRelease={canRelease}
              canRename={canRename}
              entries={entries}
              key={team.id}
              phase={phase}
              players={playerById}
              roomCode={roomCode}
              team={team}
            />
          );
        })}
      </div>
    </div>
  );
}
