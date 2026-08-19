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

function CardCell({ droppableId, items, onAdd }: CardCellProps) {
  return (
    <Droppable droppableId={droppableId} type="CARD">
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className="flex flex-col gap-1.5 min-h-16 rounded-md transition-colors"
          style={{ background: snapshot.isDraggingOver ? 'rgba(35,131,226,0.05)' : 'transparent' }}
        >
          {items.map((issue, idx) => (
            <Draggable key={issue.number} draggableId={`i:${issue.number}`} index={idx}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.draggableProps}
                  {...provided.dragHandleProps}
                  style={{
                    ...provided.draggableProps.style,
                    boxShadow: snapshot.isDragging ? 'var(--n-shadow-lg)' : undefined,
                    borderRadius: snapshot.isDragging ? 6 : undefined,
                  }}
                >
                  <IssueCard issue={issue} hideLabels showStatus />
                </div>
              )}
            </Draggable>
          ))}
          {provided.placeholder}
          <button
            onClick={onAdd}
            className="mt-auto w-full text-xs py-1.5 rounded-md transition-colors flex items-center justify-center gap-1"
            style={{ color: 'var(--n-text-3)', border: '1px dashed var(--n-border)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--n-text-2)'; e.currentTarget.style.background = 'var(--n-hover)'; e.currentTarget.style.borderColor = 'rgba(55,53,47,0.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--n-text-3)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--n-border)'; }}
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
      <div className="flex-1 flex flex-col items-center justify-center p-8" style={{ background: 'var(--n-bg)' }}>
        <div className="flex flex-col items-center max-w-sm text-center">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
            style={{ background: 'var(--n-hover-strong)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--n-text-2)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-base font-semibold mb-1.5" style={{ color: 'var(--n-text)' }}>No active User Activities</h3>
          <p className="text-sm mb-6" style={{ color: 'var(--n-text-2)' }}>
            Cherry-pick which User Activities (GitHub Projects) are included in this repo's Story Map, or create a brand new one to get started.
          </p>
          <div className="flex flex-col gap-2 w-full">
            <button
              onClick={() => setView('user-activities')}
              className="w-full px-4 py-2 text-sm font-medium rounded-md transition-colors"
              style={{ background: 'var(--n-blue)', color: '#fff' }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
            >
              Cherry-Pick User Activities
            </button>
            {addingUserActivity ? (
              <form onSubmit={handleCreateUserActivity} className="flex items-center gap-2 mt-1 w-full">
                <input
                  autoFocus
                  value={newUserActivityTitle}
                  onChange={(e) => setNewUserActivityTitle(e.target.value)}
                  placeholder="User activity name…"
                  className="flex-1 min-w-0 px-3 py-1.5 text-xs rounded-md outline-none"
                  style={{ border: '1px solid var(--n-border)', background: 'var(--n-sidebar)', color: 'var(--n-text)' }}
                />
                <button
                  type="submit"
                  disabled={userActivitySaving || !newUserActivityTitle.trim()}
                  className="px-3 py-1.5 text-xs font-medium rounded-md disabled:opacity-40 transition-colors shrink-0"
                  style={{ background: 'var(--n-blue)', color: '#fff' }}
                >
                  {userActivitySaving ? '…' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => { setAddingUserActivity(false); setNewUserActivityTitle(''); }}
                  className="px-3 py-1.5 text-xs rounded-md transition-colors shrink-0"
                  style={{ color: 'var(--n-text-2)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--n-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                onClick={() => setAddingUserActivity(true)}
                className="w-full px-4 py-2 text-sm font-medium rounded-md transition-colors"
                style={{ border: '1px solid var(--n-border)', color: 'var(--n-text-2)', background: 'transparent' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--n-hover)'; e.currentTarget.style.color = 'var(--n-text)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--n-text-2)'; }}
              >
                + Create New Activity
              </button>
            )}
          </div>
          {moveError && (
            <p className="text-xs mt-4" style={{ color: '#E03E3E' }}>{moveError}</p>
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
                    <th
                      className="sticky left-0 top-0 z-30 w-[200px] min-w-[200px] max-w-[200px]"
                      style={{ background: 'var(--n-sidebar)', borderRight: '1px solid var(--n-border)', borderBottom: '1px solid var(--n-border)' }}
                    />

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
                            className="sticky top-0 z-20 px-4 py-3 text-sm font-medium text-center whitespace-nowrap cursor-grab select-none"
                            style={{
                              // DnD transform/position MUST come first so our visual styles layer on top
                              ...provided.draggableProps.style,
                              background: snapshot.isDragging ? 'var(--n-hover-strong)' : 'var(--n-sidebar)',
                              color: 'var(--n-text)',
                              borderRight: '1px solid var(--n-border)',
                              borderBottom: '1px solid var(--n-border)',
                              boxShadow: snapshot.isDragging ? 'var(--n-shadow)' : 'none',
                            }}
                          >
                            <span className="mr-1.5 text-xs" style={{ color: 'var(--n-text-3)' }}>&#x2803;</span>
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
                      className="sticky top-0 z-20 px-2 py-2 text-sm font-medium text-center"
                      style={{ background: 'var(--n-sidebar)', color: 'var(--n-text-3)', borderRight: '1px solid var(--n-border)', borderBottom: '1px solid var(--n-border)' }}
                    >
                      {addingUserActivity ? (
                        <form onSubmit={handleCreateUserActivity} className="flex items-center gap-1">
                          <input
                            autoFocus
                            value={newUserActivityTitle}
                            onChange={(e) => setNewUserActivityTitle(e.target.value)}
                            placeholder="User activity name\u2026"
                            className="flex-1 min-w-0 px-2 py-1 text-xs rounded outline-none"
                            style={{ border: '1px solid var(--n-blue)', background: 'var(--n-bg)', color: 'var(--n-text)' }}
                          />
                          <button type="submit" disabled={userActivitySaving || !newUserActivityTitle.trim()} className="disabled:opacity-40 px-1 text-base leading-none" style={{ color: 'var(--n-blue)' }}>&#x2713;</button>
                          <button type="button" onClick={() => { setAddingUserActivity(false); setNewUserActivityTitle(''); }} className="px-1 text-base leading-none" style={{ color: 'var(--n-text-3)' }}>&#x2715;</button>
                        </form>
                      ) : (
                        <div className="flex items-center justify-between px-2">
                          <span style={{ color: 'var(--n-text-3)' }}>No User Activity</span>
                          <button
                            onClick={() => setAddingUserActivity(true)}
                            className="text-xs px-1.5 py-0.5 rounded transition-colors"
                            style={{ color: 'var(--n-text-2)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--n-hover-strong)'; e.currentTarget.style.color = 'var(--n-text)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--n-text-2)'; }}
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
                          style={{
                            ...provided.draggableProps.style,
                            // When lifted out of the table, cells lose their widths.
                            // Force the row to display as a flex row so explicit cell widths hold.
                            ...(snapshot.isDragging ? { display: 'flex', opacity: 0.92 } : {}),
                          }}
                        >
                          {/* Row label — sticky left, not resizable */}
                          <th
                            {...provided.dragHandleProps}
                            className="px-3 py-2 text-xs font-medium text-right align-top pt-3 cursor-grab select-none w-[200px] min-w-[200px] max-w-[200px] shrink-0"
                            style={{
                              background: snapshot.isDragging ? 'var(--n-hover-strong)' : 'var(--n-sidebar)',
                              color: 'var(--n-text-2)',
                              borderRight: '1px solid var(--n-border)',
                              borderBottom: '1px solid var(--n-border)',
                            }}
                          >
                            <span className="mr-1 text-xs" style={{ color: 'var(--n-text-3)' }}>&#x2803;</span>
                            <span className="truncate block">{milestone.title}</span>
                          </th>

                          {/* User activity column cells — width follows header */}
                          {cols.map((project) => (
                            <td
                              key={project.id}
                              className="align-top p-2 shrink-0"
                              style={{ background: 'var(--n-bg)', borderRight: '1px solid var(--n-border)', borderBottom: '1px solid var(--n-border)', width: colW(project.id), minWidth: colW(project.id) }}
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
                            className="align-top p-2 shrink-0"
                            style={{ background: 'var(--n-sidebar)', borderRight: '1px solid var(--n-border)', borderBottom: '1px solid var(--n-border)', width: colW('__no_user_activity__'), minWidth: colW('__no_user_activity__') }}
                          >
                            <CardCell
                              droppableId={cellId('', milestone.number)}
                              items={noProjectCellIssues(milestone.number)}
                              onAdd={() => setCreateCell({ projectId: '', milestoneNumber: milestone.number })}
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
                    <th
                      className="sticky left-0 z-10 px-2 py-2 text-xs font-medium text-right align-top pt-3 w-[200px] min-w-[200px] max-w-[200px]"
                      style={{ background: 'var(--n-sidebar)', color: 'var(--n-text-3)', borderRight: '1px solid var(--n-border)', borderBottom: '1px solid var(--n-border)' }}
                    >
                      <div className="flex items-center justify-end gap-2">
                        <span className="italic" style={{ color: 'var(--n-text-3)' }}>No Wave</span>
                        <button
                          onClick={() => setAddingWave(true)}
                          className="text-xs not-italic font-medium px-1.5 py-0.5 rounded transition-colors"
                          style={{ color: 'var(--n-text-2)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--n-hover-strong)'; e.currentTarget.style.color = 'var(--n-text)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--n-text-2)'; }}
                        >
                          + New Wave
                        </button>
                      </div>
                    </th>

                    {/* User activity column cells — width follows header */}
                    {cols.map((project) => (
                      <td
                        key={project.id}
                        className="align-top p-2"
                        style={{ background: 'var(--n-bg)', borderRight: '1px solid var(--n-border)', borderBottom: '1px solid var(--n-border)', width: colW(project.id), minWidth: colW(project.id) }}
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
                      className="align-top p-2"
                      style={{ background: 'var(--n-sidebar)', borderRight: '1px solid var(--n-border)', borderBottom: '1px solid var(--n-border)', width: colW('__no_user_activity__'), minWidth: colW('__no_user_activity__') }}
                    >
                      <CardCell
                        droppableId={cellId('', null)}
                        items={noProjectCellIssues(null)}
                        onAdd={() => setCreateCell({ projectId: '', milestoneNumber: null })}
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
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 text-sm px-4 py-2.5 rounded-lg z-50"
          style={{ background: '#E03E3E', color: '#fff', boxShadow: 'var(--n-shadow-lg)' }}
        >
          {moveError}
        </div>
      )}
    </>
  );
}
