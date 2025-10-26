;; Trait for tournament game integration
;; This allows tournament contract to create games without circular dependency

(define-trait tournament-game-trait
  (
    ;; Create a tournament game between two players
    (create-tournament-game (principal principal uint uint uint) (response uint uint))
  )
)
