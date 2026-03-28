"use client";

import { ExportButton } from "@/components/ui/export-button";
import type { ResultsSnapshot } from "@/lib/domain/types";
import { scorePlayer } from "@/lib/domain/scoring";
import { formatCurrencyShort } from "@/lib/utils";
import { downloadPngFromSvg, downloadSimplePdf } from "@/lib/utils/report-export";

const LEADERBOARD_COLS = [
  { key: "rank", header: "Rank" },
  { key: "teamName", header: "Team" },
  { key: "totalPoints", header: "Total Points" },
  { key: "remainingPurse", header: "Purse Remaining" },
  { key: "squadCount", header: "Players" },
];

const PLAYERS_COLS = [
  { key: "rank", header: "Rank" },
  { key: "playerName", header: "Player" },
  { key: "role", header: "Role" },
  { key: "team", header: "Team" },
  { key: "points", header: "Points" },
  { key: "purchasePrice", header: "Purchase Price" },
];

export function ResultsExportBar({ snapshot }: { snapshot: ResultsSnapshot }) {
  const teamById = new Map(snapshot.teams.map((t) => [t.id, t]));

  function getLeaderboardRows() {
    return snapshot.leaderboard.map((ts, i) => ({
      rank: i + 1,
      teamName: ts.teamName,
      totalPoints: ts.totalPoints,
      remainingPurse: ts.remainingPurse,
      squadCount: ts.squadCount,
    }));
  }

  function getPlayerRows() {
    return snapshot.squads
      .map((entry, i) => ({
        rank: i + 1,
        playerName: entry.player?.name ?? "Unknown",
        role: entry.player?.role ?? "",
        team: teamById.get(entry.teamId)?.name ?? "",
        points: entry.player ? scorePlayer(entry.player) : 0,
        purchasePrice: entry.purchasePrice,
      }))
      .sort((a, b) => b.points - a.points)
      .map((row, i) => ({ ...row, rank: i + 1 }));
  }

  function getTeamPlayerSheets() {
    return snapshot.teams.map((team, teamIndex) => {
      const players = snapshot.squads
        .filter((entry) => entry.teamId === team.id)
        .map((entry) => ({
          name: entry.player?.name ?? "Unknown player",
          role: entry.player?.role ?? "Player",
          points: entry.player ? scorePlayer(entry.player) : 0,
          price: entry.purchasePrice,
        }))
        .sort((left, right) => right.points - left.points || right.price - left.price);

      return {
        team,
        rank: teamIndex + 1,
        players,
      };
    });
  }

  function buildLeaderboardSvg() {
    const rows = snapshot.leaderboard;
    const width = 1200;
    const headerHeight = 120;
    const rowHeight = 74;
    const height = headerHeight + rows.length * rowHeight + 40;

    const rowMarkup = rows
      .map((team, index) => {
        const y = headerHeight + index * rowHeight;
        return `
          <rect x="36" y="${y}" width="${width - 72}" height="58" rx="20" fill="rgba(20,22,40,0.96)" stroke="rgba(107,114,255,0.22)" />
          <text x="68" y="${y + 36}" font-size="22" font-weight="700" fill="#8b92ff">#${index + 1}</text>
          <text x="145" y="${y + 32}" font-size="24" font-weight="700" fill="#f4f5ff">${team.teamName}</text>
          <text x="145" y="${y + 52}" font-size="15" fill="#97a0c6">${team.squadCount} players</text>
          <text x="${width - 300}" y="${y + 31}" font-size="16" fill="#97a0c6">Purse left</text>
          <text x="${width - 300}" y="${y + 52}" font-size="22" font-weight="700" fill="#25d69b">${formatCurrencyShort(team.remainingPurse)}</text>
          <text x="${width - 120}" y="${y + 42}" text-anchor="end" font-size="28" font-weight="800" fill="#f4f5ff">${team.totalPoints}</text>
        `;
      })
      .join("");

    return {
      width,
      height,
      svg: `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <rect width="100%" height="100%" fill="#090b16" />
          <rect x="0" y="0" width="${width}" height="${height}" fill="url(#bgGlow)" />
          <defs>
            <radialGradient id="bgGlow" cx="20%" cy="0%" r="90%">
              <stop offset="0%" stop-color="#2e3cff" stop-opacity="0.22" />
              <stop offset="55%" stop-color="#0f1223" stop-opacity="0.08" />
              <stop offset="100%" stop-color="#090b16" stop-opacity="0" />
            </radialGradient>
          </defs>
          <text x="36" y="56" font-size="20" font-weight="700" fill="#8b92ff">SFL RESULTS</text>
          <text x="36" y="92" font-size="40" font-weight="800" fill="#f4f5ff">Team Rankings</text>
          ${rowMarkup}
        </svg>
      `,
    };
  }

  async function handleLeaderboardImage() {
    const { svg, width, height } = buildLeaderboardSvg();
    await downloadPngFromSvg(svg, `${snapshot.room.name}-team-rankings.png`, width, height);
  }

  function handleLeaderboardPdf() {
    const lines = snapshot.leaderboard.map(
      (team, index) =>
        `#${index + 1}  ${team.teamName}  |  ${team.totalPoints} pts  |  ${team.squadCount} players  |  Purse ${formatCurrencyShort(team.remainingPurse)}`,
    );
    downloadSimplePdf(
      `${snapshot.room.name}-team-rankings.pdf`,
      `${snapshot.room.name} - Team Rankings`,
      lines,
    );
  }

  function handleTeamPlayersPdf() {
    const lines = getTeamPlayerSheets().flatMap(({ team, rank, players }) => [
      `Rank #${rank} - ${team.name}`,
      ...players.map(
        (player, index) =>
          `  ${index + 1}. ${player.name} | ${player.role} | ${player.points} pts | Bought ${formatCurrencyShort(player.price)}`,
      ),
      "",
    ]);

    downloadSimplePdf(
      `${snapshot.room.name}-team-player-points.pdf`,
      `${snapshot.room.name} - Team Player Points`,
      lines,
    );
  }

  return (
    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
      <ExportButton
        getData={getLeaderboardRows}
        columns={LEADERBOARD_COLS}
        filename={`${snapshot.room.name}-leaderboard`}
        label="Leaderboard"
      />
      <ExportButton
        getData={getPlayerRows}
        columns={PLAYERS_COLS}
        filename={`${snapshot.room.name}-players`}
        label="Player scores"
      />
      <button className="btn-sm" onClick={() => void handleLeaderboardImage()} type="button">
        Rankings image
      </button>
      <button className="btn-sm" onClick={handleLeaderboardPdf} type="button">
        Rankings PDF
      </button>
      <button className="btn-sm" onClick={handleTeamPlayersPdf} type="button">
        Team player PDF
      </button>
    </div>
  );
}
