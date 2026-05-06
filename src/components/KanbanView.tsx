import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { useAppStore } from '../store/appStore';
import type { GitHubIssue, GitHubProject } from '../types';
import IssueCard from './IssueCard';
import CreateIssueModal from './CreateIssueModal';
import ResizableHeader, { KANBAN_DEFAULT_WIDTH } from './ResizableHeader';

// Format: "k:{status|none}:{projectId|__no_user_activity__}"
// GitHub node IDs are base64 and never contain colons, so lastIndexOf(':') is safe.
function kanbanCellId(status: string, projectId: string | null): string {
  return `k:${status || 'none'}:${projectId ?? '__no_user_activity__'}`;
}
function parseKanbanCell(id: string): { status: string | null; projectId: string | null } {
  const first = id.indexOf(':');
  const last = id.lastIndexOf(':');
  const statusPart = id.slice(first + 1, last);
  const projectPart = id.slice(last + 1);
  return {
    status: statusPart === 'none' ? null : statusPart,
    projectId: projectPart === '__no_user_activity__' ? null : projectPart,
  };
}

interface CellKey {
  projectId: string | null;
  statusLabel: string;
}

function sortedProjects(projects: GitHubProject[], userActivityOrder: number[]): GitHubProject[] {
  return [...projects].sort((a, b) => {
    const ai = userActivityOrder.indexOf(a.number);
    const bi = userActivityOrder.indexOf(b.number);
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
    issues, layout, kanbanShowClosedIssues,
    moveIssueInKanbanByProject, columnWidths, setColumnWidth,
    projects, projectIssues, kanbanMilestoneNumber, setKanbanMilestone,
    kanbanStatusColumns, kanbanIssueStatuses, milestones, loading,
  } = useAppStore();
  const [createCell, setCreateCell] = useState<CellKey | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const cols = [...kanbanStatusColumns];
  const colK = (status: string) => columnWidths[kanbanColKey(status)] ?? KANBAN_DEFAULT_WIDTH;

  const openProjects = projects.filter((p) => !p.closed);
  // null sentinel = "No User Activity" row — always last
  const groups: (GitHubProject | null)[] = [...sortedProjects(openProjects, layout.userActivityOrder), null];

  const allProjectIssueNumbers = new Set(Object.values(projectIssues).flat());

  const allVisible = kanbanShowClosedIssues ? issues : issues.filter((i) => i.state === 'open');
  const visibleIssues = kanbanMilestoneNumber !== null
    ? allVisible.filter((i) => i.milestone?.number === kanbanMilestoneNumber)
    : allVisible;

  function cellIssues(projectId: string | null, status: string): GitHubIssue[] {
    return visibleIssues.filter((issue) => {
      const pMatch = projectId === null
        ? !allProjectIssueNumbers.has(issue.number)
        : (projectIssues[projectId] ?? []).includes(issue.number);
      const issueStatus = kanbanIssueStatuses[issue.number] ?? null;
      const statusMatch = status === '' ? issueStatus === null : issueStatus === status;
      return pMatch && statusMatch;
    });
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    const { draggableId, source, destination } = result;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const issueNumber = Number(draggableId.slice(2));
    const src = parseKanbanCell(source.droppableId);
    const dst = parseKanbanCell(destination.droppableId);

    moveIssueInKanbanByProject(issueNumber, src.status, dst.status, src.projectId, dst.projectId)
      .catch((err) => {
        setMoveError(err instanceof Error ? err.message : 'Failed to move issue');
        setTimeout(() => setMoveError(null), 4000);
      });
  }

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden">
      {milestones.length > 0 && (
        <div className="shrink-0 px-4 py-2 bg-white border-b border-gray-200 flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Wave</span>
          <select
            value={kanbanMilestoneNumber ?? ''}
            onChange={(e) => setKanbanMilestone(e.target.value ? Number(e.target.value) : null)}
            disabled={loading}
            className="text-sm border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50"
          >
            <option value="">All Waves</option>
            {milestones.map((m) => (
              <option key={m.number} value={m.number}>{m.title}</option>
            ))}
          </select>
        </div>
      )}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-auto">
          <table className="border-collapse w-full">
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
              {groups.map((project) => (
                <>
                  <tr key={`${project?.id ?? 'no-user-activity'}-header`}>
                    <td
                      colSpan={cols.length}
                      className="sticky left-0 bg-purple-50 border border-gray-200 px-4 py-2 text-xs font-semibold text-purple-900 uppercase tracking-wide"
                    >
                      {project
                        ? project.title
                        : <span className="text-purple-400 font-normal italic normal-case tracking-normal">No User Activity</span>}
                    </td>
                  </tr>

                  <tr key={`${project?.id ?? 'no-user-activity'}-cards`}>
                    {cols.map((status) => {
                      const projectId = project?.id ?? null;
                      const items = cellIssues(projectId, status);
                      return (
                        <td
                          key={kanbanColKey(status)}
                          className="border border-gray-200 align-top p-2 bg-white"
                          style={{ minWidth: colK(status) }}
                        >
                          <Droppable droppableId={kanbanCellId(status, projectId)} type="CARD">
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`grid gap-2 min-h-12 rounded transition-colors items-start ${
                                  snapshot.isDraggingOver ? 'bg-green-50/60' : ''
                                }`}
                                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
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
                              </div>
                            )}
                          </Droppable>
                          {status !== '' && (
                            <button
                              onClick={() => setCreateCell({ projectId, statusLabel: status })}
                              className="mt-2 w-full text-xs text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg py-1.5 border border-dashed border-gray-200 hover:border-green-300 transition-colors flex items-center justify-center gap-1"
                            >
                              <span className="text-sm font-medium leading-none">+</span>
                              New Issue
                            </button>
                          )}
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
      </div>

      {createCell && (
        <CreateIssueModal
          defaultMilestoneNumber={kanbanMilestoneNumber ?? undefined}
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
