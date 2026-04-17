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
- **Resizable columns** — drag the right edge of any column header to adjust its width in both Grid and Kanban views (see details below)
- Layout persisted to Firestore (optional — works fully offline)
- Real-time sync with GitHub Issues API

## Resizable Columns

Both the **Grid** (epics) and **Kanban** (statuses) views support draggable column resize handles.

### How to use

1. Hover over the **right edge** of any column header — a resize cursor (`col-resize`) and a thin visual indicator bar will appear.
2. **Click and drag** left or right to adjust the column width in real-time.
3. Release the mouse button to confirm the new width.

### Constraints

| Limit | Value |
|-------|-------|
| Minimum width | 120 px |
| Maximum width | 600 px |

### Persistence

Custom column widths are stored in **`localStorage`** under the key `gh_col_widths_{owner}_{repo}`, scoped per repository. The widths are restored automatically when the page is refreshed or the app is reopened. Switching to a different repository loads that repo's own saved widths.

### Implementation notes

- `ResizeHandle` — a lightweight React component (`src/components/ResizeHandle.tsx`) that attaches `mousemove`/`mouseup` listeners to `document` during a drag and calls `onResize(colKey, newWidth)` continuously, enabling real-time feedback.
- `columnWidths` / `setColumnWidth` — new state and action added to the Zustand store (`src/store/appStore.ts`). Widths are keyed by the epic's GitHub project ID (Grid) or a stable `kanban-status-{label}` string (Kanban).
- Column `<th>` and all body `<td>` elements in each column receive matching inline `width` / `minWidth` styles so the table layout stays consistent.
- In the Grid view the resize handle calls `e.stopPropagation()` on `mousedown` so the existing `@hello-pangea/dnd` column-drag behaviour is unaffected.

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
