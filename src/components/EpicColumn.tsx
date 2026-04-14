import { useState } from 'react';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import type { GitHubIssue } from '../types';
import IssueCard from './IssueCard';
import CreateIssueModal from './CreateIssueModal';

interface Props {
  epicIssue: GitHubIssue | null;
  columnKey: string;
  stories: GitHubIssue[];
  index: number;
  isBacklog?: boolean;
}

function StoriesDroppable({
  columnKey,
  stories,
  highlight,
}: {
  columnKey: string;
  stories: GitHubIssue[];
  highlight: string;
}) {
  return (
    <Droppable droppableId={columnKey}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`flex-1 rounded-b-xl p-2 min-h-24 transition-colors ${
            snapshot.isDraggingOver ? highlight : 'bg-opacity-50'
          }`}
        >
          <div className="flex flex-col gap-2">
            {stories.map((story, i) => (
              <IssueCard key={story.number} issue={story} index={i} />
            ))}
          </div>
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
}

export default function EpicColumn({ epicIssue, columnKey, stories, index, isBacklog }: Props) {
  const [showCreate, setShowCreate] = useState(false);

  if (isBacklog) {
    return (
      <>
        <div className="flex flex-col w-64 shrink-0">
          <div className="rounded-t-xl px-3 pt-3 pb-2 bg-gray-100 flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-gray-500 text-xs uppercase tracking-widest">
                Backlog
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">{stories.length} unassigned</p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              title="New issue in backlog"
              className="text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-md w-6 h-6 flex items-center justify-center text-base leading-none transition-colors"
            >
              +
            </button>
          </div>
          <StoriesDroppable columnKey="backlog" stories={stories} highlight="bg-gray-200" />
        </div>

        {showCreate && (
          <CreateIssueModal defaultEpicKey="backlog" onClose={() => setShowCreate(false)} />
        )}
      </>
    );
  }

  return (
    <>
      <Draggable draggableId={`epic-${columnKey}`} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            className={`flex flex-col w-64 shrink-0 transition-opacity ${
              snapshot.isDragging ? 'opacity-90' : ''
            }`}
          >
            {/* Epic header — drag handle */}
            <div
              {...provided.dragHandleProps}
              className={`rounded-t-xl px-3 pt-3 pb-2 cursor-grab ${
                snapshot.isDragging ? 'bg-blue-200' : 'bg-blue-100'
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <h3 className="font-semibold text-blue-900 text-sm leading-snug line-clamp-2">
                  {epicIssue?.title ?? `Epic #${columnKey}`}
                </h3>
                <div className="flex items-center gap-1 shrink-0">
                  {epicIssue && (
                    <a
                      href={epicIssue.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-blue-400 hover:text-blue-600 text-xs tabular-nums"
                    >
                      #{epicIssue.number}
                    </a>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowCreate(true); }}
                    title="New issue in this epic"
                    className="text-blue-400 hover:text-blue-700 hover:bg-blue-200 rounded-md w-5 h-5 flex items-center justify-center text-base leading-none transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
              <p className="text-xs text-blue-500 mt-0.5">{stories.length} stories</p>
            </div>

            {/* Stories drop area */}
            <StoriesDroppable
              columnKey={columnKey}
              stories={stories}
              highlight="bg-blue-100"
            />
          </div>
        )}
      </Draggable>

      {showCreate && (
        <CreateIssueModal defaultEpicKey={columnKey} onClose={() => setShowCreate(false)} />
      )}
    </>
  );
}
