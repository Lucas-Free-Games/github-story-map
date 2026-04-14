# Skill: Describe

This skill allows Antigravity to automatically generate comprehensive ticket descriptions for GitHub issues based on the project's architecture and design patterns.

## Objective
Analyze GitHub issues that only have titles or sparse descriptions and rewrite them following the standardized "Story Map" ticket structure.

## Knowledge Context
- **Project**: GitHub Story Map (React + TypeScript + Tailwind + Octokit).
- **Core Concepts**: 
    - **Waves**: Represented by GitHub Milestones or `w_` labels.
    - **Epics**: Represented by GitHub Projects (V2) or `e_` labels.
    - **Status**: Represented by `s_` labels (Todo, In Progress, Done).
- **Tech Stack**: Uses Zustand for state, Firestore for optional persistence, and Octokit for GitHub integration.

## Description Structure
Every generated description must follow this format:

### Background
Explain the current state, the pain point, and why this change is necessary. Mention how it fits into the existing "visual story map" paradigm if applicable.

### Solution
Describe the technical approach. Mention specific libraries (e.g., Octokit, TipTap, Tailwind) or architectural changes (e.g., updating `appStore.ts`, modifying `IssueCard.tsx`).

### Acceptance Criteria
Provide a bulleted list of specific, verifiable conditions. Use **Markdown Bold** for key technical terms or UI elements.

## Execution Process
1. **Identify Credentials**: Look for `VITE_GITHUB_TOKEN`, `VITE_GITHUB_OWNER`, and `VITE_GITHUB_REPO` in the `.env` file. If missing, prompt the user or fallback to public API (limited).
2. **Identify Target Issues**: Iterate through all open issues in the target repository.
2. **Analysis**: For each issue:
    - Read the title and any existing body.
    - If the issue already has a non-trivial description, use it as the authoritative source of intent — preserve its meaning, terminology, and acceptance criteria. Rewrite only the structure and wording to match the standard format.
    - If the body is sparse or missing, infer the intended functionality from the title and the codebase (referencing styles in `IssueCard.tsx` or logic in `appStore.ts`).
3. **Drafting**: Apply the three-part structure described above.
4. **Formatting**: Write the description directly in Markdown (bold, bullet lists, headings) — do **not** wrap it in a code block. The output is intended to be passed directly to `gh issue edit --body`.
5. **Publishing**: For each issue, run:
   ```
   gh issue edit <number> --repo Lucas-Free-Games/github-story-map --body "<generated markdown body>"
   ```
   Confirm success by printing the issue URL returned by the command.

## Commands
When this skill is invoked, Antigravity should:
- Fetch the list of issues from the repository.
- Generate the descriptions.
- Publish each description directly to GitHub via `gh issue edit`.
