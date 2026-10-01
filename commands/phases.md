---
description: Divide the confirmed requirements into ordered, shippable phases so each slice is built and verified on its own loop before the next — no "get everything right at once" pressure.
argument-hint: [charter path; default REQUIREMENTS.md]
---

# /oneshot-poc:phases — split the requirements into phases

After `REQUIREMENTS.md` is confirmed, break its **acceptance checklist** into a small number of
**ordered phases** (slices), each a coherent chunk of requirements that can be built and verified
on its own. The build loop then takes **one phase at a time**, iterates until that phase's items
all pass, and only then moves to the next — fresh. This turns "nail everything in one loop" into
"nail one slice, then the next."

## How to slice (manager judgement — use the heavy model)
- **Group by coherence + dependency:** a phase should deliver something verifiable on its own, and
  earlier phases should unblock later ones (foundations/data model → core feature → secondary
  features → polish). Put the riskiest/most-foundational slice first.
- **Keep phases small:** 1–4 acceptance items each is a good size — small enough to get right in a
  few loop iterations, large enough to be a real slice.
- **Every acceptance item lands in exactly one phase.** No item left out, none duplicated.
- **Order matters:** number them P1, P2, … in build order.

## Write the plan into the ledger
Create the run ledger from `${CLAUDE_PLUGIN_ROOT}/templates/run-ledger.md` if it doesn't exist,
then fill its **Phase plan** table: one row per phase (`id`, `title`, the charter requirement
numbers it covers, `status: todo`). Also tag each row of the **Requirement status** table with its
phase. Set the checkpoint `active_phase` to the first phase and `next_node: BUILD`.

## Confirm (brief)
Show the phase breakdown (just the titles + which requirements each covers) so the user can see
the build order. In a `/oneshot-poc:run`, proceed without stopping once written.
