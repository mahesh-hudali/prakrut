import { useCallback, useEffect, useRef, useState } from "react";
import {
  HISTORY_LIMIT,
  describeChange,
  findCaretForTransition,
  mergeChanges,
  shouldCoalesce,
} from "../models/history.js";

/**
 * Snapshot-based undo/redo for the document.
 *
 * Every committed document change is observed here, so all edit paths
 * (typing, paragraph splits, comments, settings, replace-all…) become
 * undoable without each one opting in. Because the document is immutable, a
 * history entry is just the previous document object.
 *
 * Typing bursts in one paragraph are grouped (see shouldCoalesce). Callers can
 * force a boundary with `checkpoint()`, e.g. around a transliteration accept.
 */
export function useUndoHistory(doc, setDoc) {
  const pastRef = useRef([]);
  const futureRef = useRef([]);
  // The document the history last saw. Undo/redo/reset update it before
  // calling setDoc, so the observer below recognises their result and skips it.
  const currentRef = useRef(doc);
  const lastChangeRef = useRef({ change: null, time: 0 });
  const forceBoundaryRef = useRef(false);
  const [state, setState] = useState({ canUndo: false, canRedo: false, revision: 0 });

  const publish = useCallback((bumpRevision = false) => {
    const canUndo = pastRef.current.length > 0;
    const canRedo = futureRef.current.length > 0;
    setState((prev) =>
      prev.canUndo === canUndo && prev.canRedo === canRedo && !bumpRevision
        ? prev
        : {
            canUndo,
            canRedo,
            revision: bumpRevision ? prev.revision + 1 : prev.revision,
          }
    );
  }, []);

  useEffect(() => {
    const previous = currentRef.current;
    if (previous === doc) return;
    currentRef.current = doc;

    const change = describeChange(previous, doc);
    const now = Date.now();
    const last = lastChangeRef.current;
    const coalesce =
      !forceBoundaryRef.current &&
      pastRef.current.length > 0 &&
      shouldCoalesce(last.change, change, now - last.time);

    if (!coalesce) {
      pastRef.current.push(previous);
      if (pastRef.current.length > HISTORY_LIMIT) pastRef.current.shift();
    }
    futureRef.current = [];
    lastChangeRef.current = {
      change: coalesce ? mergeChanges(last.change, change) : change,
      time: now,
    };
    forceBoundaryRef.current = false;
    publish();
  }, [doc, publish]);

  const jump = useCallback(
    (fromStack, toStack) => {
      if (fromStack.current.length === 0) return null;
      const from = currentRef.current;
      const target = fromStack.current.pop();
      toStack.current.push(from);
      currentRef.current = target;
      lastChangeRef.current = { change: null, time: 0 };
      setDoc(target);
      publish(true);
      return { caret: findCaretForTransition(from, target) };
    },
    [publish, setDoc]
  );

  /** Returns { caret } (caret may be null), or null when there is nothing to undo. */
  const undo = useCallback(() => jump(pastRef, futureRef), [jump]);
  const redo = useCallback(() => jump(futureRef, pastRef), [jump]);

  /** The next change starts a new undo step. */
  const checkpoint = useCallback(() => {
    forceBoundaryRef.current = true;
  }, []);

  /** Replace the document and forget all history (open / new / recover). */
  const resetDocument = useCallback(
    (nextDoc) => {
      pastRef.current = [];
      futureRef.current = [];
      currentRef.current = nextDoc;
      lastChangeRef.current = { change: null, time: 0 };
      setDoc(nextDoc);
      publish(true);
    },
    [publish, setDoc]
  );

  return {
    canUndo: state.canUndo,
    canRedo: state.canRedo,
    // Bumps whenever the document jumps (undo/redo/reset) so pagination can
    // reflow straight away instead of waiting for the typing debounce.
    historyRevision: state.revision,
    undo,
    redo,
    checkpoint,
    resetDocument,
  };
}
