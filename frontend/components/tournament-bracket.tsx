"use client";

import { TournamentMatch } from "@/lib/tournament-contract";
import Link from "next/link";

interface TournamentBracketProps {
  tournamentId: number;
  rounds: TournamentMatch[][];
  maxPlayers: number;
}

export function TournamentBracket({
  tournamentId,
  rounds,
  maxPlayers,
}: TournamentBracketProps) {
  const numRounds = Math.log2(maxPlayers);

  if (rounds.length === 0) {
    return (
      <div className="text-center text-gray-500 p-8">
        <p>No matches available yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex gap-8 p-4 min-w-max">
        {rounds.map((roundMatches, roundIndex) => (
          <div key={roundIndex} className="flex flex-col gap-4">
            <h3 className="text-center font-bold text-gray-700 mb-4">
              {getRoundName(roundIndex + 1, numRounds)}
            </h3>
            
            {roundMatches.map((match, matchIndex) => (
              <MatchCard
                key={matchIndex}
                match={match}
                tournamentId={tournamentId}
                round={roundIndex + 1}
                matchNumber={matchIndex + 1}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface MatchCardProps {
  match: TournamentMatch;
  tournamentId: number;
  round: number;
  matchNumber: number;
}

function MatchCard({ match, matchNumber }: MatchCardProps) {
  const { player1, player2, winner, completed, gameId } = match;

  return (
    <div className="bg-white border-2 rounded-lg p-4 min-w-[250px] shadow-sm">
      <div className="text-xs text-gray-500 mb-2 text-center">
        Match {matchNumber}
      </div>

      <div className="space-y-2">
        <PlayerSlot
          player={player1}
          isWinner={completed && winner === player1}
          label="Player 1"
        />
        
        <div className="text-center text-xs text-gray-400">VS</div>
        
        <PlayerSlot
          player={player2}
          isWinner={completed && winner === player2}
          label="Player 2"
        />
      </div>

      {gameId !== null && (
        <div className="mt-3 pt-3 border-t">
          <Link
            href={`/game/${gameId}`}
            className="text-xs text-blue-600 hover:text-blue-800 block text-center"
          >
            View Game →
          </Link>
        </div>
      )}

      {completed && winner && (
        <div className="mt-2 text-center text-xs font-semibold text-green-600">
          ✓ Complete
        </div>
      )}
    </div>
  );
}

interface PlayerSlotProps {
  player: string | null;
  isWinner: boolean;
  label: string;
}

function PlayerSlot({ player, isWinner, label }: PlayerSlotProps) {
  if (!player) {
    return (
      <div className="bg-gray-100 rounded p-2 text-center text-xs text-gray-400">
        {label}: TBD
      </div>
    );
  }

  return (
    <div
      className={`rounded p-2 text-center text-xs font-mono ${
        isWinner
          ? "bg-green-100 border-2 border-green-500 font-bold"
          : "bg-gray-50 border border-gray-200"
      }`}
    >
      {player.slice(0, 8)}...{player.slice(-6)}
      {isWinner && <span className="ml-2">👑</span>}
    </div>
  );
}

function getRoundName(round: number, totalRounds: number): string {
  if (round === totalRounds) return "Finals";
  if (round === totalRounds - 1) return "Semi-Finals";
  if (round === totalRounds - 2) return "Quarter-Finals";
  return `Round ${round}`;
}
