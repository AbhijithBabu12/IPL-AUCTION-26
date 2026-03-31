import { NextRequest, NextResponse } from "next/server";
import { findRoomByCode, getRoomEntities } from "@/lib/server/room";
import { buildTeamLeaderboard } from "@/lib/domain/scoring";

type AiResponse =
  | { type: "navigation"; route?: string; target?: string }
  | {
      type: "action";
      action:
        | "join_room"
        | "create_room"
        | "show_bid_options"
        | "auction_bid"
        | "start_auction"
        | "show_leading_team";
      room_code?: string;
      amount_text?: string;
    }
  | { type: "info"; message: string };

function parseDirectCommand(input: string): AiResponse | null {
  const message = input.trim();
  const lower = message.toLowerCase();

  const joinRoom = message.match(/\b(?:join|go\s*to|take\s*me\s*to|open)\s+(?:room\s+)?([a-z0-9]{5,8})\b/i);
  if (joinRoom && !/\b(?:results|dashboard|lobby|login|auction)\b/i.test(joinRoom[1])) {
    return {
      type: "action",
      action: "join_room",
      room_code: joinRoom[1]?.toUpperCase(),
    };
  }

  if (
    /\b(create|make|start)\s+(a\s+)?room\b/i.test(lower) ||
    /\bnew room\b/i.test(lower)
  ) {
    return { type: "action", action: "create_room" };
  }

  if (/\b(start|open)\s+auction\b/i.test(lower) || /\bstart auction again\b/i.test(lower)) {
    return { type: "action", action: "start_auction" };
  }

  if (
    /\b(best bid|best option|show bid options|show bids|what can i bid|what should i bid)\b/i.test(
      lower,
    )
  ) {
    return { type: "action", action: "show_bid_options" };
  }

  if (/\b(who is leading|leading team|current leader)\b/i.test(lower)) {
    return { type: "action", action: "show_leading_team" };
  }

  const bidMatch = message.match(
    /\bbid\s+([0-9]+(?:\.[0-9]+)?\s*(?:cr|crore|crores|l|lac|lakh|lakhs|k|thousand)?)\b/i,
  );
  if (bidMatch) {
    return {
      type: "action",
      action: "auction_bid",
      amount_text: bidMatch[1]?.replace(/\s+/g, ""),
    };
  }

  if (/\b(go to|take me to|open)\s+auction\b/i.test(lower)) {
    return { type: "navigation", target: "auction" };
  }

  if (/\b(go to|take me to|open)\s+lobby\b/i.test(lower)) {
    return { type: "navigation", route: "/lobby" };
  }

  if (/\b(go to|take me to|open)\s+login\b/i.test(lower)) {
    return { type: "navigation", route: "/login" };
  }

  if (/\b(go to|take me to|open|show)\s+(results|dashboard)\b/i.test(lower)) {
    return { type: "navigation", target: "results" };
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { message, roomCode } = (await req.json()) as { message?: string; roomCode?: string };
    const trimmed = message?.trim();

    if (!trimmed) {
      return NextResponse.json(
        { type: "info", message: "Ask me to join a room, open auction, or place a bid." },
        { status: 400 },
      );
    }

    const direct = parseDirectCommand(trimmed);
    if (direct) {
      return NextResponse.json(direct);
    }

    let roomContext = "";
    let dataRule = "";

    if (roomCode) {
      try {
        const room = await findRoomByCode(roomCode);
        const { players, teams, squads } = await getRoomEntities(room.id);
        const leaderboard = buildTeamLeaderboard(teams, squads, players);

        const teamStrs = leaderboard.map(l => `${l.teamName}: ${l.totalPoints} pts, ${l.remainingPurse} purse remaining, ${l.squadCount} players`).join("\n");
        let playerStrs = players.map(p => {
          const squad = squads.find(s => s.playerId === p.id);
          const team = squad ? teams.find(t => t.id === squad.teamId) : null;
          return `${p.name} (${p.role}): Base ${p.basePrice}L. ${squad ? `Sold to ${team?.name} for ${squad.purchasePrice}L in Round ${squad.acquiredInRound}` : p.status}`;
        }).join("\n");

        if (playerStrs.length > 10000) {
           const queryWords = trimmed.toLowerCase().split(/\s+/).filter(w => w.length > 2);
           const matchedPlayers = players.filter(p => queryWords.some(w => p.name.toLowerCase().includes(w)));
           const soldPlayers = players.filter(p => p.status === "SOLD");
           
           const combined = Array.from(new Set([...matchedPlayers, ...soldPlayers, ...players]));
           
           playerStrs = combined.slice(0, 100).map(p => {
             const squad = squads.find(s => s.playerId === p.id);
             const team = squad ? teams.find(t => t.id === squad.teamId) : null;
             return `${p.name} (${p.role}): Base ${p.basePrice}L. ${squad ? `Sold to ${team?.name} for ${squad.purchasePrice}L` : p.status}`;
           }).join("\n") + "\n(Some players truncated due to context size)";
        }

        roomContext = `\n\n[LIVE ROOM DATA FOR ROOM ${roomCode} - USE THIS TO ANSWER QUESTIONS ABOUT PLAYERS AND TEAMS]:\nTeams & Scoreboard:\n${teamStrs}\n\nPlayers Registry:\n${playerStrs}`;
        dataRule = `\nCRITICAL RULE: I am providing you with LIVE ROOM DATA at the bottom of this prompt. Whenever the user asks a question about a player, a team, the scoreboard, or who bought someone, YOU MUST ONLY use the LIVE ROOM DATA below to answer. Do NOT use your pre-trained real-world IPL knowledge. If the data says a player is unsold, tell them they are unsold. Reply with the answer inside an "info" response type.`;
      } catch (err) {
        console.error("Failed to load room context for AI", err);
      }
    }

    const identityPrompt = `
You are "Rocky", the SFL cricket bot for a fantasy IPL auction app.
When asked who you are, reply that you are Rocky, the SFL cricket bot.
When asked who made you, reply that you were made by SFL cricket league developers.
For technical or coding questions, say you are Rocky, an SFL cricket bot and not a personal assistant.
If the user makes casual conversation (e.g., "how are you", "hi", "how is your day"), reply naturally and friendly as Rocky using the "info" response type.
${dataRule}
`;

    const formatConstraints = `
CRITICAL FORMATTING RULES:
Output ONLY valid JSON.
No markdown.
No explanation.

Valid shapes:
{ "type": "navigation", "route": string, "target"?: string }
{ "type": "action", "action": string, "room_code"?: string, "amount_text"?: string }
{ "type": "info", "message": string }

Supported actions:
- join_room
- create_room
- show_bid_options
- auction_bid
- start_auction
- show_leading_team

If the user says something like "bid 50L" or "bid 1Cr", return:
{ "type": "action", "action": "auction_bid", "amount_text": "50L" }

If the user asks "how to join an auction", "how to play", or "how to start":
{ "type": "navigation", "route": "/login", "message": "To join an auction, please log in first, create a team, and then you can join or start an auction room! I'll take you to the login page right now." }
`;

    const finalSystemPrompt = `${identityPrompt}\n${roomContext}\n${formatConstraints}`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: finalSystemPrompt },
          { role: "user", content: trimmed },
        ],
        temperature: 0.2,
      }),
    });

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const rawContent = data.choices?.[0]?.message?.content ?? "";
    const cleanContent = rawContent.replace(/```json/i, "").replace(/```/g, "").trim();

    try {
      return NextResponse.json(JSON.parse(cleanContent));
    } catch {
      return NextResponse.json({ type: "info", message: cleanContent || "I could not understand that." });
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
