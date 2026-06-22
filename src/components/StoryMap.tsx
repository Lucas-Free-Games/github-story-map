import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { useAppStore } from '../store/appStore';
import type { GitHubIssue, GitHubMilestone, GitHubProject } from '../types';
import IssueCard from './IssueCard';
import CreateIssueModal from './CreateIssueModal';
import ResizableHeader, { GRID_DEFAULT_WIDTH } from './ResizableHeader';
import CreateWaveDialog from './CreateWaveDialog';

function sortedProjects(projects: GitHubProject[], userActivityOrder: number[]): GitHubProject[] {
  const open = projects.filter((p) => !p.closed);
  return [...open].sort((a, b) => {
    const ai = userActivityOrder.indexOf(a.number);
    const bi = userActivityOrder.indexOf(b.number);
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
    issues, projects, projectIssues, milestones, layout, linkedProjectIds,
    reorderProjects, reorderMilestones, moveIssueInGrid, showClosedIssues,
    createProject, createMilestone,
    columnWidths, setColumnWidth,
    setView,
  } = useAppStore();
  const [createCell, setCreateCell] = useState<CellKey | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const [addingUserActivity, setAddingUserActivity] = useState(false);
  const [newUserActivityTitle, setNewUserActivityTitle] = useState('');
  const [userActivitySaving, setUserActivitySaving] = useState(false);

  const [addingWave, setAddingWave] = useState(false);

  /** Returns the stored (or default) width for a given column key. */
  const colW = (key: string) => columnWidths[key] ?? GRID_DEFAULT_WIDTH;

  function showError(msg: string) {
    setMoveError(msg);
    setTimeout(() => setMoveError(null), 4000);
  }

  async function handleCreateUserActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!newUserActivityTitle.trim()) return;
    setUserActivitySaving(true);
    try {
      await createProject(newUserActivityTitle.trim(), '');
      setNewUserActivityTitle('');
      setAddingUserActivity(false);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to create user activity');
    } finally {
      setUserActivitySaving(false);
    }
  }


  const cols = sortedProjects(projects, layout.userActivityOrder).filter((p) =>
    linkedProjectIds.includes(p.id),
  );
  const visibleIssues = showClosedIssues ? issues : issues.filter((i) => i.state === 'open');
  const orderedMilestones = sortedMilestones(milestones, layout.milestoneOrder).filter(
    (m) => showClosedIssues || visibleIssues.some((i) => i.milestone?.number === m.number),
  );
  const showNoWaveRow = showClosedIssues || visibleIssues.some((i) => i.milestone === null);

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
      if (source.index !== destination.index) {
        const from = cols[source.index];
        const to = cols[destination.index];
        if (from && to) {
          const fi = layout.userActivityOrder.indexOf(from.number);
          const ti = layout.userActivityOrder.indexOf(to.number);
          if (fi !== -1 && ti !== -1) reorderProjects(fi, ti);
        }
      }
      return;
    }
    if (source.droppableId === 'rows') {
      if (source.index !== destination.index) {
        const from = orderedMilestones[source.index];
        const to = orderedMilestones[destination.index];
        if (from && to) {
          const fi = (layout.milestoneOrder ?? []).indexOf(from.number);
          const ti = (layout.milestoneOrder ?? []).indexOf(to.number);
          if (fi !== -1 && ti !== -1) reorderMilestones(fi, ti);
        }
      }
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
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 p-8">
        <div className="flex flex-col items-center max-w-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 mb-4 animate-bounce">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1.5">No active User Activities</h3>
          <p className="text-gray-500 text-sm mb-6">
            Cherry-pick which User Activities (GitHub Projects) are included in this repo's Story Map, or create a brand new one to get started.
          </p>
          <div className="flex flex-col gap-2 w-full">
            <button
              onClick={() => setView('user-activities')}
              className="w-full px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              Cherry-Pick User Activities
            </button>
            {addingUserActivity ? (
              <form onSubmit={handleCreateUserActivity} className="flex items-center gap-2 mt-2 w-full">
                <input
                  autoFocus
                  value={newUserActivityTitle}
                  onChange={(e) => setNewUserActivityTitle(e.target.value)}
                  placeholder="User activity name…"
                  className="flex-1 min-w-0 border border-blue-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                />
                <button
                  type="submit"
                  disabled={userActivitySaving || !newUserActivityTitle.trim()}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors shrink-0"
                >
                  {userActivitySaving ? '…' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => { setAddingUserActivity(false); setNewUserActivityTitle(''); }}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                onClick={() => setAddingUserActivity(true)}
                className="w-full px-4 py-2 text-sm font-medium bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                + Create New Activity
              </button>
            )}
          </div>
          {moveError && (
            <p className="text-red-500 text-xs mt-4">{moveError}</p>
          )}
        </div>
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
                    {/* Sticky corner — row-label placeholder, not resizable */}
                    <th className="sticky left-0 top-0 z-30 bg-white border border-gray-200 w-[200px] min-w-[200px] max-w-[200px]" />

                    {/* Draggable + resizable user activity column headers */}
                    {cols.map((project, index) => (
                      <Draggable key={project.id} draggableId={project.id} index={index}>
                        {(provided, snapshot) => (
                          <ResizableHeader
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            dragHandleProps={provided.dragHandleProps}
                            columnKey={project.id}
                            width={colW(project.id)}
                            onResize={setColumnWidth}
                            className={`sticky top-0 z-20 border border-gray-200 px-4 py-3 text-sm font-semibold text-blue-900 text-center whitespace-nowrap cursor-grab select-none transition-colors ${
                              snapshot.isDragging ? 'bg-blue-100 shadow-lg z-50' : 'bg-blue-50'
                            }`}
                          >
                            <span className="text-blue-300 mr-1.5 text-xs">&#x2803;</span>
                            {project.title}
                          </ResizableHeader>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}

                    {/* Resizable "No User Activity" column header */}
                    <ResizableHeader
                      columnKey="__no_user_activity__"
                      width={colW('__no_user_activity__')}
                      onResize={setColumnWidth}
                      className="sticky top-0 z-20 bg-gray-50 border border-gray-200 px-2 py-2 text-sm font-semibold text-gray-500 text-center"
                    >
                      {addingUserActivity ? (
                        <form onSubmit={handleCreateUserActivity} className="flex items-center gap-1">
                          <input
                            autoFocus
                            value={newUserActivityTitle}
                            onChange={(e) => setNewUserActivityTitle(e.target.value)}
                            placeholder="User activity name\u2026"
                            className="flex-1 min-w-0 border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                          <button type="submit" disabled={userActivitySaving || !newUserActivityTitle.trim()} className="text-blue-600 hover:text-blue-800 disabled:opacity-40 px-1 text-base leading-none">&#x2713;</button>
                          <button type="button" onClick={() => { setAddingUserActivity(false); setNewUserActivityTitle(''); }} className="text-gray-400 hover:text-gray-600 px-1 text-base leading-none">&#x2715;</button>
                        </form>
                      ) : (
                        <div className="flex items-center justify-between px-2">
                          <span className="text-gray-500">No User Activity</span>
                          <button
                            onClick={() => setAddingUserActivity(true)}
                            className="text-xs text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded px-1.5 py-0.5 transition-colors"
                          >
                            + New User Activity
                          </button>
                        </div>
                      )}
                    </ResizableHeader>
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
                          {/* Row label — sticky left, not resizable */}
                          <th
                            {...provided.dragHandleProps}
                            className={`sticky left-0 z-10 border border-gray-200 px-3 py-2 text-xs font-semibold text-purple-900 text-right align-top pt-3 cursor-grab select-none transition-colors w-[200px] min-w-[200px] max-w-[200px] ${
                              snapshot.isDragging ? 'bg-purple-100' : 'bg-purple-50'
                            }`}
                          >
                            <span className="text-purple-300 mr-1 text-xs">&#x2803;</span>
                            <span className="truncate block">{milestone.title}</span>
                          </th>

                          {/* User activity column cells — width follows header */}
                          {cols.map((project) => (
                            <td
                              key={project.id}
                              className="border border-gray-200 align-top p-2 bg-white"
                              style={{ width: colW(project.id), minWidth: colW(project.id) }}
                            >
                              <CardCell
                                droppableId={cellId(project.id, milestone.number)}
                                items={cellIssues(project.id, milestone.number)}
                                onAdd={() => setCreateCell({ projectId: project.id, milestoneNumber: milestone.number })}
                              />
                            </td>
                          ))}

                          {/* No User Activity cell */}
                          <td
                            className="border border-gray-200 align-top p-2 bg-gray-50/50"
                            style={{ width: colW('__no_user_activity__'), minWidth: colW('__no_user_activity__') }}
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
                  {showNoWaveRow && (
                  <tr key="no-wave">
                    <th className="sticky left-0 z-10 bg-gray-50 border border-gray-200 px-2 py-2 text-xs font-semibold text-gray-500 text-right align-top pt-3 w-[200px] min-w-[200px] max-w-[200px]">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-gray-400 font-normal italic">No Wave</span>
                        <button
                          onClick={() => setAddingWave(true)}
                          className="text-xs text-purple-400 hover:text-purple-600 hover:bg-purple-100 rounded px-1.5 py-0.5 transition-colors not-italic font-semibold"
                        >
                          + New Wave
                        </button>
                      </div>
                    </th>

                    {/* User activity column cells — width follows header */}
                    {cols.map((project) => (
                      <td
                        key={project.id}
                        className="border border-gray-200 align-top p-2 bg-white"
                        style={{ width: colW(project.id), minWidth: colW(project.id) }}
                      >
                        <CardCell
                          droppableId={cellId(project.id, null)}
                          items={cellIssues(project.id, null)}
                          onAdd={() => setCreateCell({ projectId: project.id, milestoneNumber: null })}
                        />
                      </td>
                    ))}

                    {/* No User Activity / No Wave corner */}
                    <td
                      className="border border-gray-200 align-top p-2 bg-gray-50/50"
                      style={{ width: colW('__no_user_activity__'), minWidth: colW('__no_user_activity__') }}
                    >
                      <CardCell
                        droppableId={cellId('', null)}
                        items={noProjectCellIssues(null)}
                        onAdd={() => setCreateCell({ projectId: '', milestoneNumber: null })}
                        addColor="gray"
                      />
                    </td>
                  </tr>
                  )}
                </tbody>
              )}
            </Droppable>
          </table>
        </div>
      </DragDropContext>

      {addingWave && (
        <CreateWaveDialog
          onCreate={(title, description) => createMilestone(title, description)}
          onClose={() => setAddingWave(false)}
        />
      )}

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
