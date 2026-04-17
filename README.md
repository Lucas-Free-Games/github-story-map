# GitHub Story Map

An elegant interface to visualize and manage GitHub issues as a story map or Kanban board.

## What it does

GitHub Story Map connects to any GitHub repository and presents issues in two structured views — a **Grid** (epics × waves) and a **Kanban** (status columns × wave swimlanes). All placement is driven by GitHub labels, so the board always reflects what's on the issue.

## Views

### Grid view
Issues are laid out in a matrix:
- **Columns** = epic labels (`e_*`, e.g. `e_Auth`)
- **Rows** = wave labels (`w_*`, e.g. `w_Q1`)

Each cell shows the issues that carry both that epic and that wave label. A "No Wave" row catches issues with an epic but no wave assigned.

### Kanban view
Issues are organized as a standard Kanban with swimlanes:
- **Columns** = status labels (`s_*`, e.g. `s_Todo`, `s_In Progress`, `s_Done`)
- **Swimlanes** = wave labels (`w_*`)

A "No Status" column and "No Wave" swimlane catch any untagged issues.

## Label conventions

All structure comes from GitHub labels with these prefixes:

| Prefix | Example | Purpose |
|--------|---------|---------|
| `e_` | `e_Auth` | Epic — defines Grid columns |
| `w_` | `w_Q1` | Wave / release — defines Grid rows and Kanban swimlanes |
| `s_` | `s_Done` | Status — defines Kanban columns |
| `epic` | `epic` | Marks an issue as an Epic (shown as context, not in cells) |

Labels are created automatically on GitHub when you add them through the **Epics & Waves** manager or when creating an issue.

## Features

- Connect to any GitHub repository via personal access token
- Grid view: epic × wave matrix with per-cell issue creation
- Kanban view: status columns with wave swimlanes
- Grid/Kanban toggle in the toolbar
- Create issues with pre-filled epic, wave, and status from any cell
- Edit, close, and permanently delete issues inline
- Manage epic, wave, and status labels without leaving the app
- Layout persisted to Firestore (optional — works fully offline)
- Real-time sync with GitHub Issues API
- **Resizable columns** in both Grid and Kanban views (see below)

## Resizable Columns

Both the **Grid** (epics) and **Kanban** (statuses) views support drag-to-resize column headers.

### How to use

1. Hover over the **right edge** of any column header — a thin blue (Grid) or green (Kanban) indicator bar appears.
2. Click and drag the edge **left or right** to resize the column in real time.
3. Release the mouse to confirm the new width.

### Behaviour

| Detail | Value |
|--------|-------|
| Minimum column width | 100 px |
| Maximum column width | 600 px |
| Default Grid column width | 200 px |
| Default Kanban column width | 280 px |
| Persistence | Widths are saved to `localStorage` under the key `gh_column_widths` and restored automatically on the next page load. |

Resizing a column does **not** interfere with the existing drag-to-reorder behaviour for epic columns in the Grid view — the resize handle intercepts the mouse event before the DnD drag handler fires.

## Getting started

### Prerequisites

- Node.js 18+
- A GitHub personal access token with `repo` scope

### Install

```bash
git clone https://github.com/lucssmassuh/github-story-map.git
cd github-story-map
npm install
```

### Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), enter your GitHub token and `owner/repo`, then use **Epics & Waves** in the toolbar to add your first labels.

## Tech stack

- **Frontend:** React 18 + TypeScript
- **Styling:** Tailwind CSS
- **GitHub integration:** GitHub REST API (Octokit)
- **State management:** Zustand
- **Persistence:** Firebase Firestore (optional)
- **Build:** Vite

## Troubleshooting

### NPM Permission Denied (EACCES)
If you encounter `EACCES` errors when installing packages globally (e.g., `firebase-tools`), it is likely because some files in your NVM directory are owned by `root`. To fix this, run:

```bash
sudo chown -R $(whoami) ~/.nvm
```
Then try the installation again.

### GitHub Token Config
For advanced features like the **[Describe]** skill, ensure you have a valid GitHub Personal Access Token in your `.env` file. You can find the required variables in `.env.example`.

## License

MIT
