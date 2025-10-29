;; Title: tic_tac_toe
;; Version: 4.0
;; Summary: Onchain Tic Tac Toe game
;; Description: A simple on-chain Tic Tac Toe game with staking and tournament support

;; Traits
;; Implement the game-tournament-trait
(impl-trait .game-tournament-trait.game-tournament-trait)

;; Constants
(define-constant THIS_CONTRACT (as-contract tx-sender)) ;; The address of this contract itself
(define-constant ERR_MIN_BET_AMOUNT u100) ;; Error thrown when a player tries to create a game with a bet amount less than the minimum (0.0001 STX)
(define-constant ERR_INVALID_MOVE u101) ;; Error thrown when a move is invalid, i.e. not within range of the board or not an X or an O
(define-constant ERR_GAME_NOT_FOUND u102) ;; Error thrown when a game cannot be found given a Game ID, i.e. invalid Game ID
(define-constant ERR_GAME_CANNOT_BE_JOINED u103) ;; Error thrown when a game cannot be joined, usually because it already has two players
(define-constant ERR_NOT_YOUR_TURN u104) ;; Error thrown when a player tries to make a move when it is not their turn
(define-constant ERR_TOURNAMENT_ALREADY_SET u110) ;; Error thrown when tournament contract address is already set
(define-constant ERR_INVALID_CONTRACT_CALLER u111) ;; Error thrown when unauthorized contract tries to call create-tournament-game
(define-constant ERR_INVALID_PARAMS u112) ;; Error thrown when parameters provided to a function are invalid

;; Data Vars
;; The Game ID to use for the next game
(define-data-var latest-game-id uint u0)

;; tournament contract will be set after deployment
(define-data-var tournament-contract (optional principal) none)

;; Data maps
(define-map games
    uint ;; Key (Game ID)
    {
        ;; Value (Game Tuple)
        player-one: principal,
        player-two: (optional principal),
        is-player-one-turn: bool,
        bet-amount: uint,
        board: (list 9 uint),
        winner: (optional principal),
        ;; Tournament integration
        tournament-id: (optional uint),
        tournament-round: (optional uint),
        tournament-match: (optional uint),
    }
)

;; Public Functions
(define-public (create-game
        (bet-amount uint)
        (move-index uint)
        (move uint)
    )
    (let (
            ;; Get the Game ID to use for creation of this new game
            (game-id (var-get latest-game-id))
            ;; The initial starting board for the game with all cells empty
            (starting-board (list u0 u0 u0 u0 u0 u0 u0 u0 u0))
            ;; Updated board with the starting move played by the game creator (X)
            (game-board (unwrap! (replace-at? starting-board move-index move)
                (err ERR_INVALID_MOVE)
            ))
            ;; Create the game data tuple (player one address, bet amount, game board, and mark next turn to be player two's turn)
            (game-data {
                player-one: contract-caller,
                player-two: none,
                is-player-one-turn: false,
                bet-amount: bet-amount,
                board: game-board,
                winner: none,
                tournament-id: none,
                tournament-round: none,
                tournament-match: none,
            })
        )
        ;; Ensure that user has put up a bet amount greater than the minimum
        (asserts! (> bet-amount u0) (err ERR_MIN_BET_AMOUNT))
        ;; Ensure that the move being played is an `X`, not an `O`
        (asserts! (is-eq move u1) (err ERR_INVALID_MOVE))
        ;; Ensure that the move meets validity requirements
        (asserts! (validate-move starting-board move-index move)
            (err ERR_INVALID_MOVE)
        )

        ;; Transfer the bet amount STX from user to this contract
        (try! (stx-transfer? bet-amount contract-caller THIS_CONTRACT))
        ;; Update the games map with the new game data
        (map-set games game-id game-data)
        ;; Increment the Game ID counter
        (var-set latest-game-id (+ game-id u1))

        ;; Log the creation of the new game
        (print {
            action: "create-game",
            data: game-data,
        })
        ;; Return the Game ID of the new game
        (ok game-id)
    )
)

(define-public (join-game
        (game-id uint)
        (move-index uint)
        (move uint)
    )
    (let (
            ;; Load the game data for the game being joined, throw an error if Game ID is invalid
            (original-game-data (unwrap! (map-get? games game-id) (err ERR_GAME_NOT_FOUND)))
            ;; Get the original board from the game data
            (original-board (get board original-game-data))
            ;; Update the game board by placing the player's move at the specified index
            (game-board (unwrap! (replace-at? original-board move-index move)
                (err ERR_INVALID_MOVE)
            ))
            ;; Update the copy of the game data with the updated board and marking the next turn to be player two's turn
            (game-data (merge original-game-data {
                board: game-board,
                player-two: (some contract-caller),
                is-player-one-turn: true,
            }))
        )
        ;; Ensure that the game being joined is able to be joined
        ;; i.e. player-two is currently empty
        (asserts! (is-none (get player-two original-game-data))
            (err ERR_GAME_CANNOT_BE_JOINED)
        )
        ;; Ensure that the move being played is an `O`, not an `X`
        (asserts! (is-eq move u2) (err ERR_INVALID_MOVE))
        ;; Ensure that the move meets validity requirements
        (asserts! (validate-move original-board move-index move)
            (err ERR_INVALID_MOVE)
        )

        ;; Transfer the bet amount STX from user to this contract
        (try! (stx-transfer? (get bet-amount original-game-data) contract-caller
            THIS_CONTRACT
        ))
        ;; Update the games map with the new game data
        (map-set games game-id game-data)

        ;; Log the joining of the game
        (print {
            action: "join-game",
            data: game-data,
        })
        ;; Return the Game ID of the game
        (ok game-id)
    )
)

(define-public (play
        (game-id uint)
        (move-index uint)
        (move uint)
    )
    (let (
            ;; Load the game data for the game being joined, throw an error if Game ID is invalid
            (original-game-data (unwrap! (map-get? games game-id) (err ERR_GAME_NOT_FOUND)))
            ;; Get the original board from the game data
            (original-board (get board original-game-data))
            ;; Is it player one's turn?
            (is-player-one-turn (get is-player-one-turn original-game-data))
            ;; Get the player whose turn it currently is based on the is-player-one-turn flag
            (player-turn (if is-player-one-turn
                (get player-one original-game-data)
                (unwrap! (get player-two original-game-data)
                    (err ERR_GAME_NOT_FOUND)
                )
            ))
            ;; Get the expected move based on whose turn it is (X or O?)
            (expected-move (if is-player-one-turn
                u1
                u2
            ))
            ;; Update the game board by placing the player's move at the specified index
            (game-board (unwrap! (replace-at? original-board move-index move)
                (err ERR_INVALID_MOVE)
            ))
            ;; Check if the game has been won now with this modified board
            (is-now-winner (has-won game-board))
            ;; Merge the game data with the updated board and marking the next turn to be player two's turn
            ;; Also mark the winner if the game has been won
            (game-data (merge original-game-data {
                board: game-board,
                is-player-one-turn: (not is-player-one-turn),
                winner: (if is-now-winner
                    (some player-turn)
                    none
                ),
            }))
        )
        ;; Ensure that the function is being called by the player whose turn it is
        (asserts! (is-eq player-turn contract-caller) (err ERR_NOT_YOUR_TURN))
        ;; Ensure that the move being played is the correct move based on the current turn (X or O)
        (asserts! (is-eq move expected-move) (err ERR_INVALID_MOVE))
        ;; Ensure that the move meets validity requirements
        (asserts! (validate-move original-board move-index move)
            (err ERR_INVALID_MOVE)
        )
        ;; Check if board is now full (tie scenario)
        (let ((is-tie (and (is-board-full game-board) (not is-now-winner))))
            ;; Handle winner based on game type (tournament vs regular)
            (if is-now-winner
                (begin
                    ;; Check if this is a tournament game
                    (match (get tournament-id game-data)
                        tid
                        (begin
                            ;; This is a tournament game - report winner to tournament contract
                            (let (
                                    (round (unwrap! (get tournament-round game-data)
                                        (err ERR_INVALID_MOVE)
                                    ))
                                    (match-num (unwrap! (get tournament-match game-data)
                                        (err ERR_INVALID_MOVE)
                                    ))
                                )
                                ;; Report winner to tournament contract
                                (try! (contract-call? .tic_tac_toe_tournament
                                    report-game-winner tid round match-num
                                    player-turn
                                ))
                                true
                            )
                        )
                        ;; Not a tournament game - transfer STX to winner
                        (try! (as-contract (stx-transfer? (* u2 (get bet-amount game-data))
                            tx-sender player-turn
                        )))
                    )
                )
                false
            )
            ;; Handle tie scenario - automatically create rematch for tournament games
            (if is-tie
                (begin
                    (match (get tournament-id game-data)
                        tid
                        (begin
                            ;; This is a tournament game that ended in a tie - create rematch
                            (let (
                                    (round (unwrap! (get tournament-round game-data)
                                        (err ERR_INVALID_MOVE)
                                    ))
                                    (match-num (unwrap! (get tournament-match game-data)
                                        (err ERR_INVALID_MOVE)
                                    ))
                                    (p1 (get player-one game-data))
                                    (p2 (unwrap! (get player-two game-data)
                                        (err ERR_GAME_NOT_FOUND)
                                    ))
                                    (new-game-id (var-get latest-game-id))
                                    (rematch-board (list u0 u0 u0 u0 u0 u0 u0 u0 u0))
                                    (rematch-data {
                                        player-one: p1,
                                        player-two: (some p2),
                                        is-player-one-turn: true,
                                        bet-amount: u0,
                                        board: rematch-board,
                                        winner: none,
                                        tournament-id: (some tid),
                                        tournament-round: (some round),
                                        tournament-match: (some match-num),
                                    })
                                )
                                ;; Create the rematch game
                                (map-set games new-game-id rematch-data)
                                (var-set latest-game-id (+ new-game-id u1))
                                (print {
                                    action: "tie-rematch-created",
                                    old-game-id: game-id,
                                    new-game-id: new-game-id,
                                    tournament-id: tid,
                                    round: round,
                                    match: match-num,
                                })
                                true
                            )
                        )
                        ;; Not a tournament game - just mark as tie (no rematch for regular games)
                        true
                    )
                )
                false
            )
            ;; Update the games map with the new game data
            (map-set games game-id game-data)
            ;; Log the action of a move being made
            (print {
                action: "play",
                data: game-data,
            })

            ;; Return the Game ID of the game
            (ok game-id)
        )
    )
)

;; create a game on behalf of the tournament contract with no bet transfers
(define-public (create-tournament-game
        (player-one principal)
        (player-two principal)
        (tid uint)
        (round uint)
        (match-num uint)
    )
    (let (
            (game-id (var-get latest-game-id))
            (starting-board (list u0 u0 u0 u0 u0 u0 u0 u0 u0))
            (game-data {
                player-one: player-one,
                player-two: (some player-two),
                is-player-one-turn: true,
                bet-amount: u0,
                board: starting-board,
                winner: none,
                tournament-id: (some tid),
                tournament-round: (some round),
                tournament-match: (some match-num),
            })
        )
        ;; assert caller is tournament contract
        (asserts! (is-eq (some contract-caller) (var-get tournament-contract))
            (err ERR_INVALID_CONTRACT_CALLER)
        )

        ;; update games mapping with tournament game
        (map-set games game-id game-data)
        (var-set latest-game-id (+ game-id u1))

        (print {
            action: "create-tournament-game",
            game-id: game-id,
            tournament-id: tid,
            round: round,
            match: match-num,
        })
        (ok game-id)
    )
)

;; Admin function to set the tournament contract address after deployment
(define-public (set-tournament-contract (contract principal))
    (begin
        ;; Allow setting the tournament contract only once. The deployment script (or deployer) should call this
        ;; immediately after publishing both contracts. This prevents the tournament pointer from being changed later.
        (asserts! (is-none (var-get tournament-contract))
            (err ERR_TOURNAMENT_ALREADY_SET)
        )

        ;; Additional validation: ensure the contract principal is valid (not empty)
        (asserts! (is-some (some contract)) (err ERR_INVALID_PARAMS))

        ;; set tournament contract in state
        (var-set tournament-contract (some contract))

        ;; Emit event for tracking
        (print {
            action: "set-tournament-contract",
            contract: contract,
        })
        (ok true)
    )
)

;; Read-Only Functions
(define-read-only (get-game (game-id uint))
    (map-get? games game-id)
)

(define-read-only (get-latest-game-id)
    (var-get latest-game-id)
)

;; Get the current tournament contract address (for verification)
(define-read-only (get-tournament-contract)
    (var-get tournament-contract)
)

;; Private Helper Functions
(define-private (validate-move
        (board (list 9 uint))
        (move-index uint)
        (move uint)
    )
    (let (
            ;; Validate that the move is being played within range of the board
            (index-in-range (and (>= move-index u0) (< move-index u9)))
            ;; Validate that the move is either an X or an O
            (x-or-o (or (is-eq move u1) (is-eq move u2)))
            ;; Validate that the cell the move is being played on is currently empty
            (empty-spot (is-eq (unwrap! (element-at? board move-index) false) u0))
        )
        ;; All three conditions must be true for the move to be valid
        (and
            (is-eq index-in-range true)
            (is-eq x-or-o true)
            empty-spot
        )
    )
)

;; Given a board, return true if any possible three-in-a-row line has been completed
(define-private (has-won (board (list 9 uint)))
    (or
        (is-line board u0 u1 u2) ;; Row 1
        (is-line board u3 u4 u5) ;; Row 2
        (is-line board u6 u7 u8) ;; Row 3
        (is-line board u0 u3 u6) ;; Column 1
        (is-line board u1 u4 u7) ;; Column 2
        (is-line board u2 u5 u8) ;; Column 3
        (is-line board u0 u4 u8) ;; Left to Right Diagonal
        (is-line board u2 u4 u6) ;; Right to Left Diagonal
    )
)

;; Check if the board is full (all 9 spaces filled) - indicates a tie if no winner
(define-private (is-board-full (board (list 9 uint)))
    (and
        (not (is-eq (unwrap! (element-at? board u0) false) u0))
        (not (is-eq (unwrap! (element-at? board u1) false) u0))
        (not (is-eq (unwrap! (element-at? board u2) false) u0))
        (not (is-eq (unwrap! (element-at? board u3) false) u0))
        (not (is-eq (unwrap! (element-at? board u4) false) u0))
        (not (is-eq (unwrap! (element-at? board u5) false) u0))
        (not (is-eq (unwrap! (element-at? board u6) false) u0))
        (not (is-eq (unwrap! (element-at? board u7) false) u0))
        (not (is-eq (unwrap! (element-at? board u8) false) u0))
    )
)

;; Given a board and three cells to look at on the board
;; Return true if all three are not empty and are the same value (all X or all O)
;; Return false if any of the three is empty or a different value
(define-private (is-line
        (board (list 9 uint))
        (a uint)
        (b uint)
        (c uint)
    )
    (let (
            ;; Value of cell at index a
            (a-val (unwrap! (element-at? board a) false))
            ;; Value of cell at index b
            (b-val (unwrap! (element-at? board b) false))
            ;; Value of cell at index c
            (c-val (unwrap! (element-at? board c) false))
        )
        ;; a-val must equal b-val and must also equal c-val while not being empty (non-zero)
        (and
            (is-eq a-val b-val)
            (is-eq a-val c-val)
            (not (is-eq a-val u0))
        )
    )
)
