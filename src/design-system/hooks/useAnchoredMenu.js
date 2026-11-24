import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const EDGE = 8;

/**
 * Open/close state and placement for a menu attached to a trigger button.
 *
 * Menus use `position: fixed` against the trigger's viewport rect, so a
 * scrolling or clipped parent (toolbar, panel) never cuts them off. They flip
 * above the trigger when there is no room below and stay inside the viewport.
 */
export function useAnchoredMenu({ align = "left" } = {}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const reposition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menu = menuRef.current;
    const width = menu?.offsetWidth ?? 0;
    const height = menu?.offsetHeight ?? 0;

    let left = align === "right" ? rect.right - width : rect.left;
    left = Math.max(EDGE, Math.min(left, window.innerWidth - width - EDGE));

    let top = rect.bottom + 6;
    if (top + height > window.innerHeight - EDGE && rect.top - height - 6 > EDGE) {
      top = rect.top - height - 6;
    }
    setPosition({ top, left });
  }, [align]);

  useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (
        triggerRef.current?.contains(event.target) ||
        menuRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
    };

    // Escape closes the menu even before focus has moved into it (e.g. it was
    // opened with the mouse and Escape pressed straight away).
    const onKeyDown = (event) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, reposition]);

  return {
    open,
    setOpen,
    toggle: () => setOpen((value) => !value),
    triggerRef,
    menuRef,
    // Rendered invisibly first so it can be measured, then placed.
    menuStyle: open && position ? position : { top: 0, left: 0, visibility: "hidden" },
  };
}
