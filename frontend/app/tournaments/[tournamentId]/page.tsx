"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useStacks } from "@/hooks/use-stacks";
import { useTournaments } from "@/hooks/use-tournaments";
import { TournamentRegistration } from "@/components/tournament-registration";
import { TournamentBracket } from "@/components/tournament-bracket";
import { Tournament, TournamentMatch, TOURNAMENT_STATUS } from "@/lib/tournament-contract";

export default function TournamentDetailPage() {
  const params = useParams();
  const tournamentId = parseInt(params.tournamentId as string);
  
  const { userAddress } = useStacks();
  const {
    fetchTournament,
    fetchParticipant,
    fetchRoundMatches,
    handleJoinTournament,
    handleStartTournament,
  } = useTournaments(userAddress);

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [isParticipant, setIsParticipant] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roundMatches, setRoundMatches] = useState<TournamentMatch[][]>([]);

  useEffect(() => {
    async function loadTournament() {
      setLoading(true);
      const t = await fetchTournament(tournamentId);
      setTournament(t);

      if (t && userAddress) {
        const participant = await fetchParticipant(tournamentId, userAddress);
        setIsParticipant(!!participant);
      }

      // Load bracket data if tournament is in progress or completed
      if (t && (t.status === TOURNAMENT_STATUS.IN_PROGRESS || t.status === TOURNAMENT_STATUS.COMPLETED)) {
        const numRounds = Math.log2(t.maxPlayers);
        const allRounds: TournamentMatch[][] = [];
        
        for (let round = 1; round <= numRounds; round++) {
          const matches = await fetchRoundMatches(tournamentId, round);
          allRounds.push(matches);
        }
        
        setRoundMatches(allRounds);
      }
      
      setLoading(false);
    }

    if (!isNaN(tournamentId)) {
      loadTournament();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, userAddress]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 font-semibold">Tournament not found</p>
        </div>
      </div>
    );
  }

  const getStatusLabel = (status: number) => {
    switch (status) {
      case TOURNAMENT_STATUS.OPEN:
        return "Open for Registration";
      case TOURNAMENT_STATUS.IN_PROGRESS:
        return "In Progress";
      case TOURNAMENT_STATUS.COMPLETED:
        return "Completed";
      case TOURNAMENT_STATUS.CANCELLED:
        return "Cancelled";
      default:
        return "Unknown";
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">{tournament.name}</h1>
        <p className="text-gray-600 mb-8">{getStatusLabel(tournament.status)}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm text-gray-600 mb-1">Entry Fee</h3>
            <p className="text-2xl font-bold text-gray-800">
              {(tournament.entryFee / 1_000_000).toFixed(6)} STX
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm text-gray-600 mb-1">Prize Pool</h3>
            <p className="text-2xl font-bold text-green-600">
              {(tournament.prizePool / 1_000_000).toFixed(6)} STX
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm text-gray-600 mb-1">Max Players</h3>
            <p className="text-2xl font-bold text-gray-800">
              {tournament.maxPlayers}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Tournament Details</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Created by:</span>
              <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                {tournament.creator.slice(0, 12)}...{tournament.creator.slice(-8)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Current Round:</span>
              <span className="font-semibold">{tournament.currentRound || "Not started"}</span>
            </div>
            {tournament.winner && (
              <div className="flex justify-between">
                <span className="text-gray-600">Winner:</span>
                <span className="font-mono text-xs bg-yellow-100 px-2 py-1 rounded">
                  {tournament.winner.slice(0, 12)}...{tournament.winner.slice(-8)}
                </span>
              </div>
            )}
          </div>
        </div>

        <TournamentRegistration
          tournament={tournament}
          userAddress={userAddress}
          onJoin={handleJoinTournament}
          onStart={handleStartTournament}
          isParticipant={isParticipant}
        />

        {(tournament.status === TOURNAMENT_STATUS.IN_PROGRESS || 
          tournament.status === TOURNAMENT_STATUS.COMPLETED) && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Tournament Bracket</h2>
            <TournamentBracket
              tournamentId={tournamentId}
              rounds={roundMatches}
              maxPlayers={tournament.maxPlayers}
            />
          </div>
        )}
      </div>
    </div>
  );
}
