import { useEffect, useRef, useState } from "react";

const CHROME_IDLE_MS = 1800;
const TYPING_QUIET_MS = 700;
/** Where the caret line rests, as a fraction of the visible writing area. */
const TYPEWRITER_LINE = 0.42;
const TYPEWRITER_SLACK_PX = 24;

function caretRectInPage() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const node = selection.focusNode;
  const element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  if (!element?.closest?.(".page-content")) return null;

  const range = selection.getRangeAt(0).cloneRange();
  range.collapse(false);
  let rect = range.getBoundingClientRect();
  // An empty paragraph has no text box; use the paragraph itself.
  if (!rect.height) rect = element.closest("[data-block-id]")?.getBoundingClientRect();
  return rect?.height ? rect : null;
}

/**
 * Focus mode behaviour, kept out of BookEditor:
 *  - chrome (toolbar, status bar) hides while the author types and comes back
 *    when the mouse moves; hovering or tabbing into the toolbar keeps it
 *  - typewriter scrolling keeps the line being written at a steady height
 *
 * Returns whether the chrome should currently be shown.
 */
export function useFocusMode({ enabled, stageRef }) {
  const [pointerActive, setPointerActive] = useState(false);
  const lastTypedAtRef = useRef(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let timer = null;

    const onMouseMove = (event) => {
      if (!event.movementX && !event.movementY) return;
      // Ignore trackpad jitter while the author is mid-sentence.
      if (Date.now() - lastTypedAtRef.current < TYPING_QUIET_MS) return;
      setPointerActive(true);
      clearTimeout(timer);
      timer = setTimeout(() => setPointerActive(false), CHROME_IDLE_MS);
    };

    const onKeyDown = (event) => {
      if (!event.target?.closest?.(".page-content")) return;
      lastTypedAtRef.current = Date.now();
      clearTimeout(timer);
      setPointerActive(false);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;

    const centerCaret = () => {
      const stage = stageRef.current;
      const rect = caretRectInPage();
      if (!stage || !rect) return;
      const stageRect = stage.getBoundingClientRect();
      const target = stageRect.top + stage.clientHeight * TYPEWRITER_LINE;
      const delta = rect.top - target;
      if (Math.abs(delta) > TYPEWRITER_SLACK_PX) {
        stage.scrollBy({ top: delta, behavior: "smooth" });
      }
    };

    // Only keyboard movement scrolls; a click is the author choosing a spot.
    const onInput = () => requestAnimationFrame(centerCaret);
    const onKeyUp = (event) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Enter", "Backspace"].includes(event.key)) {
        requestAnimationFrame(centerCaret);
      }
    };

    document.addEventListener("input", onInput, true);
    document.addEventListener("keyup", onKeyUp, true);
    requestAnimationFrame(centerCaret);
    return () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("keyup", onKeyUp, true);
    };
  }, [enabled, stageRef]);

  return { chromeVisible: !enabled || pointerActive };
}
