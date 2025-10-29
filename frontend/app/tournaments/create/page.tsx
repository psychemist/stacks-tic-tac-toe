"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStacks } from "@/hooks/use-stacks";
import { useTournaments } from "@/hooks/use-tournaments";

export default function CreateTournamentPage() {
  const router = useRouter();
  const { userAddress, isConnected } = useStacks();
  const { handleCreateTournament } = useTournaments(userAddress);

  const [name, setName] = useState("");
  const [entryFee, setEntryFee] = useState("0.1");
  const [maxPlayers, setMaxPlayers] = useState<4 | 8 | 16 | 32>(4);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    if (!name.trim()) {
      alert("Please enter a tournament name");
      return;
    }

    const feeInMicroStx = Math.floor(parseFloat(entryFee) * 1_000_000);
    if (feeInMicroStx <= 0) {
      alert("Entry fee must be greater than 0");
      return;
    }

    setIsSubmitting(true);
    try {
      await handleCreateTournament(name, feeInMicroStx, maxPlayers);
      // On success, redirect to tournaments page
      setTimeout(() => {
        router.push("/tournaments");
      }, 2000);
    } catch (error) {
      console.error("Failed to create tournament:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800 font-semibold">Connect your wallet to create a tournament</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-400 mb-8">Create Tournament</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-8 space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Tournament Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              className="w-full px-4 py-2 text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Summer Championship 2025"
              required
            />
            <p className="text-xs text-gray-500 mt-1">{name.length}/50 characters</p>
          </div>

          <div>
            <label htmlFor="entryFee" className="block text-sm font-medium text-gray-700 mb-2">
              Entry Fee (STX)
            </label>
            <input
              type="number"
              id="entryFee"
              value={entryFee}
              onChange={(e) => setEntryFee(e.target.value)}
              step="0.000001"
              min="0.000001"
              className="w-full px-4 py-2 text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Minimum: 0.000001 STX ({parseFloat(entryFee) * 1_000_000} microSTX)
            </p>
          </div>

          <div>
            <label htmlFor="maxPlayers" className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Players
            </label>
            <select
              id="maxPlayers"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(parseInt(e.target.value) as 4 | 8 | 16 | 32)}
              className="w-full px-4 py-2 text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={4}>4 Players (2 rounds)</option>
              <option value={8}>8 Players (3 rounds)</option>
              <option value={16}>16 Players (4 rounds)</option>
              <option value={32}>32 Players (5 rounds)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Must be a power of 2 for bracket structure
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 mb-2">Tournament Summary</h3>
            <div className="text-sm text-blue-700 space-y-1">
              <p>• Name: {name || "..."}</p>
              <p>• Entry Fee: {entryFee} STX</p>
              <p>• Max Players: {maxPlayers}</p>
              <p>• Total Prize Pool: {(parseFloat(entryFee) * maxPlayers).toFixed(6)} STX</p>
              <p>• Number of Rounds: {Math.log2(maxPlayers)}</p>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              {isSubmitting ? "Creating..." : "Create Tournament"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
