# Skill: Develop

This skill takes a GitHub issue number, implements the feature end-to-end, and opens a PR ready to merge.

## Objective
Given an issue number, autonomously:
1. Create a feature branch.
2. Implement the feature described in the issue body (or infer from the title if no body exists).
3. Commit the changes.
4. Open a pull request that closes the issue.

## Knowledge Context
- **Project**: GitHub Story Map — React 18 + TypeScript + Vite + Tailwind CSS.
- **State**: Zustand store at `src/store/appStore.ts`. All app state lives here.
- **GitHub API**: Octokit REST for issues/milestones/labels; raw GraphQL fetch for Projects v2.
- **Views**: `StoryMap.tsx` (Grid) and `KanbanView.tsx` (Kanban). Both filter from the same `issues` array in the store.
- **Issue card**: `IssueCard.tsx` — renders individual issue tiles.
- **Toolbar**: `Header.tsx` — all global controls (view toggle, sync, modals, etc.) live here.
- **Types**: `src/types/index.ts` — `GitHubIssue`, `GitHubProject`, `GitHubMilestone`, `AppState`.

## Execution Process

### Step 1 — Read the issue
- Run `gh issue view <number> --repo Lucas-Free-Games/github-story-map` to get the title and body.
- If the body contains a **Solution** section, treat it as the authoritative spec.
- If the body is sparse, infer the implementation from the title and the codebase.

### Step 2 — Explore the codebase
- Read all files that the issue's Solution section references (or that you judge to be relevant).
- Understand existing patterns before writing anything — don't guess at conventions.

### Step 3 — Create a branch
- Branch name format: `feat/<issue-number>-<kebab-case-title>` (e.g. `feat/18-show-hide-closed-issues`).
- Base off `master`.
- Command: `git checkout -b feat/<number>-<slug> master`

### Step 4 — Implement
- Make all necessary edits — store, components, types, styles.
- Follow existing code style: functional components, Tailwind utility classes, Zustand actions co-located in `appStore.ts`.
- Do **not** add comments, docstrings, or refactor code outside the scope of the issue.
- Do **not** introduce new dependencies unless strictly required.

### Step 5 — Commit
- Stage only the files you changed.
- Commit message format: `feat: <lowercase title from issue>` (e.g. `feat: option to show/hide closed issues`)
- Include the co-author trailer: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`

### Step 6 — Open a PR
- Push the branch and open a PR with `gh pr create`.
- PR title: same as the commit message (without the `feat:` prefix, sentence-cased).
- PR body must include:
  - `## Summary` — 2–3 bullets describing what changed and why.
  - `## Implementation notes` — brief notes on non-obvious decisions.
  - `## Test plan` — bulleted checklist for manual verification.
  - `Closes #<number>` — so GitHub auto-closes the issue on merge.

## Commands
When invoked with `/Develop <issue-number>`, Antigravity should execute all six steps above autonomously, asking the user only if a genuine ambiguity in the spec requires a decision that cannot be inferred from the codebase.

ARGUMENTS: $ARGUMENTS
