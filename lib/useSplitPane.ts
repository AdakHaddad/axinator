'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Drag-to-resize hook.
 *
 * Returns `size` in pixels and an `onMouseDown` handler to attach to the
 * drag handle element. Clamps between `min` and `max` px.
 *
 * direction: 'h' → resize width (column splitter)
 *            'v' → resize height (row splitter)
 */
export function useSplitPane(
  initialPx: number,
  minPx: number,
  maxPx: number,
  direction: 'h' | 'v' = 'h',
) {
  const [size, setSize] = useState(initialPx);
  const dragging = useRef(false);
  const startPos = useRef(0);
  const startSize = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      startPos.current  = direction === 'h' ? e.clientX : e.clientY;
      startSize.current = size;
      document.body.style.cursor     = direction === 'h' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [direction, size],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = (direction === 'h' ? e.clientX : e.clientY) - startPos.current;
      setSize(Math.max(minPx, Math.min(maxPx, startSize.current + delta)));
    };

    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [direction, minPx, maxPx]);

  return { size, onMouseDown };
}
