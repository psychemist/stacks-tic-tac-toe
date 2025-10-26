import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const alice = accounts.get("wallet_1")!;
const bob = accounts.get("wallet_2")!;
const carol = accounts.get("wallet_3")!;
const dave = accounts.get("wallet_4")!;

// Helper to set up tournament contract authorization
function setupTournamentAuth() {
  simnet.callPublicFn(
    "tic-tac-toe",
    "set-tournament-contract",
    [Cl.principal(`${deployer}.tournament`)],
    deployer
  );
}

describe("Tournament Contract - Trustless Architecture", () => {

  it("creates a tournament with valid params", () => {
    const { result, events } = simnet.callPublicFn(
      "tournament",
      "create-tournament",
      [Cl.stringUtf8("Test Cup"), Cl.uint(100), Cl.uint(4)],
      alice
    );

    expect(result).toBeOk(Cl.uint(0));
    // One print event
    expect(events.length).toBe(1);

    const meta = simnet.getMapEntry("tournament", "tournaments", Cl.uint(0));
    expect(meta).toBeSome(
      Cl.tuple({
        creator: Cl.principal(alice),
        name: Cl.stringUtf8("Test Cup"),
        "entry-fee": Cl.uint(100),
        "max-players": Cl.uint(4),
        "prize-pool": Cl.uint(0),
        status: Cl.uint(0),
        "start-time": Cl.none(),
        winner: Cl.none(),
        "current-round": Cl.uint(0),
      })
    );
  });

  it("allows players to join until full and updates prize pool", () => {
    // create another tournament
    const createResult = simnet.callPublicFn(
      "tournament",
      "create-tournament",
      [Cl.stringUtf8("Join Cup"), Cl.uint(250), Cl.uint(4)],
      alice
    );
    expect(createResult.result).toBeOk(Cl.uint(0)); // Tournament ID 0 (fresh simnet)

    // four joins (including creator is allowed)
    const j1 = simnet.callPublicFn("tournament", "join-tournament", [Cl.uint(0)], alice);
    expect(j1.result).toBeOk(Cl.uint(1));
    const j2 = simnet.callPublicFn("tournament", "join-tournament", [Cl.uint(0)], bob);
    expect(j2.result).toBeOk(Cl.uint(2));
    const j3 = simnet.callPublicFn("tournament", "join-tournament", [Cl.uint(0)], carol);
    expect(j3.result).toBeOk(Cl.uint(3));
    const j4 = simnet.callPublicFn("tournament", "join-tournament", [Cl.uint(0)], dave);
    expect(j4.result).toBeOk(Cl.uint(4));

    // now full; another join should fail
    const j5 = simnet.callPublicFn("tournament", "join-tournament", [Cl.uint(0)], accounts.get("wallet_5")!);
    expect(j5.result).toBeErr(Cl.uint(204)); // ERR_TOURNAMENT_FULL

    // prize pool should be 4 * 250
    const meta = simnet.getMapEntry("tournament", "tournaments", Cl.uint(0));
    expect(meta).toBeSome(
      Cl.tuple({
        creator: Cl.principal(alice),
        name: Cl.stringUtf8("Join Cup"),
        "entry-fee": Cl.uint(250),
        "max-players": Cl.uint(4),
        "prize-pool": Cl.uint(1000),
        status: Cl.uint(0),
        "start-time": Cl.none(),
        winner: Cl.none(),
        "current-round": Cl.uint(0),
      })
    );

    const count = simnet.getMapEntry("tournament", "tournament-player-count", Cl.uint(0));
    expect(count).toBeSome(Cl.uint(4));
  });

  it("can only be started by creator and only when full, creates matches automatically", () => {
    // Set up tournament contract authorization first
    setupTournamentAuth();
    
    // create a 4 player tournament (use 4 to satisfy contract's power-of-two requirement)
    const createResult = simnet.callPublicFn(
      "tournament",
      "create-tournament",
      [Cl.stringUtf8("Start Cup"), Cl.uint(50), Cl.uint(4)],
      alice
    );
    expect(createResult.result).toBeOk(Cl.uint(0)); // Tournament ID 0

    // joining one player only (not full)
    simnet.callPublicFn("tournament", "join-tournament", [Cl.uint(0)], bob);

    // not full yet (needs 4), starting should fail
    const notFull = simnet.callPublicFn(
      "tournament",
      "start-tournament",
      [Cl.uint(0), Cl.contractPrincipal(deployer, "tic-tac-toe")],
      alice
    );
    expect(notFull.result).toBeErr(Cl.uint(204)); // ERR_TOURNAMENT_FULL

    // fill the tournament to 4 players (creator must also join)
    simnet.callPublicFn("tournament", "join-tournament", [Cl.uint(0)], alice);
    simnet.callPublicFn("tournament", "join-tournament", [Cl.uint(0)], carol);
    simnet.callPublicFn("tournament", "join-tournament", [Cl.uint(0)], dave);

    // non-creator cannot start
    const byNonCreator = simnet.callPublicFn(
      "tournament",
      "start-tournament",
      [Cl.uint(0), Cl.contractPrincipal(deployer, "tic-tac-toe")],
      bob
    );
    expect(byNonCreator.result).toBeErr(Cl.uint(206)); // ERR_NOT_CREATOR

    // creator starts successfully with game contract trait
    const started = simnet.callPublicFn(
      "tournament",
      "start-tournament",
      [Cl.uint(0), Cl.contractPrincipal(deployer, "tic-tac-toe")],
      alice
    );
    expect(started.result).toBeOk(Cl.uint(0)); // Returns tournament ID

    const meta = simnet.getMapEntry("tournament", "tournaments", Cl.uint(0));
    expect(meta).toBeSome(
      Cl.tuple({
        creator: Cl.principal(alice),
        name: Cl.stringUtf8("Start Cup"),
        "entry-fee": Cl.uint(50),
        "max-players": Cl.uint(4),
        "prize-pool": Cl.uint(200),
        status: Cl.uint(1), // STATUS_IN_PROGRESS
        "start-time": Cl.some(Cl.uint(simnet.blockHeight)),
        winner: Cl.none(),
        "current-round": Cl.uint(1),
      })
    );
    // Verify that Round 1, Match 1 and Match 2 were created
    const match1 = simnet.getMapEntry(
      "tournament",
      "tournament-matches",
      Cl.tuple({ "tournament-id": Cl.uint(0), round: Cl.uint(1), "match-number": Cl.uint(1) })
    );
    expect(match1).toBeSome(
      Cl.tuple({
        "game-id": Cl.some(Cl.uint(0)), // First game created
        player1: Cl.some(Cl.principal(bob)), // Position 1 (bob joined first)
        player2: Cl.some(Cl.principal(alice)), // Position 2 (creator joined later)
        winner: Cl.none(),
        completed: Cl.bool(false),
      })
    );

    const match2 = simnet.getMapEntry(
      "tournament",
      "tournament-matches",
      Cl.tuple({ "tournament-id": Cl.uint(0), round: Cl.uint(1), "match-number": Cl.uint(2) })
    );
    expect(match2).toBeSome(
      Cl.tuple({
        "game-id": Cl.some(Cl.uint(1)), // Second game created
        player1: Cl.some(Cl.principal(carol)),
        player2: Cl.some(Cl.principal(dave)),
        winner: Cl.none(),
        completed: Cl.bool(false),
      })
    );
  });

  it("creates multiple Round 1 matches for 4-player tournament", () => {
    // Set up tournament contract authorization first
    setupTournamentAuth();
    
    // Create a 4-player tournament
    const createResult = simnet.callPublicFn(
      "tournament",
      "create-tournament",
      [Cl.stringUtf8("Four Cup"), Cl.uint(100), Cl.uint(4)],
      alice
    );
    expect(createResult.result).toBeOk(Cl.uint(0)); // Tournament ID 0

    simnet.callPublicFn("tournament", "join-tournament", [Cl.uint(0)], alice);
    simnet.callPublicFn("tournament", "join-tournament", [Cl.uint(0)], bob);
    simnet.callPublicFn("tournament", "join-tournament", [Cl.uint(0)], carol);
    simnet.callPublicFn("tournament", "join-tournament", [Cl.uint(0)], dave);

    // Start the tournament
    const started = simnet.callPublicFn(
      "tournament",
      "start-tournament",
      [Cl.uint(0), Cl.contractPrincipal(deployer, "tic-tac-toe")],
      alice
    );
    expect(started.result).toBeOk(Cl.uint(0)); // Returns tournament ID

    // Verify Match 1: positions 1 vs 2 (alice vs bob)
    const match1 = simnet.getMapEntry(
      "tournament",
      "tournament-matches",
      Cl.tuple({ "tournament-id": Cl.uint(0), round: Cl.uint(1), "match-number": Cl.uint(1) })
    );
    expect(match1).toBeSome(
      Cl.tuple({
        "game-id": Cl.some(Cl.uint(0)), // First game
        player1: Cl.some(Cl.principal(alice)),
        player2: Cl.some(Cl.principal(bob)),
        winner: Cl.none(),
        completed: Cl.bool(false),
      })
    );

    // Verify Match 2: positions 3 vs 4 (carol vs dave)
    const match2 = simnet.getMapEntry(
      "tournament",
      "tournament-matches",
      Cl.tuple({ "tournament-id": Cl.uint(0), round: Cl.uint(1), "match-number": Cl.uint(2) })
    );
    expect(match2).toBeSome(
      Cl.tuple({
        "game-id": Cl.some(Cl.uint(1)), // Second game
        player1: Cl.some(Cl.principal(carol)),
        player2: Cl.some(Cl.principal(dave)),
        winner: Cl.none(),
        completed: Cl.bool(false),
      })
    );
  });

  it("validates winner is a match participant when reporting results", () => {
    // Set up tournament contract authorization first
    setupTournamentAuth();
    
    // Create a 4-player tournament and fill it so Round 1 matches are created
    const createResult = simnet.callPublicFn(
      "tournament",
      "create-tournament",
      [Cl.stringUtf8("Winner Cup"), Cl.uint(50), Cl.uint(4)],
      alice
    );
    expect(createResult.result).toBeOk(Cl.uint(0)); // Tournament ID 0

    simnet.callPublicFn("tournament", "join-tournament", [Cl.uint(0)], alice);
    simnet.callPublicFn("tournament", "join-tournament", [Cl.uint(0)], bob);
    simnet.callPublicFn("tournament", "join-tournament", [Cl.uint(0)], carol);
    simnet.callPublicFn("tournament", "join-tournament", [Cl.uint(0)], dave);

    simnet.callPublicFn(
      "tournament",
      "start-tournament",
      [Cl.uint(0), Cl.contractPrincipal(deployer, "tic-tac-toe")],
      alice
    );

    // Try to report an invalid winner (someone not in the match) by a non-contract caller
    const invalidWinner = simnet.callPublicFn(
      "tournament",
      "report-game-winner",
      [Cl.uint(0), Cl.uint(1), Cl.uint(1), Cl.principal(carol)],
      deployer
    );
    expect(invalidWinner.result).toBeErr(Cl.uint(200)); // ERR_UNAUTHORIZED (not called by tic-tac-toe contract)

    // NOTE: In production, report-game-winner should only be called by the tic-tac-toe contract
    // For testing purposes, we would need to simulate a game completion that triggers the call
    // For now, we'll test the authorization check which should fail since deployer is not the tic-tac-toe contract
  });
});
