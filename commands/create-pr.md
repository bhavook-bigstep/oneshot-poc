---
description: Create a structured pull request — only after explicit approval.
argument-hint: [PR title]
---

# /oneshot-poc:create-pr

Open a PR for the current work. **Outward-facing — only run on explicit user request.**

> **Narrate each step (IN → DO → OUT).** Open each numbered step with one line of what it got and
> what it will do (`▶ IN … / ▶ DO …`), and close it with one line of what it produced (`✓ OUT …`),
> so intent is scannable without scrolling.

## 1. Preconditions
- The user has asked for a PR (this command is itself that ask).
- Gates pass (lint/type/tests). If not, stop and report.
- You are NOT on the default branch — if you are, create a feature branch first.

## 2. Stage & commit
Review the diff for secrets/PII before staging. Write a clear commit message (what + why).
Follow the repo's attribution convention if one is configured.

## 3. Push & open
Push the branch and open the PR with `gh`. Body: summary, what changed, test evidence,
anything deferred, and how to verify. Link the plan + solution docs.

## 4. Hand over
Return the PR URL. Do not merge.
