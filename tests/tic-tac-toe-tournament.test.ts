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
    "tic_tac_toe",
    "set-tournament-contract",
    [Cl.principal(`${deployer}.tic_tac_toe_tournament`)],
    deployer
  );
}

// Helper function to play a move in a tic-tac-toe game
function play(gameId: number, moveIndex: number, move: number, user: string) {
  return simnet.callPublicFn(
    "tic_tac_toe",
    "play",
    [Cl.uint(gameId), Cl.uint(moveIndex), Cl.uint(move)],
    user
  );
}

describe("Tournament Contract", () => {

  it("creates a tournament with valid params", () => {
    const { result, events } = simnet.callPublicFn(
      "tic_tac_toe_tournament",
      "create-tournament",
      [Cl.stringUtf8("Test Cup"), Cl.uint(100), Cl.uint(4)],
      alice
    );

    expect(result).toBeOk(Cl.uint(0));
    // One print event
    expect(events.length).toBe(1);

    const meta = simnet.getMapEntry("tic_tac_toe_tournament", "tournaments", Cl.uint(0));
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
      "tic_tac_toe_tournament",
      "create-tournament",
      [Cl.stringUtf8("Join Cup"), Cl.uint(250), Cl.uint(4)],
      alice
    );
    expect(createResult.result).toBeOk(Cl.uint(0)); // Tournament ID 0 (fresh simnet)

    // four joins (including creator is allowed)
    const j1 = simnet.callPublicFn("tic_tac_toe_tournament", "join-tournament", [Cl.uint(0)], alice);
    expect(j1.result).toBeOk(Cl.uint(1));
    const j2 = simnet.callPublicFn("tic_tac_toe_tournament", "join-tournament", [Cl.uint(0)], bob);
    expect(j2.result).toBeOk(Cl.uint(2));
    const j3 = simnet.callPublicFn("tic_tac_toe_tournament", "join-tournament", [Cl.uint(0)], carol);
    expect(j3.result).toBeOk(Cl.uint(3));
    const j4 = simnet.callPublicFn("tic_tac_toe_tournament", "join-tournament", [Cl.uint(0)], dave);
    expect(j4.result).toBeOk(Cl.uint(4));

    // now full; another join should fail
    const j5 = simnet.callPublicFn("tic_tac_toe_tournament", "join-tournament", [Cl.uint(0)], accounts.get("wallet_5")!);
    expect(j5.result).toBeErr(Cl.uint(204)); // ERR_TOURNAMENT_FULL

    // prize pool should be 4 * 250
    const meta = simnet.getMapEntry("tic_tac_toe_tournament", "tournaments", Cl.uint(0));
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

    const count = simnet.getMapEntry("tic_tac_toe_tournament", "tournament-player-count", Cl.uint(0));
    expect(count).toBeSome(Cl.uint(4));
  });

  it("can only be started by creator and only when full, creates matches automatically", () => {
    // Set up tournament contract authorization first
    setupTournamentAuth();
    
    // create a 4 player tournament (use 4 to satisfy contract's power-of-two requirement)
    const createResult = simnet.callPublicFn(
      "tic_tac_toe_tournament",
      "create-tournament",
      [Cl.stringUtf8("Start Cup"), Cl.uint(50), Cl.uint(4)],
      alice
    );
    expect(createResult.result).toBeOk(Cl.uint(0)); // Tournament ID 0

    // joining one player only (not full)
    simnet.callPublicFn("tic_tac_toe_tournament", "join-tournament", [Cl.uint(0)], bob);

    // not full yet (needs 4), starting should fail
    const notFull = simnet.callPublicFn(
      "tic_tac_toe_tournament",
      "start-tournament",
      [Cl.uint(0), Cl.contractPrincipal(deployer, "tic_tac_toe")],
      alice
    );
    expect(notFull.result).toBeErr(Cl.uint(204)); // ERR_TOURNAMENT_FULL

    // fill the tournament to 4 players (creator must also join)
    simnet.callPublicFn("tic_tac_toe_tournament", "join-tournament", [Cl.uint(0)], alice);
    simnet.callPublicFn("tic_tac_toe_tournament", "join-tournament", [Cl.uint(0)], carol);
    simnet.callPublicFn("tic_tac_toe_tournament", "join-tournament", [Cl.uint(0)], dave);

    // non-creator cannot start
    const byNonCreator = simnet.callPublicFn(
      "tic_tac_toe_tournament",
      "start-tournament",
      [Cl.uint(0), Cl.contractPrincipal(deployer, "tic_tac_toe")],
      bob
    );
    expect(byNonCreator.result).toBeErr(Cl.uint(206)); // ERR_NOT_CREATOR

    // creator starts successfully with game contract trait
    const started = simnet.callPublicFn(
      "tic_tac_toe_tournament",
      "start-tournament",
      [Cl.uint(0), Cl.contractPrincipal(deployer, "tic_tac_toe")],
      alice
    );
    expect(started.result).toBeOk(Cl.uint(0)); // Returns tournament ID

    const meta = simnet.getMapEntry("tic_tac_toe_tournament", "tournaments", Cl.uint(0));
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
      "tic_tac_toe_tournament",
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
      "tic_tac_toe_tournament",
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

  it("handles a full 4-player tournament from start to finish", () => {
    // 1. Setup: Authorize tournament contract
    setupTournamentAuth();

    // 2. Create Tournament
    simnet.callPublicFn(
      "tic_tac_toe_tournament",
      "create-tournament",
      [Cl.stringUtf8("Full Cup"), Cl.uint(100), Cl.uint(4)],
      alice
    );

    // 3. Join Tournament (4 players)
    simnet.callPublicFn("tic_tac_toe_tournament", "join-tournament", [Cl.uint(0)], alice);
    simnet.callPublicFn("tic_tac_toe_tournament", "join-tournament", [Cl.uint(0)], bob);
    simnet.callPublicFn("tic_tac_toe_tournament", "join-tournament", [Cl.uint(0)], carol);
    simnet.callPublicFn("tic_tac_toe_tournament", "join-tournament", [Cl.uint(0)], dave);

    // 4. Start Tournament
    simnet.callPublicFn(
      "tic_tac_toe_tournament",
      "start-tournament",
      [Cl.uint(0), Cl.contractPrincipal(deployer, "tic_tac_toe")],
      alice
    );

    // 5. Round 1, Match 1 (Game 0): Alice (P1) vs Bob (P2) -> Alice wins
    play(0, 0, 1, alice); // X at 0
    play(0, 3, 2, bob);   // O at 3
    play(0, 1, 1, alice); // X at 1
    play(0, 4, 2, bob);   // O at 4
    play(0, 2, 1, alice); // X at 2 -> Alice wins

    // 6. Round 1, Match 2 (Game 1): Carol (P1) vs Dave (P2) -> Carol wins
    play(1, 0, 1, carol); // X at 0
    play(1, 3, 2, dave);  // O at 3
    play(1, 1, 1, carol); // X at 1
    play(1, 4, 2, dave);  // O at 4
    play(1, 2, 1, carol); // X at 2 -> Carol wins

    // 7. Advance to Round 2
    const advanceResult = simnet.callPublicFn(
      "tic_tac_toe_tournament",
      "advance-round-if-complete",
      [Cl.uint(0), Cl.uint(1), Cl.contractPrincipal(deployer, "tic_tac_toe")],
      alice
    );
    expect(advanceResult.result).toBeOk(Cl.bool(true));

    // 8. Round 2, Match 1 (Game 2): Alice vs Carol -> Alice wins
    play(2, 0, 1, alice); // X at 0
    play(2, 3, 2, carol); // O at 3
    play(2, 1, 1, alice); // X at 1
    play(2, 4, 2, carol); // O at 4
    play(2, 2, 1, alice); // X at 2 -> Alice wins, tournament over

    // 9. Advance to complete tournament
    const advance2Result = simnet.callPublicFn(
      "tic_tac_toe_tournament",
      "advance-round-if-complete",
      [Cl.uint(0), Cl.uint(2), Cl.contractPrincipal(deployer, "tic_tac_toe")],
      alice
    );
    expect(advance2Result.result).toBeOk(Cl.bool(true));

    // 10. Verify Tournament Winner and Prize
    const tournament = simnet.getMapEntry("tic_tac_toe_tournament", "tournaments", Cl.uint(0));
    expect(tournament).toBeSome(
      Cl.tuple({
        creator: Cl.principal(alice),
        name: Cl.stringUtf8("Full Cup"),
        "entry-fee": Cl.uint(100),
        "max-players": Cl.uint(4),
        "prize-pool": Cl.uint(400),
        status: Cl.uint(2), // STATUS_COMPLETED
        "start-time": Cl.some(Cl.uint(simnet.blockHeight - 17)), // approx
        winner: Cl.some(Cl.principal(alice)),
        "current-round": Cl.uint(2),
      })
    );
  });

  it("handles a tie in a tournament game by creating a rematch", () => {
    // 1. Setup: Authorize tournament contract
    setupTournamentAuth();

    // 2. Create Tournament
    simnet.callPublicFn(
      "tic_tac_toe_tournament",
      "create-tournament",
      [Cl.stringUtf8("Tie Cup"), Cl.uint(100), Cl.uint(4)],
      alice
    );

    // 3. Join Tournament (4 players)
    simnet.callPublicFn("tic_tac_toe_tournament", "join-tournament", [Cl.uint(0)], alice);
    simnet.callPublicFn("tic_tac_toe_tournament", "join-tournament", [Cl.uint(0)], bob);
    simnet.callPublicFn("tic_tac_toe_tournament", "join-tournament", [Cl.uint(0)], carol);
    simnet.callPublicFn("tic_tac_toe_tournament", "join-tournament", [Cl.uint(0)], dave);

    // 4. Start Tournament
    simnet.callPublicFn(
      "tic_tac_toe_tournament",
      "start-tournament",
      [Cl.uint(0), Cl.contractPrincipal(deployer, "tic_tac_toe")],
      alice
    );

    // 5. Round 1, Match 1 (Game 0): Alice (P1) vs Bob (P2): Play to a tie
    play(0, 0, 1, alice); // X at 0
    play(0, 4, 2, bob);   // O at 4
    play(0, 1, 1, alice); // X at 1
    play(0, 2, 2, bob);   // O at 2
    play(0, 6, 1, alice); // X at 6
    play(0, 3, 2, bob);   // O at 3
    play(0, 5, 1, alice); // X at 5
    play(0, 8, 2, bob);   // O at 8
    const { events } = play(0, 7, 1, alice); // X at 7 -> Tie

    // 6. Check for rematch creation
    const latestGameId = simnet.getDataVar("tic_tac_toe", "latest-game-id");
    expect(latestGameId).toEqual(Cl.uint(3)); // Game 0 (tie), Game 1 (unplayed), Game 2 (rematch)

    const rematchGame = simnet.getMapEntry("tic_tac_toe", "games", Cl.uint(2));
    expect(rematchGame).toBeSome(
      Cl.tuple({
        "player-one": Cl.principal(alice),
        "player-two": Cl.some(Cl.principal(bob)),
        "is-player-one-turn": Cl.bool(true),
        "bet-amount": Cl.uint(0),
        board: Cl.list([Cl.uint(0), Cl.uint(0), Cl.uint(0), Cl.uint(0), Cl.uint(0), Cl.uint(0), Cl.uint(0), Cl.uint(0), Cl.uint(0)]),
        winner: Cl.none(),
        "tournament-id": Cl.some(Cl.uint(0)),
        "tournament-round": Cl.some(Cl.uint(1)),
        "tournament-match": Cl.some(Cl.uint(1)),
      })
    );

    // 7. Win the rematch game
    play(2, 0, 1, alice);
    play(2, 4, 2, bob);
    play(2, 1, 1, alice);
    play(2, 5, 2, bob);
    play(2, 2, 1, alice); // Alice wins the rematch
    
    8. // Connfirm that Alice won rematch game
    const matchGame = simnet.getMapEntry("tic_tac_toe", "games", Cl.uint(2));
    expect(matchGame).toBeSome(
      Cl.tuple({
        "player-one": Cl.principal(alice),
        "player-two": Cl.some(Cl.principal(bob)),
        "is-player-one-turn": Cl.bool(false),
        "bet-amount": Cl.uint(0),
        board: Cl.list([Cl.uint(1), Cl.uint(1), Cl.uint(1), Cl.uint(0), Cl.uint(2), Cl.uint(2), Cl.uint(0), Cl.uint(0), Cl.uint(0)]),
        winner: Cl.some(Cl.principal(alice)),
        "tournament-id": Cl.some(Cl.uint(0)),
        "tournament-round": Cl.some(Cl.uint(1)),
        "tournament-match": Cl.some(Cl.uint(1)),
      })
    );
  });
});;