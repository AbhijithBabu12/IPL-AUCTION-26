"use client";

import { exportToExcelMultiSheet } from "@/lib/utils/export";
import { scorePlayer } from "@/lib/domain/scoring";
import type { Player, Room, SquadEntry, Team } from "@/lib/domain/types";
import type { ExportColumn } from "@/lib/utils/export";

function toLakhs(amount: number): number {
  return Math.round((amount / 100_000) * 100) / 100;
}

function formatWorkbookPrice(amount: number): string {
  if (amount >= 10_000_000) {
    const crores = amount / 10_000_000;
    return `Rs.${Number(crores.toFixed(2)).toString()} Cr`;
  }

  if (amount >= 100_000) {
    const lakhs = amount / 100_000;
    return `Rs.${Number(lakhs.toFixed(2)).toString()} L`;
  }

  if (amount >= 1_000) {
    const thousands = amount / 1_000;
    return `Rs.${Number(thousands.toFixed(2)).toString()} K`;
  }

  return `Rs.${amount}`;
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[\\/*?:[\]]/g, "").slice(0, 31) || "Sheet";
}

interface RoomAuctionExportButtonProps {
  room: Room;
  teams: Team[];
  players: Player[];
  squads: SquadEntry[];
}

export function RoomAuctionExportButton({
  room,
  teams,
  players,
  squads,
}: RoomAuctionExportButtonProps) {
  async function handleExport() {
    const playerById = new Map(players.map((player) => [player.id, player]));
    const sheets: Array<{
      name: string;
      rows: Record<string, string | number>[];
      columns: ExportColumn[];
    }> = [];

    for (const team of teams) {
      const teamSquads = squads
        .filter((entry) => entry.teamId === team.id)
        .map((entry, index) => {
          const player = playerById.get(entry.playerId);
          const stats = player ? scorePlayer(player) : 0;
          const iplTeam = String(player?.stats?.["ipl_team"] ?? "");

          return {
            "#": index + 1,
            Player: player?.name ?? "Unknown player",
            Role: player?.role ?? "",
            "IPL Team": iplTeam,
            Price: formatWorkbookPrice(entry.purchasePrice),
            "Price (Rs.L)": toLakhs(entry.purchasePrice),
            Points: stats,
          };
        });

      const rows = [
        ...teamSquads,
        {
          "#": "",
          Player: "REMAINING PURSE",
          Role: "",
          "IPL Team": "",
          Price: formatWorkbookPrice(team.purseRemaining),
          "Price (Rs.L)": toLakhs(team.purseRemaining),
          Points: "",
        },
      ];

      sheets.push({
        name: sanitizeSheetName(team.name),
        rows,
        columns: [
          { key: "#", header: "#" },
          { key: "Player", header: "Player" },
          { key: "Role", header: "Role" },
          { key: "IPL Team", header: "IPL Team" },
          { key: "Price", header: "Price" },
          { key: "Price (Rs.L)", header: "Price (Rs.L)" },
          { key: "Points", header: "Points" },
        ],
      });
    }

    const unsoldPlayers = players
      .filter((player) => player.status !== "SOLD")
      .map((player, index) => ({
        "#": index + 1,
        Player: player.name,
        Role: player.role,
        "IPL Team": String(player.stats?.["ipl_team"] ?? ""),
        "Base Price": formatWorkbookPrice(player.basePrice),
      }));

    sheets.push({
      name: "Unsold Players",
      rows: unsoldPlayers,
      columns: [
        { key: "#", header: "#" },
        { key: "Player", header: "Player" },
        { key: "Role", header: "Role" },
        { key: "IPL Team", header: "IPL Team" },
        { key: "Base Price", header: "Base Price" },
      ],
    });

    await exportToExcelMultiSheet(sheets, `${room.name}-auction-teams`);
  }

  return (
    <button className="button secondary" onClick={() => void handleExport()} type="button">
      Download auction Excel
    </button>
  );
}
