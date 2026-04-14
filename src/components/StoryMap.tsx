import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { useAppStore } from '../store/appStore';
import type { GitHubIssue, GitHubProject } from '../types';
import IssueCard from './IssueCard';
import CreateIssueModal from './CreateIssueModal';

function getWaveLabel(issue: GitHubIssue): string | null {
  const label = issue.labels.find((l) => l.name.startsWith('w_'));
  return label ? label.name.slice(2) : null;
}

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

interface CellKey {
  projectId: string;
  waveLabel: string;
}

export default function StoryMap() {
  const { issues, projects, projectIssues, waveLabels, layout, reorderProjects } = useAppStore();
  const [createCell, setCreateCell] = useState<CellKey | null>(null);

  const cols = sortedProjects(projects, layout.epicOrder);
  const rows = [...waveLabels, ''];

  function cellIssues(projectId: string, wave: string): GitHubIssue[] {
    const inProject = new Set(projectIssues[projectId] ?? []);
    return issues.filter((issue) => {
      const iw = getWaveLabel(issue);
      const waveMatch = wave === '' ? iw === null : iw === wave;
      return inProject.has(issue.number) && waveMatch;
    });
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination || result.source.index === result.destination.index) return;
    reorderProjects(result.source.index, result.destination.index);
  }

  if (cols.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        No projects found. Use{' '}
        <span className="font-mono mx-1 bg-gray-100 px-1 rounded">Projects</span>
        {' '}to create one.
      </div>
    );
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-auto h-full">
          <table className="border-collapse">
            <thead>
              <Droppable droppableId="columns" direction="horizontal">
                {(provided) => (
                  <tr ref={provided.innerRef} {...provided.droppableProps}>
                    <th className="sticky left-0 top-0 z-30 bg-white border border-gray-200 w-36 min-w-36" />
                    {cols.map((project, index) => (
                      <Draggable key={project.id} draggableId={project.id} index={index}>
                        {(provided, snapshot) => (
                          <th
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`sticky top-0 z-20 border border-gray-200 px-4 py-3 text-sm font-semibold text-blue-900 text-center w-72 min-w-72 whitespace-nowrap cursor-grab select-none transition-colors ${
                              snapshot.isDragging ? 'bg-blue-100 shadow-lg z-50' : 'bg-blue-50'
                            }`}
                          >
                            <span className="text-blue-300 mr-1.5 text-xs">⠿</span>
                            {project.title}
                          </th>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </tr>
                )}
              </Droppable>
            </thead>
            <tbody>
              {rows.map((wave) => (
                <tr key={wave || 'no-wave'}>
                  <th className="sticky left-0 z-10 bg-purple-50 border border-gray-200 px-3 py-2 text-xs font-semibold text-purple-900 text-right whitespace-nowrap align-top pt-3">
                    {wave || <span className="text-purple-400 font-normal italic">No Wave</span>}
                  </th>
                  {cols.map((project) => {
                    const items = cellIssues(project.id, wave);
                    return (
                      <td
                        key={project.id}
                        className="border border-gray-200 align-top p-2 bg-white w-72 min-w-72"
                      >
                        <div className="flex flex-col gap-2 min-h-16">
                          {items.map((issue) => (
                            <IssueCard key={issue.number} issue={issue} hideLabels showStatus />
                          ))}
                          <button
                            onClick={() => setCreateCell({ projectId: project.id, waveLabel: wave })}
                            className="mt-auto w-full text-xs text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg py-1.5 border border-dashed border-gray-200 hover:border-blue-300 transition-colors flex items-center justify-center gap-1"
                          >
                            <span className="text-sm font-medium leading-none">+</span>
                            Add issue
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DragDropContext>

      {createCell && (
        <CreateIssueModal
          defaultProjectId={createCell.projectId}
          defaultWaveLabel={createCell.waveLabel}
          onClose={() => setCreateCell(null)}
        />
      )}
    </>
  );
}
