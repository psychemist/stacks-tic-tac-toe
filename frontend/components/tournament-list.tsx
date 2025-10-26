"use client";

import { Tournament, TOURNAMENT_STATUS } from "@/lib/tournament-contract";
import Link from "next/link";

interface TournamentListProps {
  tournaments: Tournament[];
  loading?: boolean;
}

export function TournamentList({ tournaments, loading }: TournamentListProps) {
  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (tournaments.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500">
        <p className="text-lg">No tournaments available</p>
        <p className="text-sm mt-2">Create the first one!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
      {tournaments.map((tournament) => (
        <TournamentCard key={tournament.id} tournament={tournament} />
      ))}
    </div>
  );
}

interface TournamentCardProps {
  tournament: Tournament;
}

function TournamentCard({ tournament }: TournamentCardProps) {
  const getStatusBadge = (status: number) => {
    switch (status) {
      case TOURNAMENT_STATUS.OPEN:
        return <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm">🟢 Open</span>;
      case TOURNAMENT_STATUS.IN_PROGRESS:
        return <span className="bg-yellow-500 text-white px-3 py-1 rounded-full text-sm">🟡 In Progress</span>;
      case TOURNAMENT_STATUS.COMPLETED:
        return <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm">🔵 Completed</span>;
      case TOURNAMENT_STATUS.CANCELLED:
        return <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm">🔴 Cancelled</span>;
      default:
        return <span className="bg-gray-500 text-white px-3 py-1 rounded-full text-sm">Unknown</span>;
    }
  };

  // Calculate player count (would need to track this separately or query contract)
  const playerCount = 0; // Placeholder - needs implementation
  const progress = `${playerCount}/${tournament.maxPlayers}`;

  return (
    <Link href={`/tournaments/${tournament.id}`}>
      <div className="border rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer bg-white">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold text-gray-800 truncate flex-1">
            {tournament.name}
          </h3>
          {getStatusBadge(tournament.status)}
        </div>

        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Entry Fee:</span>
            <span className="font-semibold">{(tournament.entryFee / 1_000_000).toFixed(6)} STX</span>
          </div>

          <div className="flex justify-between">
            <span>Prize Pool:</span>
            <span className="font-semibold text-green-600">
              {(tournament.prizePool / 1_000_000).toFixed(6)} STX
            </span>
          </div>

          <div className="flex justify-between">
            <span>Players:</span>
            <span className="font-semibold">{progress}</span>
          </div>

          <div className="flex justify-between">
            <span>Max Players:</span>
            <span className="font-semibold">{tournament.maxPlayers}</span>
          </div>

          {tournament.currentRound > 0 && (
            <div className="flex justify-between">
              <span>Current Round:</span>
              <span className="font-semibold">Round {tournament.currentRound}</span>
            </div>
          )}

          {tournament.winner && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span>Winner:</span>
                <span className="font-mono text-xs bg-yellow-100 px-2 py-1 rounded">
                  {tournament.winner.slice(0, 8)}...{tournament.winner.slice(-6)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t text-xs text-gray-500">
          <div>Created by: {tournament.creator.slice(0, 8)}...{tournament.creator.slice(-6)}</div>
        </div>
      </div>
    </Link>
  );
}
