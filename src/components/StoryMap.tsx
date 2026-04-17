import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { useAppStore } from '../store/appStore';
import type { GitHubIssue, GitHubMilestone, GitHubProject } from '../types';
import IssueCard from './IssueCard';
import CreateIssueModal from './CreateIssueModal';
import { startColumnResize, COLUMN_DEFAULT_WIDTH, COLUMN_MIN_WIDTH } from '../lib/columnResize';

function sortedProjects(projects: GitHubProject[], epicOrder: number[]): GitHubProject[] {
  const open = projects.filter((p) => !p.closed);
  return [...open].sort((a, b) => {
    const ai = epicOrder.indexOf(a.number);
    const bi = epicOrder.indexOf(b.number);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function sortedMilestones(milestones: GitHubMilestone[], milestoneOrder: number[]): GitHubMilestone[] {
  return [...milestones].sort((a, b) => {
    const ai = (milestoneOrder ?? []).indexOf(a.number);
    const bi = (milestoneOrder ?? []).indexOf(b.number);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

// Encode/decode cell droppable IDs for the grid.
// Format: "g:{projectId|none}:{milestoneNumber|none}"
// Using lastIndexOf so projectId (base-64, no colons) is safely sliced.
function cellId(projectId: string, milestoneNumber: number | null): string {
  return `g:${projectId || 'none'}:${milestoneNumber ?? 'none'}`;
}
function parseCell(id: string): { projectId: string; milestoneNumber: number | null } {
  const first = id.indexOf(':');
  const last = id.lastIndexOf(':');
  const projectPart = id.slice(first + 1, last);
  const milestonePart = id.slice(last + 1);
  return {
    projectId: projectPart === 'none' ? '' : projectPart,
    milestoneNumber: milestonePart === 'none' ? null : Number(milestonePart),
  };
}

interface CellKey {
  projectId: string;
  milestoneNumber: number | null;
}

interface CardCellProps {
  droppableId: string;
  items: GitHubIssue[];
  onAdd: () => void;
  addColor?: 'blue' | 'gray';
}

function CardCell({ droppableId, items, onAdd, addColor = 'blue' }: CardCellProps) {
  const hoverCls = addColor === 'gray'
    ? 'hover:text-gray-600 hover:bg-gray-100 hover:border-gray-300'
    : 'hover:text-blue-500 hover:bg-blue-50 hover:border-blue-300';
  return (
    <Droppable droppableId={droppableId} type="CARD">
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`flex flex-col gap-2 min-h-16 rounded transition-colors ${
            snapshot.isDraggingOver ? 'bg-blue-50/60' : ''
          }`}
        >
          {items.map((issue, idx) => (
            <Draggable key={issue.number} draggableId={`i:${issue.number}`} index={idx}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.draggableProps}
                  {...provided.dragHandleProps}
                  className={`transition-opacity ${snapshot.isDragging ? 'opacity-75 rotate-1 shadow-lg' : ''}`}
                >
                  <IssueCard issue={issue} hideLabels showStatus />
                </div>
              )}
            </Draggable>
          ))}
          {provided.placeholder}
          <button
            onClick={onAdd}
            className={`mt-auto w-full text-xs text-gray-400 ${hoverCls} rounded-lg py-1.5 border border-dashed border-gray-200 transition-colors flex items-center justify-center gap-1`}
          >
            <span className="text-sm font-medium leading-none">+</span>
            New Issue
          </button>
        </div>
      )}
    </Droppable>
  );
}

export default function StoryMap() {
  const {
    issues, projects, projectIssues, milestones, layout,
    reorderProjects, reorderMilestones, moveIssueInGrid, showClosedIssues,
    createProject, createMilestone,
    columnWidths, setColumnWidth,
  } = useAppStore();
  const [createCell, setCreateCell] = useState<CellKey | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const [addingEpic, setAddingEpic] = useState(false);
  const [newEpicTitle, setNewEpicTitle] = useState('');
  const [epicSaving, setEpicSaving] = useState(false);

  const [addingWave, setAddingWave] = useState(false);
  const [newWaveTitle, setNewWaveTitle] = useState('');
  const [waveSaving, setWaveSaving] = useState(false);

  function showError(msg: string) {
    setMoveError(msg);
    setTimeout(() => setMoveError(null), 4000);
  }

  async function handleCreateEpic(e: React.FormEvent) {
    e.preventDefault();
    if (!newEpicTitle.trim()) return;
    setEpicSaving(true);
    try {
      await createProject(newEpicTitle.trim(), '');
      setNewEpicTitle('');
      setAddingEpic(false);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to create epic');
    } finally {
      setEpicSaving(false);
    }
  }

  async function handleCreateWave(e: React.FormEvent) {
    e.preventDefault();
    if (!newWaveTitle.trim()) return;
    setWaveSaving(true);
    try {
      await createMilestone(newWaveTitle.trim(), '');
      setNewWaveTitle('');
      setAddingWave(false);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to create wave');
    } finally {
      setWaveSaving(false);
    }
  }

  const cols = sortedProjects(projects, layout.epicOrder);
  const orderedMilestones = sortedMilestones(milestones, layout.milestoneOrder);
  const visibleIssues = showClosedIssues ? issues : issues.filter((i) => i.state === 'open');

  // Pre-compute the "No Epic" column width
  const noEpicWidth = columnWidths['__no_epic__'] ?? COLUMN_DEFAULT_WIDTH;

  function cellIssues(projectId: string, milestoneNumber: number | null): GitHubIssue[] {
    const inProject = new Set(projectIssues[projectId] ?? []);
    return visibleIssues.filter((issue) => {
      const mMatch = milestoneNumber === null
        ? issue.milestone === null
        : issue.milestone?.number === milestoneNumber;
      return inProject.has(issue.number) && mMatch;
    });
  }

  function noProjectCellIssues(milestoneNumber: number | null): GitHubIssue[] {
    const allProjectIssueNumbers = new Set<number>();
    Object.values(projectIssues).forEach((nums) => nums.forEach((n) => allProjectIssueNumbers.add(n)));
    return visibleIssues.filter((issue) => {
      const mMatch = milestoneNumber === null
        ? issue.milestone === null
        : issue.milestone?.number === milestoneNumber;
      return !allProjectIssueNumbers.has(issue.number) && mMatch;
    });
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    const { draggableId, source, destination } = result;

    if (source.droppableId === 'columns') {
      if (source.index !== destination.index) reorderProjects(source.index, destination.index);
      return;
    }
    if (source.droppableId === 'rows') {
      if (source.index !== destination.index) reorderMilestones(source.index, destination.index);
      return;
    }

    // Issue card drop
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    const issueNumber = Number(draggableId.slice(2));
    const src = parseCell(source.droppableId);
    const dst = parseCell(destination.droppableId);
    moveIssueInGrid(issueNumber, src.projectId, dst.projectId, src.milestoneNumber, dst.milestoneNumber)
      .catch((err) => {
        setMoveError(err instanceof Error ? err.message : 'Failed to move issue');
        setTimeout(() => setMoveError(null), 4000);
      });
  }

  if (cols.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-gray-400 text-sm">No epics yet.</p>
        {addingEpic ? (
          <form onSubmit={handleCreateEpic} className="flex items-center gap-2">
            <input
              autoFocus
              value={newEpicTitle}
              onChange={(e) => setNewEpicTitle(e.target.value)}
              placeholder="Epic name…"
              className="border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              type="submit"
              disabled={epicSaving || !newEpicTitle.trim()}
              className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {epicSaving ? 'Creating…' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => { setAddingEpic(false); setNewEpicTitle(''); }}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            onClick={() => setAddingEpic(true)}
            className="text-sm text-blue-600 hover:text-blue-800 px-4 py-2 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            + New Epic
          </button>
        )}
        {moveError && (
          <p className="text-red-500 text-sm">{moveError}</p>
        )}
      </div>
    );
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-auto h-full">
          <table className="border-collapse">
            {/* Column headers — draggable horizontally */}
            <thead>
              <Droppable droppableId="columns" direction="horizontal" type="COLUMN">
                {(provided) => (
                  <tr ref={provided.innerRef} {...provided.droppableProps}>
                    {/* Sticky corner cell (row-label area) — fixed width, not resizable */}
                    <th className="sticky left-0 top-0 z-30 bg-white border border-gray-200 w-[200px] min-w-[200px] max-w-[200px]" />

                    {/* Epic column headers — draggable + resizable */}
                    {cols.map((project, index) => (
                      <Draggable key={project.id} draggableId={project.id} index={index}>
                        {(provided, snapshot) => {
                          const colWidth = columnWidths[project.id] ?? COLUMN_DEFAULT_WIDTH;
                          return (
                            <th
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`sticky top-0 z-20 border border-gray-200 px-4 py-3 text-sm font-semibold text-blue-900 text-center whitespace-nowrap cursor-grab select-none transition-colors ${
                                snapshot.isDragging ? 'bg-blue-100 shadow-lg z-50' : 'bg-blue-50'
                              }`}
                              style={{
                                ...provided.draggableProps.style,
                                width: colWidth,
                                minWidth: COLUMN_MIN_WIDTH,
                              }}
                            >
                              <span className="text-blue-300 mr-1.5 text-xs">⠿</span>
                              {project.title}
                              {/* Resize handle */}
                              <div
                                className="absolute right-0 inset-y-0 w-1.5 cursor-col-resize flex items-center justify-center group"
                                onMouseDown={(e) => startColumnResize(e, colWidth, setColumnWidth, project.id)}
                              >
                                <div className="h-4 w-0.5 rounded-full bg-transparent group-hover:bg-blue-300 transition-colors" />
                              </div>
                            </th>
                          );
                        }}
                      </Draggable>
                    ))}
                    {provided.placeholder}

                    {/* "No Epic" column header — resizable */}
                    <th
                      className="sticky top-0 z-20 bg-gray-50 border border-gray-200 px-2 py-2 text-sm font-semibold text-gray-500 text-center"
                      style={{ width: noEpicWidth, minWidth: COLUMN_MIN_WIDTH }}
                    >
                      {addingEpic ? (
                        <form onSubmit={handleCreateEpic} className="flex items-center gap-1">
                          <input
                            autoFocus
                            value={newEpicTitle}
                            onChange={(e) => setNewEpicTitle(e.target.value)}
                            placeholder="Epic name…"
                            className="flex-1 min-w-0 border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                          <button type="submit" disabled={epicSaving || !newEpicTitle.trim()} className="text-blue-600 hover:text-blue-800 disabled:opacity-40 px-1 text-base leading-none">✓</button>
                          <button type="button" onClick={() => { setAddingEpic(false); setNewEpicTitle(''); }} className="text-gray-400 hover:text-gray-600 px-1 text-base leading-none">✕</button>
                        </form>
                      ) : (
                        <div className="flex items-center justify-between px-2">
                          <span className="text-gray-500">No Epic</span>
                          <button
                            onClick={() => setAddingEpic(true)}
                            className="text-xs text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded px-1.5 py-0.5 transition-colors"
                          >
                            + New Epic
                          </button>
                        </div>
                      )}
                      {/* Resize handle */}
                      <div
                        className="absolute right-0 inset-y-0 w-1.5 cursor-col-resize flex items-center justify-center group"
                        onMouseDown={(e) => startColumnResize(e, noEpicWidth, setColumnWidth, '__no_epic__')}
                      >
                        <div className="h-4 w-0.5 rounded-full bg-transparent group-hover:bg-gray-400 transition-colors" />
                      </div>
                    </th>
                  </tr>
                )}
              </Droppable>
            </thead>

            {/* Milestone rows — draggable vertically */}
            <Droppable droppableId="rows" type="ROW">
              {(provided) => (
                <tbody ref={provided.innerRef} {...provided.droppableProps}>
                  {orderedMilestones.map((milestone, index) => (
                    <Draggable key={milestone.number} draggableId={String(milestone.number)} index={index}>
                      {(provided, snapshot) => (
                        <tr
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          style={provided.draggableProps.style}
                        >
                          <th
                            {...provided.dragHandleProps}
                            className={`sticky left-0 z-10 border border-gray-200 px-3 py-2 text-xs font-semibold text-purple-900 text-right align-top pt-3 cursor-grab select-none transition-colors w-[200px] min-w-[200px] max-w-[200px] ${
                              snapshot.isDragging ? 'bg-purple-100' : 'bg-purple-50'
                            }`}
                          >
                            <span className="text-purple-300 mr-1 text-xs">⠿</span>
                            <span className="truncate block">{milestone.title}</span>
                          </th>
                          {cols.map((project) => {
                            const colWidth = columnWidths[project.id] ?? COLUMN_DEFAULT_WIDTH;
                            return (
                              <td
                                key={project.id}
                                className="border border-gray-200 align-top p-2 bg-white"
                                style={{ width: colWidth, minWidth: COLUMN_MIN_WIDTH }}
                              >
                                <CardCell
                                  droppableId={cellId(project.id, milestone.number)}
                                  items={cellIssues(project.id, milestone.number)}
                                  onAdd={() => setCreateCell({ projectId: project.id, milestoneNumber: milestone.number })}
                                />
                              </td>
                            );
                          })}
                          {/* No Epic cell */}
                          <td
                            className="border border-gray-200 align-top p-2 bg-gray-50/50"
                            style={{ width: noEpicWidth, minWidth: COLUMN_MIN_WIDTH }}
                          >
                            <CardCell
                              droppableId={cellId('', milestone.number)}
                              items={noProjectCellIssues(milestone.number)}
                              onAdd={() => setCreateCell({ projectId: '', milestoneNumber: milestone.number })}
                              addColor="gray"
                            />
                          </td>
                        </tr>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}

                  {/* "No Wave" row — always last, not draggable */}
                  <tr key="no-wave">
                    <th className="sticky left-0 z-10 bg-gray-50 border border-gray-200 px-2 py-2 text-xs font-semibold text-gray-500 text-right align-top pt-3 w-[200px] min-w-[200px] max-w-[200px]">
                      {addingWave ? (
                        <form onSubmit={handleCreateWave} className="flex items-center gap-1">
                          <input
                            autoFocus
                            value={newWaveTitle}
                            onChange={(e) => setNewWaveTitle(e.target.value)}
                            placeholder="Wave name…"
                            className="flex-1 min-w-0 border border-purple-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400"
                          />
                          <button type="submit" disabled={waveSaving || !newWaveTitle.trim()} className="text-purple-600 hover:text-purple-800 disabled:opacity-40 px-1 text-base leading-none">✓</button>
                          <button type="button" onClick={() => { setAddingWave(false); setNewWaveTitle(''); }} className="text-gray-400 hover:text-gray-600 px-1 text-base leading-none">✕</button>
                        </form>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-gray-400 font-normal italic">No Wave</span>
                          <button
                            onClick={() => setAddingWave(true)}
                            className="text-xs text-purple-400 hover:text-purple-600 hover:bg-purple-100 rounded px-1.5 py-0.5 transition-colors not-italic font-semibold"
                          >
                            + New Wave
                          </button>
                        </div>
                      )}
                    </th>
                    {cols.map((project) => {
                      const colWidth = columnWidths[project.id] ?? COLUMN_DEFAULT_WIDTH;
                      return (
                        <td
                          key={project.id}
                          className="border border-gray-200 align-top p-2 bg-white"
                          style={{ width: colWidth, minWidth: COLUMN_MIN_WIDTH }}
                        >
                          <CardCell
                            droppableId={cellId(project.id, null)}
                            items={cellIssues(project.id, null)}
                            onAdd={() => setCreateCell({ projectId: project.id, milestoneNumber: null })}
                          />
                        </td>
                      );
                    })}
                    {/* No Epic / No Wave corner */}
                    <td
                      className="border border-gray-200 align-top p-2 bg-gray-50/50"
                      style={{ width: noEpicWidth, minWidth: COLUMN_MIN_WIDTH }}
                    >
                      <CardCell
                        droppableId={cellId('', null)}
                        items={noProjectCellIssues(null)}
                        onAdd={() => setCreateCell({ projectId: '', milestoneNumber: null })}
                        addColor="gray"
                      />
                    </td>
                  </tr>
                </tbody>
              )}
            </Droppable>
          </table>
        </div>
      </DragDropContext>

      {createCell && (
        <CreateIssueModal
          defaultProjectId={createCell.projectId}
          defaultMilestoneNumber={createCell.milestoneNumber ?? undefined}
          onClose={() => setCreateCell(null)}
        />
      )}

      {moveError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-600 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
          {moveError}
        </div>
      )}
    </>
  );
}
