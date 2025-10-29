"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
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
    handleAdvanceRound,
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
      
      // Calculate player count from prize pool
      if (t) {
        t.playerCount = t.entryFee > 0 ? Math.floor(t.prizePool / t.entryFee) : 0;
      }
      
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
        <h1 className="text-4xl font-bold text-gray-400 mb-2">{tournament.name}</h1>
        <p className="text-gray-500 mb-8">{getStatusLabel(tournament.status)}</p>

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
              <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {tournament.creator.slice(0, 12)}...{tournament.creator.slice(-8)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Current Round:</span>
              <span className="font-semibold text-gray-500">{tournament.currentRound || "Not started"}</span>
            </div>
            {tournament.winner && (
              <div className="flex justify-between">
                <span className="text-gray-600">Winner:</span>
                <span className="font-mono text-xs text-gray-500 bg-yellow-100 px-2 py-1 rounded">
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
          onAdvanceRound={handleAdvanceRound}
          isParticipant={isParticipant}
        />

        {/* User's Active Match */}
        {userAddress && isParticipant && tournament.status === TOURNAMENT_STATUS.IN_PROGRESS && (
          <div className="mt-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">🎮 Your Match</h2>
            </div>
            {(() => {
              // Find user's active match across all rounds
              let activeMatch: { match: TournamentMatch; roundIndex: number } | null = null;

              for (let roundIndex = 0; roundIndex < roundMatches.length; roundIndex++) {
                const matches = roundMatches[roundIndex];
                const userMatch = matches.find(
                  (match) =>
                    match.player1 === userAddress ||
                    match.player2 === userAddress
                );

                if (userMatch && !userMatch.completed) {
                  activeMatch = { match: userMatch, roundIndex };
                  break;
                }
              }
              
              if (activeMatch) {
                const { match, roundIndex } = activeMatch;
                const opponent = match.player1 === userAddress ? match.player2 : match.player1;
                
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm opacity-90">Round {roundIndex + 1}</p>
                        <p className="text-lg font-semibold">
                          vs {opponent ? `${opponent.slice(0, 8)}...${opponent.slice(-6)}` : 'TBD'}
                        </p>
                        {match.gameId === null && (
                          <p className="text-xs opacity-75 mt-1">Waiting for game to be created...</p>
                        )}
                      </div>
                      {match.gameId !== null ? (
                        <Link
                          href={`/game/${match.gameId}`}
                          className="bg-white text-blue-600 font-bold py-3 px-8 rounded-lg hover:bg-blue-50 transition-colors shadow-md"
                        >
                          Play Now →
                        </Link>
                      ) : (
                        <button
                          disabled
                          className="bg-gray-300 text-gray-600 font-bold py-3 px-8 rounded-lg cursor-not-allowed opacity-75"
                        >
                          Game Starting...
                        </button>
                      )}
                    </div>
                  </div>
                );
              }
              
              return (
                <p className="text-sm opacity-90">
                  No active matches at the moment. Check the bracket below for details.
                </p>
              );
            })()}
          </div>
        )}

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
