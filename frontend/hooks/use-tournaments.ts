import {
  createTournament,
  joinTournament,
  startTournament,
  advanceRound,
  getTournament,
  getAllTournaments,
  getTournamentParticipant,
  getTournamentMatch,
  clearTournamentCache,
  type Tournament,
  type TournamentMatch,
  type TournamentParticipant,
} from "@/lib/tournament-contract";
import { openContractCall } from "@stacks/connect";
import { STACKS_TESTNET } from "@stacks/network";
import { PostConditionMode } from "@stacks/transactions";
import { useEffect, useState } from "react";

const appDetails = {
  name: "Tic Tac Toe - Tournaments",
  icon: "https://cryptologos.cc/logos/stacks-stx-logo.png",
};

export function useTournaments(userAddress: string | null) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  /**
   * Create a new tournament
   */
  async function handleCreateTournament(
    name: string,
    entryFee: number,
    maxPlayers: number
  ) {
    if (typeof window === "undefined") return;
    
    try {
      if (!userAddress) throw new Error("User not connected");
      
      const txOptions = await createTournament(name, entryFee, maxPlayers);
      await openContractCall({
        ...txOptions,
        appDetails,
        network: STACKS_TESTNET,
        onFinish: (data) => {
          console.log("Tournament created:", data);
          window.alert("Tournament created successfully!");
          // Clear cache and refresh tournaments list
          clearTournamentCache();
          setRefreshKey((prev) => prev + 1);
        },
        onCancel: () => {
          console.log("Transaction cancelled");
        },
        postConditionMode: PostConditionMode.Allow,
      });
    } catch (_err) {
      const err = _err as Error;
      console.error(err);
      window.alert(err.message);
    }
  }

  /**
   * Join an existing tournament
   */
  async function handleJoinTournament(tournamentId: number) {
    if (typeof window === "undefined") return;
    
    try {
      if (!userAddress) throw new Error("User not connected");
      
      const txOptions = await joinTournament(tournamentId);
      await openContractCall({
        ...txOptions,
        appDetails,
        network: STACKS_TESTNET,
        onFinish: (data) => {
          console.log("Joined tournament:", data);
          window.alert("Joined tournament successfully!");
          // Clear cache and refresh tournaments list
          clearTournamentCache(tournamentId);
          setRefreshKey((prev) => prev + 1);
        },
        onCancel: () => {
          console.log("Transaction cancelled");
        },
        postConditionMode: PostConditionMode.Allow,
      });
    } catch (_err) {
      const err = _err as Error;
      console.error(err);
      window.alert(err.message);
    }
  }

  /**
   * Start a tournament (creator only)
   */
  async function handleStartTournament(tournamentId: number) {
    if (typeof window === "undefined") return;
    
    try {
      if (!userAddress) throw new Error("User not connected");
      
      const txOptions = await startTournament(tournamentId);
      await openContractCall({
        ...txOptions,
        appDetails,
        network: STACKS_TESTNET,
        onFinish: (data) => {
          console.log("Tournament started:", data);
          window.alert("Tournament started successfully!");
          // Clear cache and refresh tournaments list
          clearTournamentCache(tournamentId);
          setRefreshKey((prev) => prev + 1);
        },
        onCancel: () => {
          console.log("Transaction cancelled");
        },
        postConditionMode: PostConditionMode.Allow,
      });
    } catch (_err) {
      const err = _err as Error;
      console.error(err);
      window.alert(err.message);
    }
  }

  /**
   * Advance the round of a tournament (creator only)
   */
  async function handleAdvanceRound(tournamentId: number, round: number) {
    if (typeof window === "undefined") return;
    
    try {
      if (!userAddress) throw new Error("User not connected");
      
      const txOptions = await advanceRound(tournamentId, round);
      await openContractCall({
        ...txOptions,
        appDetails,
        network: STACKS_TESTNET,
        onFinish: (data) => {
          console.log("Round advanced:", data);
          window.alert("Round advanced successfully!");
          // Clear cache and refresh tournaments list
          clearTournamentCache(tournamentId);
          setRefreshKey((prev) => prev + 1);
        },
        onCancel: () => {
          console.log("Transaction cancelled");
        },
        postConditionMode: PostConditionMode.Allow,
      });
    } catch (_err) {
      const err = _err as Error;
      console.error(err);
      window.alert(err.message);
    }
  }

  /**
   * Fetch a single tournament by ID
   */
  async function fetchTournament(tournamentId: number): Promise<Tournament | null> {
    try {
      return await getTournament(tournamentId);
    } catch (error) {
      console.error("Failed to fetch tournament:", error);
      return null;
    }
  }

  /**
   * Fetch participant info for a tournament
   */
  async function fetchParticipant(
    tournamentId: number,
    playerAddress: string
  ): Promise<TournamentParticipant | null> {
    try {
      return await getTournamentParticipant(tournamentId, playerAddress);
    } catch (error) {
      console.error("Failed to fetch participant:", error);
      return null;
    }
  }

  /**
   * Fetch match info for a tournament
   */
  async function fetchMatch(
    tournamentId: number,
    round: number,
    matchNumber: number
  ): Promise<TournamentMatch | null> {
    try {
      return await getTournamentMatch(tournamentId, round, matchNumber);
    } catch (error) {
      console.error("Failed to fetch match:", error);
      return null;
    }
  }

  /**
   * Fetch all tournaments
   */
  async function fetchAllTournaments() {
    setLoading(true);
    try {
      const allTournaments = await getAllTournaments();
      
      // Fetch player counts for each tournament
      // Calculate from prize pool (prize pool = entry fee × player count)
      const tournamentsWithCounts = allTournaments.map(tournament => ({
        ...tournament,
        playerCount: tournament.entryFee > 0 
          ? Math.floor(tournament.prizePool / tournament.entryFee) 
          : 0
      }));
      
      setTournaments(tournamentsWithCounts);
    } catch (error) {
      console.error("Failed to fetch tournaments:", error);
      setTournaments([]);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Get matches for a specific round in a tournament
   */
  async function fetchRoundMatches(
    tournamentId: number,
    round: number
  ): Promise<TournamentMatch[]> {
    const matches: TournamentMatch[] = [];
    
    // Fetch tournament to get max players
    const tournament = await fetchTournament(tournamentId);
    if (!tournament) {
      return matches;
    }

    // Calculate number of matches in this round
    // Round 1: maxPlayers / 2 matches
    // Round 2: maxPlayers / 4 matches, etc.
    const matchesInRound = tournament.maxPlayers / Math.pow(2, round);

    for (let i = 1; i <= matchesInRound; i++) {
      const match = await fetchMatch(tournamentId, round, i);
      if (match) {
        matches.push(match);
      }
    }

    return matches;
  }

  // Fetch tournaments on mount and when refresh key changes
  useEffect(() => {
    fetchAllTournaments();
  }, [refreshKey]);

  return {
    tournaments,
    loading,
    handleCreateTournament,
    handleJoinTournament,
    handleStartTournament,
    handleAdvanceRound,
    fetchTournament,
    fetchParticipant,
    fetchMatch,
    fetchRoundMatches,
    refreshTournaments: () => setRefreshKey((prev) => prev + 1),
  };
}
