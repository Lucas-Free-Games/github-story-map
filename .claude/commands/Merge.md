# Skill: Merge

Squash-merges the open PR for a given issue number, then closes the issue.

## Objective
Given an issue number, autonomously:
1. Find the open PR that references the issue.
2. Confirm it is mergeable (no failing checks, no conflicts).
3. Squash-merge the PR with a clean commit message.
4. Verify the issue was auto-closed; close it explicitly if not.
5. Delete the remote feature branch.

## Execution Process

### Step 1 — Find the PR
Run:
```
gh pr list --repo Lucas-Free-Games/github-story-map --state open --json number,title,headRefName,url --jq '.[] | select(.title | test("(?i)#<number>|<slug>")) '
```
Or more reliably:
```
gh pr list --repo Lucas-Free-Games/github-story-map --state open --search "closes:#<number>" --json number,title,headRefName,url
```
If no PR is found that way, run `gh issue view <number> --repo Lucas-Free-Games/github-story-map --json projectItems` and look for a linked PR, or search by branch name pattern `feat/<number>-*`.

Abort and report to the user if no open PR is found.

### Step 2 — Check mergeability
Run:
```
gh pr view <pr-number> --repo Lucas-Free-Games/github-story-map --json mergeable,mergeStateStatus,statusCheckRollup
```
- If `mergeable` is `CONFLICTING` → abort and tell the user to resolve conflicts first.
- If any required status check is failing → report which check failed and abort.
- If `mergeStateStatus` is `BLOCKED` → report and abort.
- If checks are pending but not required, proceed.

### Step 3 — Squash-merge
Run:
```
gh pr merge <pr-number> --repo Lucas-Free-Games/github-story-map --squash --subject "<PR title>" --delete-branch
```
The `--delete-branch` flag removes the remote feature branch automatically.

The squash commit subject should be the PR title as-is (it already follows the `feat: ...` convention from the Develop skill).

### Step 4 — Verify issue is closed
Wait a moment for GitHub to process the auto-close, then run:
```
gh issue view <number> --repo Lucas-Free-Games/github-story-map --json state -q .state
```
If the state is still `OPEN`, close it explicitly:
```
gh issue close <number> --repo Lucas-Free-Games/github-story-map --comment "Closed via squash-merge of PR #<pr-number>."
```

### Step 5 — Report
Print a short summary:
- PR that was merged and its URL.
- Squash commit SHA (from `gh pr view` after merge).
- Issue state (auto-closed or explicitly closed).
- Branch deleted: yes/no.

## Commands
When invoked with `/Merge <issue-number>`, execute all steps above autonomously. Ask the user only if more than one open PR is linked to the issue.

ARGUMENTS: $ARGUMENTS
