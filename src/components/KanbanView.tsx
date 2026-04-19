import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { useAppStore } from '../store/appStore';
import type { GitHubIssue, GitHubMilestone } from '../types';
import IssueCard from './IssueCard';
import CreateIssueModal from './CreateIssueModal';
import ResizableHeader, { KANBAN_DEFAULT_WIDTH } from './ResizableHeader';

function getStatusLabel(issue: GitHubIssue): string | null {
  const label = issue.labels.find((l) => l.name.startsWith('s_'));
  return label ? label.name.slice(2) : null;
}

function kanbanCellId(status: string, milestoneNumber: number | null): string {
  return `k:${status || 'none'}:${milestoneNumber ?? 'none'}`;
}
function parseKanbanCell(id: string): { status: string | null; milestoneNumber: number | null } {
  const first = id.indexOf(':');
  const last = id.lastIndexOf(':');
  const statusPart = id.slice(first + 1, last);
  const milestonePart = id.slice(last + 1);
  return {
    status: statusPart === 'none' ? null : statusPart,
    milestoneNumber: milestonePart === 'none' ? null : Number(milestonePart),
  };
}

interface CellKey {
  milestoneNumber: number | null;
  statusLabel: string;
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

function kanbanColKey(status: string): string {
  return status === '' ? '__no_status__' : status;
}

export default function KanbanView() {
  const {
    issues, milestones, statusLabels, layout, showClosedIssues,
    moveIssueInKanban, moveIssueInKanbanNative, columnWidths, setColumnWidth,
    projects, projectIssues,
    kanbanProjectId, kanbanStatusField, kanbanIssueStatuses, setKanbanProject,
    loading,
  } = useAppStore();
  const [createCell, setCreateCell] = useState<CellKey | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);

  const isProjectMode = kanbanProjectId !== null;
  const openProjects = projects.filter((p) => !p.closed);

  // In project mode, columns come from the project's Status field options.
  // In label mode, columns come from s_* labels.
  const cols: string[] = isProjectMode && kanbanStatusField
    ? [...kanbanStatusField.options.map((o) => o.name), '']
    : [...statusLabels, ''];

  const groups: (GitHubMilestone | null)[] = [...sortedMilestones(milestones, layout.milestoneOrder), null];

  const colK = (status: string) => columnWidths[kanbanColKey(status)] ?? KANBAN_DEFAULT_WIDTH;

  const allVisible = showClosedIssues ? issues : issues.filter((i) => i.state === 'open');

  // In project mode, only show issues that belong to the selected project.
  const visibleIssues = isProjectMode
    ? allVisible.filter((i) => (projectIssues[kanbanProjectId] ?? []).includes(i.number))
    : allVisible;

  function cellIssues(milestoneNumber: number | null, status: string): GitHubIssue[] {
    return visibleIssues.filter((issue) => {
      const mMatch = milestoneNumber === null
        ? issue.milestone === null
        : issue.milestone?.number === milestoneNumber;
      const statusMatch = isProjectMode
        ? status === ''
          ? !kanbanIssueStatuses[issue.number]
          : kanbanIssueStatuses[issue.number] === status
        : status === ''
          ? getStatusLabel(issue) === null
          : getStatusLabel(issue) === status;
      return mMatch && statusMatch;
    });
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    const { draggableId, source, destination } = result;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const issueNumber = Number(draggableId.slice(2));
    const src = parseKanbanCell(source.droppableId);
    const dst = parseKanbanCell(destination.droppableId);

    const action = isProjectMode
      ? moveIssueInKanbanNative(issueNumber, src.status, dst.status, src.milestoneNumber, dst.milestoneNumber)
      : moveIssueInKanban(issueNumber, src.status, dst.status, src.milestoneNumber, dst.milestoneNumber);

    action.catch((err) => {
      setMoveError(err instanceof Error ? err.message : 'Failed to move issue');
      setTimeout(() => setMoveError(null), 4000);
    });
  }

  async function handleProjectChange(projectId: string) {
    setProjectLoading(true);
    try {
      await setKanbanProject(projectId || null);
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : 'Failed to load project');
      setTimeout(() => setMoveError(null), 4000);
    } finally {
      setProjectLoading(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 bg-white">
        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Project</span>
        <select
          value={kanbanProjectId ?? ''}
          onChange={(e) => handleProjectChange(e.target.value)}
          disabled={loading || projectLoading}
          className="text-sm border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400 min-w-48 disabled:opacity-50"
        >
          <option value="">Label-based (s_ labels)</option>
          {openProjects.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
        {projectLoading && (
          <span className="text-xs text-gray-400">Loading…</span>
        )}
        {isProjectMode && !kanbanStatusField && !projectLoading && (
          <span className="text-xs text-amber-600">This project has no Status field — showing all issues as unstatused.</span>
        )}
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-auto h-full">
          <table className="border-collapse">
            <thead>
              <tr>
                {cols.map((status) => (
                  <ResizableHeader
                    key={kanbanColKey(status)}
                    columnKey={kanbanColKey(status)}
                    width={colK(status)}
                    onResize={setColumnWidth}
                    handleVariant="green"
                    className="sticky top-0 z-20 bg-green-50 border border-gray-200 px-4 py-3 text-sm font-semibold text-green-900 text-center whitespace-nowrap"
                  >
                    {status || <span className="text-green-400 font-normal italic">No Status</span>}
                  </ResizableHeader>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((milestone) => (
                <>
                  <tr key={`${milestone?.number ?? 'no-milestone'}-header`}>
                    <td
                      colSpan={cols.length}
                      className="sticky left-0 bg-purple-50 border border-gray-200 px-4 py-2 text-xs font-semibold text-purple-900 uppercase tracking-wide"
                    >
                      {milestone
                        ? milestone.title
                        : <span className="text-purple-400 font-normal italic normal-case tracking-normal">No Wave</span>}
                    </td>
                  </tr>

                  <tr key={`${milestone?.number ?? 'no-milestone'}-cards`}>
                    {cols.map((status) => {
                      const milestoneNumber = milestone?.number ?? null;
                      const items = cellIssues(milestoneNumber, status);
                      return (
                        <td
                          key={kanbanColKey(status)}
                          className="border border-gray-200 align-top p-2 bg-white"
                          style={{ width: colK(status), minWidth: colK(status) }}
                        >
                          <Droppable droppableId={kanbanCellId(status, milestoneNumber)} type="CARD">
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`flex flex-col gap-2 min-h-16 rounded transition-colors ${
                                  snapshot.isDraggingOver ? 'bg-green-50/60' : ''
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
                                        <IssueCard key={issue.number} issue={issue} hideLabels showStatus />
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                                <button
                                  onClick={() => setCreateCell({ milestoneNumber, statusLabel: status })}
                                  className="mt-auto w-full text-xs text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg py-1.5 border border-dashed border-gray-200 hover:border-green-300 transition-colors flex items-center justify-center gap-1"
                                >
                                  <span className="text-sm font-medium leading-none">+</span>
                                  New Issue
                                </button>
                              </div>
                            )}
                          </Droppable>
                        </td>
                      );
                    })}
                  </tr>
                </>
              ))}
            </tbody>
          </table>
        </div>
      </DragDropContext>

      {createCell && (
        <CreateIssueModal
          defaultMilestoneNumber={createCell.milestoneNumber ?? undefined}
          defaultStatusLabel={createCell.statusLabel}
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
