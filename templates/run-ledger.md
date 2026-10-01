# Run ledger — <goal>

Durable state for a `/oneshot-poc:run`. **Every phase reads this first and appends to it when
done**, so a context compaction or a resume never loses the thread, and the human can glance at
progress. Content-free: status and decisions only, never secrets/PII.

- **Charter:** `REQUIREMENTS.md` (top-level, always present)  ·  **Branch:** `<feature-branch>`
- **Current phase:** `<A2 | B | C | D | E | F | G | H | I | STUCK>`
- **Outer loop:** `<n>/<maxOuter>`  ·  **Inner loop:** `<n>/<maxInner>`

## Requirement status (the acceptance checklist)

| # | Requirement | Status | Evidence / note |
|---|-------------|--------|-----------------|
| 1 | <item>      | todo / in-progress / **met** / partial / missing / needs_human | `file:line` · test · command result |

## Iteration log

| When (phase) | What changed | Result |
|--------------|--------------|--------|
| B | chose approach X | cited |
| C | plan v1 | — |
| D | implemented items 1–3 | gates pass |
| E | review: 2 P2 fixed | clean |
| F | acceptance: item 4 missing | → re-loop |

## Open assumptions / deferrals
- <anything defaulted or deferred that the user hasn't confirmed>

## Blockers (if STUCK)
- <what was tried, why it's stuck, what the human needs to decide>
