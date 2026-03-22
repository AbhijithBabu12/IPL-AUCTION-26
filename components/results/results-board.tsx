import type { ResultsSnapshot } from "@/lib/domain/types";
import { formatCurrency } from "@/lib/utils";

export function ResultsBoard({ snapshot }: { snapshot: ResultsSnapshot }) {
  const squadsByTeamId = new Map(
    snapshot.teams.map((team) => [
      team.id,
      snapshot.squads.filter((entry) => entry.teamId === team.id),
    ]),
  );

  return (
    <div className="grid" style={{ marginTop: "1rem" }}>
      <section className="panel">
        <span className="eyebrow">Scoring and squads</span>
        <h1 className="page-title" style={{ fontSize: "3rem", marginTop: "0.5rem" }}>
          {snapshot.room.name}
        </h1>
        <div className="stats-strip" style={{ marginTop: "1rem" }}>
          <div className="stat-tile">
            <strong>{snapshot.leaderboard.length}</strong>
            Teams ranked
          </div>
          <div className="stat-tile">
            <strong>{snapshot.squads.length}</strong>
            Players sold
          </div>
          <div className="stat-tile">
            <strong>{snapshot.trades.length}</strong>
            Trades executed
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Leaderboard</h2>
        <div className="leaderboard">
          {snapshot.leaderboard.map((teamScore, index) => (
            <div className="leader-row" key={teamScore.teamId}>
              <strong>#{index + 1}</strong>
              <strong>{teamScore.teamName}</strong>
              <span>{teamScore.totalPoints} pts</span>
              <span>{teamScore.squadCount} players</span>
              <span>{formatCurrency(teamScore.remainingPurse)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid two">
        <div className="panel">
          <h2>Squads</h2>
          <div className="card-list">
            {snapshot.teams.map((team) => (
              <div className="trade-card" key={team.id}>
                <div className="header-row">
                  <strong>{team.name}</strong>
                  <span className="pill highlight">
                    {formatCurrency(team.purseRemaining)}
                  </span>
                </div>
                <div className="card-list" style={{ marginTop: "0.75rem" }}>
                  {(squadsByTeamId.get(team.id) ?? []).map((entry) => (
                    <div className="bid-row" key={entry.id}>
                      <strong>{entry.player?.name ?? "Unknown player"}</strong> •{" "}
                      {formatCurrency(entry.purchasePrice)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>Trade history</h2>
          {snapshot.trades.length === 0 ? (
            <div className="empty-state">No trades have been executed yet.</div>
          ) : (
            <div className="card-list">
              {snapshot.trades.map((trade) => (
                <div className="trade-card" key={trade.id}>
                  <strong>
                    {snapshot.teams.find((team) => team.id === trade.teamAId)?.name ??
                      "Team A"}
                    {" "}
                    ↔{" "}
                    {snapshot.teams.find((team) => team.id === trade.teamBId)?.name ??
                      "Team B"}
                  </strong>
                  <div className="subtle">
                    Cash: {formatCurrency(trade.cashFromA)} /{" "}
                    {formatCurrency(trade.cashFromB)}
                  </div>
                  <div className="pill-row" style={{ marginTop: "0.65rem" }}>
                    <span className="pill">A players: {trade.playersFromA.length}</span>
                    <span className="pill">B players: {trade.playersFromB.length}</span>
                    <span className="pill highlight">{trade.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
