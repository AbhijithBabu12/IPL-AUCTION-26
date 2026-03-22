import type { Player, SquadEntry, Team, TeamScore } from "@/lib/domain/types";

function numericStat(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function scorePlayer(player: Player) {
  const stats = player.stats ?? {};

  return (
    numericStat(stats.runs) +
    numericStat(stats.fours) * 1 +
    numericStat(stats.sixes) * 2 +
    numericStat(stats.wickets) * 25 +
    numericStat(stats.catches) * 8 +
    numericStat(stats.stumpings) * 12 +
    numericStat(stats.playerOfTheMatch) * 20
  );
}

export function buildTeamLeaderboard(
  teams: Team[],
  squads: SquadEntry[],
  players: Player[],
) {
  const playerById = new Map(players.map((player) => [player.id, player]));

  const leaderboard: TeamScore[] = teams.map((team) => {
    const teamSquad = squads.filter((entry) => entry.teamId === team.id);
    const totalPoints = teamSquad.reduce((sum, entry) => {
      const player = playerById.get(entry.playerId);
      return sum + (player ? scorePlayer(player) : 0);
    }, 0);

    return {
      teamId: team.id,
      teamName: team.name,
      totalPoints,
      remainingPurse: team.purseRemaining,
      squadCount: teamSquad.length,
    };
  });

  return leaderboard.sort((left, right) => right.totalPoints - left.totalPoints);
}
