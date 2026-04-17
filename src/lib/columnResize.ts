import type React from 'react';

/** Minimum column width in pixels — prevents layout breakage. */
export const COLUMN_MIN_WIDTH = 150;

/** Maximum column width in pixels — prevents overflow on small screens. */
export const COLUMN_MAX_WIDTH = 600;

/** Default column width for the Grid (Epic) view, matching original 200 px layout. */
export const COLUMN_DEFAULT_WIDTH = 200;

/** Default column width for the Kanban (Status) view, matching original w-72 (288 px) layout. */
export const KANBAN_COLUMN_DEFAULT_WIDTH = 288;

/**
 * Starts a mouse-driven column resize interaction.
 * Attach this to the `onMouseDown` of a resize-handle element.
 *
 * Calls `e.preventDefault()` to prevent text selection during drag and
 * `e.stopPropagation()` to prevent triggering parent DnD drag handlers.
 *
 * @param e              React mouse event from the resize handle.
 * @param currentWidth   Column's current width in pixels.
 * @param setColumnWidth Zustand action to persist the updated width.
 * @param key            Unique key identifying the column (project node-id or status label).
 */
export function startColumnResize(
  e: React.MouseEvent,
  currentWidth: number,
  setColumnWidth: (key: string, width: number) => void,
  key: string,
): void {
  e.preventDefault();
  e.stopPropagation();

  const startX = e.clientX;

  const onMouseMove = (ev: MouseEvent) => {
    const newWidth = Math.min(
      COLUMN_MAX_WIDTH,
      Math.max(COLUMN_MIN_WIDTH, currentWidth + ev.clientX - startX),
    );
    setColumnWidth(key, newWidth);
  };

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}
