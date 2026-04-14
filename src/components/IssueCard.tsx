import { Draggable } from '@hello-pangea/dnd';
import type { GitHubIssue } from '../types';

interface Props {
  issue: GitHubIssue;
  index: number;
}

export default function IssueCard({ issue, index }: Props) {
  return (
    <Draggable draggableId={String(issue.number)} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-white rounded-lg border p-3 text-sm cursor-grab select-none transition-shadow ${
            snapshot.isDragging
              ? 'shadow-lg border-blue-300 rotate-1'
              : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <span className="text-gray-900 font-medium leading-snug line-clamp-2">
              {issue.title}
            </span>
            <a
              href={issue.html_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-gray-400 hover:text-blue-500 shrink-0 text-xs tabular-nums"
            >
              #{issue.number}
            </a>
          </div>

          {issue.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {issue.labels.map((label) => (
                <span
                  key={label.id || label.name}
                  className="px-1.5 py-0.5 rounded text-xs font-medium"
                  style={{
                    backgroundColor: `#${label.color}28`,
                    color: `#${label.color}`,
                    border: `1px solid #${label.color}50`,
                  }}
                >
                  {label.name}
                </span>
              ))}
            </div>
          )}

          {issue.assignees.length > 0 && (
            <div className="flex gap-1 mt-1">
              {issue.assignees.map((user) => (
                <img
                  key={user.login}
                  src={user.avatar_url}
                  alt={user.login}
                  title={user.login}
                  className="w-5 h-5 rounded-full"
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}
