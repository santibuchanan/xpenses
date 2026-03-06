import { useState, useRef } from "react";

/**
 * useSwipeSheet
 * Hook reutilizable para bottom sheets con swipe-down para cerrar.
 *
 * Uso:
 *   const { dragY, isDragging, handlers } = useSwipeSheet({ onClose, threshold: 120 });
 *   <div {...handlers} style={{ transform: `translateY(${dragY}px)`, transition: isDragging ? "none" : "transform 0.3s ease" }}>
 *
 * Para restringir el swipe al handle:
 *   const { dragY, isDragging, handleHandlers } = useSwipeSheet({ onClose, handleOnly: true });
 *   <div data-handle {...handleHandlers}>...</div>
 *   <div style={{ transform: `translateY(${dragY}px)`, transition: isDragging ? "none" : "transform 0.3s ease" }}>
 */
export function useSwipeSheet({ onClose, threshold = 120, handleOnly = false } = {}) {
  const startY = useRef(null);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const onTouchStart = (e) => {
    startY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const onTouchMove = (e) => {
    if (!isDragging || startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setDragY(dy);
  };

  const onTouchEnd = () => {
    if (dragY > threshold) onClose();
    else setDragY(0);
    startY.current = null;
    setIsDragging(false);
  };

  const handlers = { onTouchStart, onTouchMove, onTouchEnd };

  return { dragY, isDragging, handlers };
}

/**
 * useSwipeRow
 * Hook reutilizable para filas con swipe horizontal (iOS-style delete).
 *
 * Uso:
 *   const { offsetX, handlers, reset } = useSwipeRow({ peekDistance: 80, fullDistance: 180, onFull });
 */
export function useSwipeRow({ peekDistance = 80, fullDistance = 180, onFull } = {}) {
  const [offsetX, setOffsetX] = useState(0);
  const startX = useRef(null);
  const isDragging = useRef(false);

  const onTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    isDragging.current = false;
  };

  const onTouchMove = (e) => {
    if (startX.current === null) return;
    const dx = startX.current - e.touches[0].clientX;
    if (Math.abs(dx) > 6) isDragging.current = true;
    if (dx > 0) setOffsetX(Math.min(dx, fullDistance + 20));
    else if (offsetX > 0) setOffsetX(Math.max(0, offsetX + dx));
  };

  const onTouchEnd = () => {
    if (offsetX >= fullDistance) {
      setOffsetX(0);
      onFull?.();
    } else if (offsetX > peekDistance / 2) {
      setOffsetX(peekDistance);
    } else {
      setOffsetX(0);
    }
    startX.current = null;
  };

  const reset = () => setOffsetX(0);
  const wasDragging = () => isDragging.current;

  return {
    offsetX,
    peekProgress: Math.min(1, offsetX / fullDistance),
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
    reset,
    wasDragging,
  };
}