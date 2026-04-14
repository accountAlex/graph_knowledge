import { useRef, useEffect } from "react";

/**
 * Attach touch listeners to an element.
 * Calls `onDismiss` when the user swipes down more than `threshold` px.
 */
export function useSwipeDown(
  ref: React.RefObject<HTMLElement | null>,
  onDismiss: () => void,
  threshold = 80,
) {
  const startY = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      startY.current = e.touches[0].clientY;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (startY.current === null) return;
      const delta = e.changedTouches[0].clientY - startY.current;
      if (delta > threshold) onDismiss();
      startY.current = null;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [ref, onDismiss, threshold]);
}
