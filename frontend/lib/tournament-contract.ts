import { STACKS_TESTNET } from "@stacks/network";
import {
  uintCV,
  stringUtf8CV,
  standardPrincipalCV,
  contractPrincipalCV,
  fetchCallReadOnlyFunction,
  OptionalCV,
  TupleCV,
  UIntCV,
  PrincipalCV,
  BooleanCV,
  StringUtf8CV,
} from "@stacks/transactions";

// Contract identifiers
const CONTRACT_ADDRESS = "ST16XCPGV6CVM7D5M1H3BGT0VKDGNFKPRDSQXRW88";
const TOURNAMENT_CONTRACT_NAME = "tic-tac-toe-tournament-v2";
const TIC_TAC_TOE_CONTRACT_NAME = "tic-tac-toe-v2";

// Cache for tournaments to reduce API calls
const tournamentsCache = new Map<number, { tournament: Tournament; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds cache

// Tournament status constants (matching contract)
export const TOURNAMENT_STATUS = {
  OPEN: 0,
  IN_PROGRESS: 1,
  COMPLETED: 2,
  CANCELLED: 3,
} as const;

// Clarity value types
type TournamentCV = {
  creator: PrincipalCV;
  name: StringUtf8CV;
  "entry-fee": UIntCV;
  "max-players": UIntCV;
  "prize-pool": UIntCV;
  status: UIntCV;
  "start-time": OptionalCV<UIntCV>;
  winner: OptionalCV<PrincipalCV>;
  "current-round": UIntCV;
};

type ParticipantCV = {
  "registration-time": UIntCV;
  "bracket-position": UIntCV;
  eliminated: BooleanCV;
};

type MatchCV = {
  "game-id": OptionalCV<UIntCV>;
  player1: OptionalCV<PrincipalCV>;
  player2: OptionalCV<PrincipalCV>;
  winner: OptionalCV<PrincipalCV>;
  completed: BooleanCV;
};

// Type definitions
export interface Tournament {
  id: number;
  creator: string;
  name: string;
  entryFee: number;
  maxPlayers: number;
  prizePool: number;
  status: number;
  startTime: number | null;
  winner: string | null;
  currentRound: number;
  playerCount?: number;
}

export interface TournamentParticipant {
  registrationTime: number;
  bracketPosition: number;
  eliminated: boolean;
}

export interface TournamentMatch {
  gameId: number | null;
  player1: string | null;
  player2: string | null;
  winner: string | null;
  completed: boolean;
}

/**
 * Create a new tournament - returns transaction options
 */
export async function createTournament(
  name: string,
  entryFee: number,
  maxPlayers: number
) {
  // Validate parameters
  if (![4, 8, 16, 32].includes(maxPlayers)) {
    throw new Error("Max players must be 4, 8, 16, or 32");
  }
  if (entryFee <= 0) {
    throw new Error("Entry fee must be greater than 0");
  }
  if (name.length > 50) {
    throw new Error("Tournament name must be 50 characters or less");
  }

  const txOptions = {
    contractAddress: CONTRACT_ADDRESS,
    contractName: TOURNAMENT_CONTRACT_NAME,
    functionName: "create-tournament",
    functionArgs: [
      stringUtf8CV(name),
      uintCV(entryFee),
      uintCV(maxPlayers),
    ],
  };

  return txOptions;
}

/**
 * Join an existing tournament - returns transaction options
 */
export async function joinTournament(tournamentId: number) {
  const txOptions = {
    contractAddress: CONTRACT_ADDRESS,
    contractName: TOURNAMENT_CONTRACT_NAME,
    functionName: "join-tournament",
    functionArgs: [uintCV(tournamentId)],
  };

  return txOptions;
}

/**
 * Start a tournament (creator only, must be full) - returns transaction options
 */
export async function startTournament(tournamentId: number) {
  // Pass tic-tac-toe contract as trait parameter
  const gameContractPrincipal = contractPrincipalCV(
    CONTRACT_ADDRESS,
    TIC_TAC_TOE_CONTRACT_NAME
  );

  const txOptions = {
    contractAddress: CONTRACT_ADDRESS,
    contractName: TOURNAMENT_CONTRACT_NAME,
    functionName: "start-tournament",
    functionArgs: [uintCV(tournamentId), gameContractPrincipal],
  };

  return txOptions;
}

/**
 * Fetch tournament metadata (read-only)
 */
export async function getTournament(
  tournamentId: number
): Promise<Tournament | null> {
  // Check cache first
  const cached = tournamentsCache.get(tournamentId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.tournament;
  }

  try {
    const tournamentCV = await fetchCallReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: TOURNAMENT_CONTRACT_NAME,
      functionName: "get-tournament",
      functionArgs: [uintCV(tournamentId)],
      senderAddress: CONTRACT_ADDRESS,
      network: STACKS_TESTNET,
    });

    const responseCV = tournamentCV as OptionalCV<TupleCV<TournamentCV>>;
    
    if (responseCV.type === "none") return null;
    if (responseCV.value.type !== "tuple") return null;

    const tCV = responseCV.value.value;

    const tournament: Tournament = {
      id: tournamentId,
      creator: tCV.creator.value,
      name: tCV.name.value,
      entryFee: parseInt(tCV["entry-fee"].value.toString()),
      maxPlayers: parseInt(tCV["max-players"].value.toString()),
      prizePool: parseInt(tCV["prize-pool"].value.toString()),
      status: parseInt(tCV.status.value.toString()),
      startTime:
        tCV["start-time"].type === "some"
          ? parseInt(tCV["start-time"].value.value.toString())
          : null,
      winner:
        tCV.winner.type === "some" ? tCV.winner.value.value : null,
      currentRound: parseInt(tCV["current-round"].value.toString()),
    };

    // Update cache
    tournamentsCache.set(tournamentId, { tournament, timestamp: Date.now() });
    
    return tournament;
  } catch (error) {
    console.error(`Error fetching tournament ${tournamentId}:`, error);
    // Return cached value if available, even if expired
    if (cached) {
      return cached.tournament;
    }
    return null;
  }
}

/**
 * Fetch participant info (read-only)
 */
export async function getTournamentParticipant(
  tournamentId: number,
  playerAddress: string
): Promise<TournamentParticipant | null> {
  try {
    const participantCV = await fetchCallReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: TOURNAMENT_CONTRACT_NAME,
      functionName: "get-participant",
      functionArgs: [uintCV(tournamentId), standardPrincipalCV(playerAddress)],
      senderAddress: CONTRACT_ADDRESS,
      network: STACKS_TESTNET,
    });

    const responseCV = participantCV as OptionalCV<TupleCV<ParticipantCV>>;

    if (responseCV.type === "none") return null;
    if (responseCV.value.type !== "tuple") return null;

    const pCV = responseCV.value.value;

    const participant: TournamentParticipant = {
      registrationTime: parseInt(pCV["registration-time"].value.toString()),
      bracketPosition: parseInt(pCV["bracket-position"].value.toString()),
      eliminated: pCV.eliminated.type === "true",
    };

    return participant;
  } catch (error) {
    console.error(`Error fetching participant for tournament ${tournamentId}:`, error);
    // Return null instead of throwing - participant might not exist
    return null;
  }
}

/**
 * Fetch match details (read-only)
 */
export async function getTournamentMatch(
  tournamentId: number,
  round: number,
  matchNumber: number
): Promise<TournamentMatch | null> {
  try {
    const matchCV = await fetchCallReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: TOURNAMENT_CONTRACT_NAME,
      functionName: "get-match",
      functionArgs: [uintCV(tournamentId), uintCV(round), uintCV(matchNumber)],
      senderAddress: CONTRACT_ADDRESS,
      network: STACKS_TESTNET,
    });

    const responseCV = matchCV as OptionalCV<TupleCV<MatchCV>>;

    if (responseCV.type === "none") return null;
    if (responseCV.value.type !== "tuple") return null;

    const mCV = responseCV.value.value;

    const match: TournamentMatch = {
      gameId:
        mCV["game-id"].type === "some"
          ? parseInt(mCV["game-id"].value.value.toString())
          : null,
      player1:
        mCV.player1.type === "some" ? mCV.player1.value.value : null,
      player2:
        mCV.player2.type === "some" ? mCV.player2.value.value : null,
      winner: mCV.winner.type === "some" ? mCV.winner.value.value : null,
      completed: mCV.completed.type === "true",
    };

    return match;
  } catch (error) {
    console.error(`Error fetching match for tournament ${tournamentId}, round ${round}, match ${matchNumber}:`, error);
    return null;
  }
}

/**
 * Fetch all tournaments by iterating through latest-tournament-id
 */
export async function getAllTournaments(): Promise<Tournament[]> {
  try {
    // Fetch the latest tournament ID from the contract
    const latestIdCV = (await fetchCallReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: TOURNAMENT_CONTRACT_NAME,
      functionName: "get-latest-tournament-id",
      functionArgs: [],
      senderAddress: CONTRACT_ADDRESS,
      network: STACKS_TESTNET,
    })) as UIntCV;

    const latestTournamentId = parseInt(latestIdCV.value.toString());
    
    if (latestTournamentId === 0) {
      return [];
    }

    const tournaments: Tournament[] = [];
    
    // Fetch all tournaments from 0 to latestTournamentId - 1
    for (let i = 0; i < latestTournamentId; i++) {
      const tournament = await getTournament(i);
      if (tournament) {
        tournaments.push(tournament);
      }
      // Increase delay to avoid rate limiting (300ms between requests)
      if (i < latestTournamentId - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    return tournaments;
  } catch (error) {
    console.error("Error fetching all tournaments:", error);
    // If rate limited, return cached tournaments
    const cachedTournaments: Tournament[] = [];
    tournamentsCache.forEach(({ tournament }) => {
      cachedTournaments.push(tournament);
    });
    return cachedTournaments;
  }
}

/**
 * Get player count for a tournament by calculating from prize pool
 * Prize pool = entry fee × number of players joined
 */
export async function getTournamentPlayerCount(tournamentId: number): Promise<number> {
  try {
    const tournament = await getTournament(tournamentId);
    if (!tournament || tournament.entryFee === 0) return 0;

    // Calculate player count from prize pool
    // prizePool = entryFee * playerCount
    const playerCount = Math.floor(tournament.prizePool / tournament.entryFee);
    
    return playerCount;
  } catch (error) {
    console.error(`Error calculating player count for tournament ${tournamentId}:`, error);
    return 0;
  }
}

/**
 * Clear tournament cache (useful after creating/joining/starting tournaments)
 */
export function clearTournamentCache(tournamentId?: number) {
  if (tournamentId !== undefined) {
    tournamentsCache.delete(tournamentId);
  } else {
    tournamentsCache.clear();
  }
}

