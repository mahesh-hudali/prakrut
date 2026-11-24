import { useEffect, useLayoutEffect, useRef } from "react";

/** Form fields and other editable widgets keep their own native undo. */
function ownsNativeUndo(target) {
  if (!(target instanceof Element)) return false;
  if (target.closest(".page-content")) return false;
  if (target.closest("input, textarea, select")) return true;
  return Boolean(target.closest("[contenteditable='true'], [contenteditable='']"));
}

/**
 * Route Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z and Ctrl+Y (plus the browser's own
 * Edit ▸ Undo, which arrives as a `historyUndo` beforeinput) to the document
 * history. The pages are rebuilt from the model on every keystroke, so the
 * browser's built-in undo stack does not describe the document and must never
 * run on the page surface.
 */
export function useHistoryShortcuts({ undo, redo }) {
  const actionsRef = useRef({ undo, redo });
  useLayoutEffect(() => {
    actionsRef.current = { undo, redo };
  });

  useEffect(() => {
    const onKeyDown = (event) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod || event.altKey || event.isComposing) return;
      if (ownsNativeUndo(event.target)) return;

      const key = event.key.toLowerCase();
      const isUndo = key === "z" && !event.shiftKey;
      const isRedo =
        (key === "z" && event.shiftKey) ||
        (key === "y" && event.ctrlKey && !event.metaKey);
      if (!isUndo && !isRedo) return;

      event.preventDefault();
      event.stopPropagation();
      if (isUndo) actionsRef.current.undo();
      else actionsRef.current.redo();
    };

    const onBeforeInput = (event) => {
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest(".page-content")) return;
      if (event.inputType === "historyUndo") {
        event.preventDefault();
        actionsRef.current.undo();
      } else if (event.inputType === "historyRedo") {
        event.preventDefault();
        actionsRef.current.redo();
      }
    };

    // Capture phase, so this runs before the page's own key handling.
    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("beforeinput", onBeforeInput, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("beforeinput", onBeforeInput, true);
    };
  }, []);
}
