;; ERRORS
(define-constant ERR_UNAUTHORIZED u200)
(define-constant ERR_INVALID_PARAMS u201)
(define-constant ERR_TOURNAMENT_NOT_FOUND u202)
(define-constant ERR_TOURNAMENT_NOT_OPEN u203)
(define-constant ERR_TOURNAMENT_FULL u204)
(define-constant ERR_ALREADY_REGISTERED u205)
(define-constant ERR_NOT_CREATOR u206)
(define-constant ERR_ALREADY_STARTED u207)
(define-constant ERR_NOT_IN_PROGRESS u208)
(define-constant ERR_INVALID_WINNER u209)
(define-constant ERR_MATCH_NOT_FOUND u210)
(define-constant ERR_MATCH_ALREADY_COMPLETED u211)


;; TRAITS
(use-trait game-tournament-trait .game-tournament-trait.game-tournament-trait)


;; CONSTANTS

(define-constant THIS_CONTRACT (as-contract tx-sender))

;; status enum : 0=open, 1=in-progress, 2=completed, 3=cancelled
(define-constant STATUS_OPEN u0)
(define-constant STATUS_IN_PROGRESS u1)
(define-constant STATUS_COMPLETED u2)
(define-constant STATUS_CANCELLED u3)


;; GLOBAL VARIABLES
(define-data-var latest-tournament-id uint u0)


;; MAPPINGS

;; tournaments: id -> metadata
(define-map tournaments
  uint
  {
    creator: principal,
    name: (string-utf8 50),
    entry-fee: uint,
    max-players: uint,
    prize-pool: uint,
    status: uint,
    start-time: (optional uint),
    winner: (optional principal),
    current-round: uint
  }
)

;; player registry and ordering per tournament
(define-map tournament-participants
  { tournament-id: uint, player: principal }
  { registration-time: uint, bracket-position: uint, eliminated: bool }
)

;; quick lookup by index (1-based)
(define-map tournament-player-index
  { tournament-id: uint, index: uint }
  principal
)

;; count of players joined per tournament
(define-map tournament-player-count
  uint ;; tournament-id
  uint ;; count
)

;; matches per round
(define-map tournament-matches
  { tournament-id: uint, round: uint, match-number: uint }
  { game-id: (optional uint), player1: (optional principal), player2: (optional principal), winner: (optional principal), completed: bool }
)


;; PUBLIC FUNCTIONS

;; Create a new tournament, returns tournament-id
(define-public (create-tournament (name (string-utf8 50)) (entry-fee uint) (max-players uint))
  (begin

    ;; assert conditions for successful creation of tournament
    (asserts! (> entry-fee u0) (err ERR_INVALID_PARAMS))
    (asserts! (is-power-of-two max-players) (err ERR_INVALID_PARAMS))

    ;; create new tournament
    (let (
      (tid (var-get latest-tournament-id))
      (meta {
        creator: tx-sender,
        name: name,
        entry-fee: entry-fee,
        max-players: max-players,
        prize-pool: u0,
        status: STATUS_OPEN,
        start-time: none,
        winner: none,
        current-round: u0
      })
    )
      ;; update mappings in state with new values    
      (map-set tournaments tid meta)
      (set-player-count tid u0)
      (var-set latest-tournament-id (+ tid u1))

      ;; emit event and return new tournament id
      (print { action: "create-tournament", id: tid, data: meta })
      (ok tid)
    )
  )
)

;; Join an open tournament: transfers entry fee and assigns bracket position
(define-public (join-tournament (tid uint))
  ;; fetch tournament data and player count
  (let (
    (meta (try! (get-tournament-or-err tid)))
    (count (get-player-count tid))
  )

    ;; assert conditions for successful entry into tournament
    (asserts! (is-eq (get status meta) STATUS_OPEN) (err ERR_TOURNAMENT_NOT_OPEN))
    (asserts! (< count (get max-players meta)) (err ERR_TOURNAMENT_FULL))
    (asserts! (is-none (map-get? tournament-participants { tournament-id: tid, player: tx-sender })) (err ERR_ALREADY_REGISTERED))

  ;; transfer entry fee into this contract to build prize pool
  (try! (stx-transfer? (get entry-fee meta) tx-sender THIS_CONTRACT))

  ;; create participant record, add player entry into pool, assign player to next bracket position
    (let (
      (new-index (+ count u1))
      (participant { registration-time: u0, bracket-position: new-index, eliminated: false })
      (updated-meta (merge meta { prize-pool: (+ (get prize-pool meta) (get entry-fee meta)) }))
    )

      ;; save player's registration; save update tournament meta to mapping
      (map-set tournament-participants { tournament-id: tid, player: tx-sender } participant)
      (set-player-at tid new-index tx-sender)
      (set-player-count tid new-index)
      (map-set tournaments tid updated-meta)

      ;; emit event for tracking; return new player's bracket position
      (print { action: "join-tournament", id: tid, player: tx-sender, position: new-index })
      (ok new-index)
    )
  )
)

;; Start the tournament: only creator, only when full. Creates round 1 matches automatically.
(define-public (start-tournament (tid uint) (game-contract <game-tournament-trait>))
  ;; fetch tournament metdata
  (let (
    (meta (try! (get-tournament-or-err tid)))
    (count (get-player-count tid))
  )

    ;; assert tournament is open and ready to start by creator
    (asserts! (is-eq (get creator meta) tx-sender) (err ERR_NOT_CREATOR))
    (asserts! (is-eq (get status meta) STATUS_OPEN) (err ERR_TOURNAMENT_NOT_OPEN))
    (asserts! (is-eq count (get max-players meta)) (err ERR_TOURNAMENT_FULL))

    ;; start tournament with updated values
    (let (
      (round u1)
      (started-meta (merge meta { status: STATUS_IN_PROGRESS, start-time: (some stacks-block-height), current-round: round }))
    )
      ;; update tournament mapping
      (map-set tournaments tid started-meta)

      ;; create round 1 matches (pair adjacent players: 1v2, 3v4, etc.)
      (unwrap-panic (create-round-one-matches tid count game-contract))

      ;; emit event; return tourname nt id
      (print { action: "start-tournament", id: tid, round: round })
      (ok tid)
    )
  )
)


;; automatically trigger trustless match result reporting when a tournament game finishes
(define-public (report-game-winner (tid uint) (round uint) (match-number uint) (winner principal))
  ;; fetch tournament data
  (let (
    (meta (try! (get-tournament-or-err tid)))
    (key { tournament-id: tid, round: round, match-number: match-number })
    (match-data (unwrap! (map-get? tournament-matches key) (err ERR_MATCH_NOT_FOUND)))
  )

    ;; assert caller is tic-tac-toe contract and verify match details
    (asserts! (is-eq contract-caller .tic-tac-toe-v2) (err ERR_UNAUTHORIZED))
    (asserts! (is-eq (get status meta) STATUS_IN_PROGRESS) (err ERR_NOT_IN_PROGRESS))
    (asserts! (is-eq (get completed match-data) false) (err ERR_MATCH_ALREADY_COMPLETED))

    ;; fetch match players
    (let (
      (p1 (unwrap! (get player1 match-data) (err ERR_INVALID_PARAMS)))
      (p2 (unwrap! (get player2 match-data) (err ERR_INVALID_PARAMS)))
    )
      ;; verify winner is one of the two players
      (asserts! (or (is-eq winner p1) (is-eq winner p2)) (err ERR_INVALID_WINNER))
      
      ;; update match with winner and mark as completed
      (map-set tournament-matches key (merge match-data { winner: (some winner), completed: true }))

      ;; emit event; return true
      (print { action: "match-complete", id: tid, round: round, match: match-number, winner: winner })
      (ok true)
    )
  )
)


;; PRIVATE HELPER FUNCTIONS

;; Create round 1 matches by pairing adjacent players and creating tic-tac-toe games
(define-private (create-round-one-matches (tid uint) (player-count uint) (game-contract <game-tournament-trait>))
  (begin
    ;; For a 4-player tournament: create 2 matches (1v2, 3v4)
    ;; For an 8-player tournament: create 4 matches (1v2, 3v4, 5v6, 7v8), etc.
    (and (>= player-count u2) (is-ok (create-match tid u1 u1 u1 u2 game-contract)))
    (and (>= player-count u4) (is-ok (create-match tid u1 u2 u3 u4 game-contract)))
    (and (>= player-count u6) (is-ok (create-match tid u1 u3 u5 u6 game-contract)))
    (and (>= player-count u8) (is-ok (create-match tid u1 u4 u7 u8 game-contract)))
    (and (>= player-count u10) (is-ok (create-match tid u1 u5 u9 u10 game-contract)))
    (and (>= player-count u12) (is-ok (create-match tid u1 u6 u11 u12 game-contract)))
    (and (>= player-count u14) (is-ok (create-match tid u1 u7 u13 u14 game-contract)))
    (and (>= player-count u16) (is-ok (create-match tid u1 u8 u15 u16 game-contract)))
    (and (>= player-count u18) (is-ok (create-match tid u1 u9 u17 u18 game-contract)))
    (and (>= player-count u20) (is-ok (create-match tid u1 u10 u19 u20 game-contract)))
    (and (>= player-count u22) (is-ok (create-match tid u1 u11 u21 u22 game-contract)))
    (and (>= player-count u24) (is-ok (create-match tid u1 u12 u23 u24 game-contract)))
    (and (>= player-count u26) (is-ok (create-match tid u1 u13 u25 u26 game-contract)))
    (and (>= player-count u28) (is-ok (create-match tid u1 u14 u27 u28 game-contract)))
    (and (>= player-count u30) (is-ok (create-match tid u1 u15 u29 u30 game-contract)))
    (and (>= player-count u32) (is-ok (create-match tid u1 u16 u31 u32 game-contract)))
    (ok true)
  )
)

;; Create a single match: look up players by position, create game, store match
(define-private (create-match (tid uint) (round uint) (match-num uint) (p1-pos uint) (p2-pos uint) (game-contract <game-tournament-trait>))
  ;; fetch player details and game id
  (let (
    (p1 (unwrap! (get-player-at tid p1-pos) (err ERR_INVALID_PARAMS)))
    (p2 (unwrap! (get-player-at tid p2-pos) (err ERR_INVALID_PARAMS)))
    (game-id (try! (contract-call? game-contract create-tournament-game p1 p2 tid round match-num)))
  )

    ;; update tournament mapping with player values
    (map-set tournament-matches 
      { tournament-id: tid, round: round, match-number: match-num }
      { game-id: (some game-id), player1: (some p1), player2: (some p2), winner: none, completed: false })

    ;; emit create match event; return game id
    (print { action: "create-match", tournament: tid, round: round, match: match-num, game: game-id, p1: p1, p2: p2 })
    (ok game-id)
  )
)

;; validates that n (no of players in tournament) is one of: 4, 8, 16, or 32
(define-private (is-power-of-two (n uint))
  (or (is-eq n u4) (is-eq n u8) (is-eq n u16) (is-eq n u32))
)

;; fetches player count for a tournament
(define-private (get-player-count (tid uint))
  (default-to u0 (map-get? tournament-player-count tid))
)

;; updates the player count for a tournament
(define-private (set-player-count (tid uint) (n uint))
  (map-set tournament-player-count tid n)
)

;; looks up which player is at a specific bracket position
(define-private (get-player-at (tid uint) (idx uint))
  (map-get? tournament-player-index { tournament-id: tid, index: idx })
)

;; assigns a player to a specific bracket position
(define-private (set-player-at (tid uint) (idx uint) (p principal))
  (map-set tournament-player-index { tournament-id: tid, index: idx } p)
)

;; attempts to fetch tournament metadata
(define-private (get-tournament-or-err (tid uint))
  (match (map-get? tournaments tid)
    meta (ok meta)
    (err ERR_TOURNAMENT_NOT_FOUND)
  )
)


;; READ-ONLY FUNCTIONS

;; public getter for tournament metadata
(define-read-only (get-tournament (tid uint))
  (map-get? tournaments tid)
)

;; checks if a player is registered in a tournament
(define-read-only (get-participant (tid uint) (p principal))
  (map-get? tournament-participants { tournament-id: tid, player: p })
)

;; fetches details about a specific match
(define-read-only (get-match (tid uint) (round uint) (match-number uint))
  (map-get? tournament-matches { tournament-id: tid, round: round, match-number: match-number })
)
