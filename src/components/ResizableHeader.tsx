import { useRef, useCallback, forwardRef } from 'react';
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';

export const GRID_DEFAULT_WIDTH = 200;
export const KANBAN_DEFAULT_WIDTH = 280;
export const MIN_COL_WIDTH = 100;
export const MAX_COL_WIDTH = 600;

interface ResizableHeaderProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  /** Unique key used to look up / persist the width for this column. */
  columnKey: string;
  /** Current column width in pixels. */
  width: number;
  /** Called on every mouse-move during a resize drag with (columnKey, newWidth). */
  onResize: (key: string, width: number) => void;
  /** Colour theme of the visual handle indicator. */
  handleVariant?: 'blue' | 'green';
  /**
   * When provided, the drag-handle props are applied to an inner wrapper div
   * around the children instead of the <th> itself. This prevents the resize
   * handle — a sibling of that wrapper — from being found by
   * `event.target.closest('[data-rfd-drag-handle-context-id]')`, which the
   * @hello-pangea/dnd window-level capture listener uses to detect drags.
   */
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
}

/**
 * A `<th>` wrapper that renders a drag-to-resize handle on its right edge.
 *
 * Supports React `forwardRef` so it works seamlessly inside
 * `@hello-pangea/dnd` Draggable render props that require `provided.innerRef`.
 *
 * Pass `dragHandleProps={provided.dragHandleProps}` instead of spreading them
 * directly on this component. The component places them on an inner content
 * div so the resize handle (a sibling) cannot trigger a column-reorder drag.
 */
const ResizableHeader = forwardRef<HTMLTableCellElement, ResizableHeaderProps>(
  function ResizableHeader(
    { columnKey, width, onResize, handleVariant = 'blue', style, className, children, dragHandleProps, ...rest },
    ref,
  ) {
    const startXRef = useRef<number>(0);
    const startWidthRef = useRef<number>(width);

    const handleMouseDown = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();

        startXRef.current = e.clientX;
        startWidthRef.current = width;

        const onMouseMove = (ev: MouseEvent) => {
          const delta = ev.clientX - startXRef.current;
          const newWidth = Math.min(
            MAX_COL_WIDTH,
            Math.max(MIN_COL_WIDTH, startWidthRef.current + delta),
          );
          onResize(columnKey, newWidth);
        };

        const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        };

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      },
      [columnKey, width, onResize],
    );

    const indicatorCls =
      handleVariant === 'green'
        ? 'group-hover/colresize:bg-green-400'
        : 'group-hover/colresize:bg-blue-400';

    return (
      <th
        ref={ref}
        {...rest}
        style={{ width, minWidth: width, ...style }}
        className={`relative group/colresize ${className ?? ''}`}
      >
        {dragHandleProps ? (
          <div {...(dragHandleProps as React.HTMLAttributes<HTMLDivElement>)}>
            {children}
          </div>
        ) : (
          children
        )}

        {/* Drag-to-resize handle — pinned to the right edge of the header */}
        <div
          onMouseDown={handleMouseDown}
          className="absolute top-0 right-0 h-full w-2 cursor-col-resize z-10 flex items-center justify-center select-none"
          aria-hidden="true"
        >
          {/* Visual indicator bar — fades in when the header is hovered */}
          <div
            className={`w-px h-5 rounded transition-colors duration-150 bg-transparent ${indicatorCls}`}
          />
        </div>
      </th>
    );
  },
);

export default ResizableHeader;
