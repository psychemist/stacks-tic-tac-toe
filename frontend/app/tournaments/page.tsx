"use client";

import { useTournaments } from "@/hooks/use-tournaments";
import { useStacks } from "@/hooks/use-stacks";
import { TournamentList } from "@/components/tournament-list";
import Link from "next/link";

export default function TournamentsPage() {
  const { userAddress, isConnected } = useStacks();
  const { tournaments, loading } = useTournaments(userAddress);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-400">Tournaments</h1>
          <p className="text-gray-500 mt-2">Compete in single-elimination tournaments</p>
        </div>
        
        {isConnected && (
          <Link
            href="/tournaments/create"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            Create Tournament
          </Link>
        )}
      </div>

      {!isConnected && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8 text-center">
          <p className="text-yellow-800 font-semibold">Connect your wallet to view and join tournaments</p>
        </div>
      )}

      {loading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-center text-sm text-blue-800">
          <p>Loading tournaments... This may take a moment due to API rate limits.</p>
        </div>
      )}

      <TournamentList tournaments={tournaments} loading={loading} />
    </div>
  );
}
