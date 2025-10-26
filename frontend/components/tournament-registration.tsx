"use client";

import { Tournament, TOURNAMENT_STATUS } from "@/lib/tournament-contract";
import { useState } from "react";

interface TournamentRegistrationProps {
  tournament: Tournament;
  userAddress: string | null;
  onJoin: (tournamentId: number) => void;
  onStart: (tournamentId: number) => void;
  isParticipant: boolean;
}

export function TournamentRegistration({
  tournament,
  userAddress,
  onJoin,
  onStart,
  isParticipant,
}: TournamentRegistrationProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const isCreator = userAddress === tournament.creator;
  const canJoin = tournament.status === TOURNAMENT_STATUS.OPEN && !isParticipant && userAddress;
  const canStart = tournament.status === TOURNAMENT_STATUS.OPEN && isCreator;

  const handleJoin = async () => {
    setIsProcessing(true);
    try {
      await onJoin(tournament.id);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStart = async () => {
    setIsProcessing(true);
    try {
      await onStart(tournament.id);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!userAddress) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
        <p className="text-yellow-800">Connect your wallet to participate</p>
      </div>
    );
  }

  if (tournament.status === TOURNAMENT_STATUS.COMPLETED) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
        <p className="text-blue-800 font-semibold">Tournament Completed</p>
        {tournament.winner && (
          <p className="text-sm text-blue-600 mt-2">
            Winner: {tournament.winner.slice(0, 12)}...{tournament.winner.slice(-8)}
          </p>
        )}
      </div>
    );
  }

  if (tournament.status === TOURNAMENT_STATUS.IN_PROGRESS) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
        <p className="text-green-800 font-semibold">Tournament in Progress</p>
        <p className="text-sm text-green-600 mt-2">Round {tournament.currentRound}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isParticipant && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p className="text-green-800 font-semibold">✓ You are registered</p>
        </div>
      )}

      {canJoin && (
        <button
          onClick={handleJoin}
          disabled={isProcessing}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
        >
          {isProcessing ? "Processing..." : `Join Tournament (${(tournament.entryFee / 1_000_000).toFixed(6)} STX)`}
        </button>
      )}

      {canStart && (
        <button
          onClick={handleStart}
          disabled={isProcessing}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
        >
          {isProcessing ? "Processing..." : "Start Tournament"}
        </button>
      )}

      {isCreator && !canStart && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <p className="text-yellow-800 text-sm">
            Waiting for {tournament.maxPlayers} players to join
          </p>
        </div>
      )}
    </div>
  );
}
