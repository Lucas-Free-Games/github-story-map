import { useRef, useCallback } from 'react';
import { useAppStore } from '../store/appStore';

export const MIN_COL_WIDTH = 150;
export const MAX_COL_WIDTH = 600;

interface ResizeHandleProps {
  /** Unique key used to look up / store width in Zustand + localStorage */
  columnKey: string;
  /** Fallback width (px) when no custom width has been saved yet */
  defaultWidth: number;
}

/**
 * Draggable resize handle that sits on the right edge of a column header.
 *
 * The parent <th> must already be a positioned element (sticky / relative / fixed)
 * so that the absolute child is correctly contained.
 *
 * Usage:
 *   <th style={{ width: colW, minWidth: colW }} className="... sticky top-0">
 *     Column label
 *     <ResizeHandle columnKey="my-col" defaultWidth={200} />
 *   </th>
 */
export function ResizeHandle({ columnKey, defaultWidth }: ResizeHandleProps) {
  const columnWidths = useAppStore((s) => s.columnWidths);
  const setColumnWidth = useAppStore((s) => s.setColumnWidth);

  // Keep start values in refs so the closure inside addEventListener is always fresh
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Prevent the mousedown from bubbling to the drag-handle on the parent <th>
      e.preventDefault();
      e.stopPropagation();

      startXRef.current = e.clientX;
      startWidthRef.current = columnWidths[columnKey] ?? defaultWidth;

      const onMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startXRef.current;
        const next = Math.min(
          MAX_COL_WIDTH,
          Math.max(MIN_COL_WIDTH, startWidthRef.current + delta),
        );
        setColumnWidth(columnKey, next);
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    // columnWidths is needed so startWidthRef captures the latest stored value
    [columnKey, defaultWidth, columnWidths, setColumnWidth],
  );

  return (
    <div
      onMouseDown={onMouseDown}
      className="absolute right-0 top-0 h-full w-2 cursor-col-resize flex items-center justify-center group/resize select-none z-10"
      title="Drag to resize column"
    >
      {/* Subtle visual indicator — becomes visible on hover */}
      <div className="w-0.5 h-3/4 rounded transition-all bg-current opacity-0 group-hover/resize:opacity-25" />
    </div>
  );
}
