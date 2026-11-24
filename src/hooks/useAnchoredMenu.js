import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Dropdown state for a toolbar button.
 *
 * The toolbar is a horizontal scroll container, which clips absolutely
 * positioned children — so menus are placed with `position: fixed` against the
 * trigger's viewport rect instead, and reposition on scroll/resize.
 */
export function useAnchoredMenu({ align = "left" } = {}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const reposition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      top: rect.bottom + 6,
      left: align === "right" ? undefined : rect.left,
      right: align === "right" ? window.innerWidth - rect.right : undefined,
    });
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
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
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
    menuStyle: position ?? { top: -9999, left: -9999 },
  };
}
