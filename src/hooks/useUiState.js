import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "kannada-book-editor:ui";

export const DEFAULT_UI_STATE = Object.freeze({
  leftPanelOpen: false,
  commentsPanelOpen: false,
  focusMode: false,
  zoom: 1,
  activeChapterId: null,
  previewMode: false,
});

function readStoredState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * View-only editor state. Kept separate from the document model, but
 * serialized into `.kbook` so reopening a project restores the workspace.
 */
export function useUiState() {
  const [ui, setUi] = useState(() => ({
    ...DEFAULT_UI_STATE,
    ...readStoredState(),
    // Panels never restore mid-transition state.
    focusMode: false,
  }));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ui));
    } catch {
      // Storage can be unavailable (private mode); UI state is not critical.
    }
  }, [ui]);

  const patchUi = useCallback((partial) => {
    setUi((prev) => ({
      ...prev,
      ...(typeof partial === "function" ? partial(prev) : partial),
    }));
  }, []);

  const toggleLeftPanel = useCallback(() => {
    setUi((prev) => ({ ...prev, leftPanelOpen: !prev.leftPanelOpen }));
  }, []);

  const toggleCommentsPanel = useCallback(() => {
    setUi((prev) => ({ ...prev, commentsPanelOpen: !prev.commentsPanelOpen }));
  }, []);

  /** Focus mode hides chrome and restores the previous layout when disabled. */
  const toggleFocusMode = useCallback(() => {
    setUi((prev) => {
      if (prev.focusMode) {
        const restored = prev.preFocus ?? {};
        return {
          ...prev,
          focusMode: false,
          leftPanelOpen: restored.leftPanelOpen ?? false,
          commentsPanelOpen: restored.commentsPanelOpen ?? false,
          preFocus: undefined,
        };
      }
      return {
        ...prev,
        focusMode: true,
        preFocus: {
          leftPanelOpen: prev.leftPanelOpen,
          commentsPanelOpen: prev.commentsPanelOpen,
        },
        leftPanelOpen: false,
        commentsPanelOpen: false,
      };
    });
  }, []);

  const setZoom = useCallback((zoom) => {
    setUi((prev) => ({ ...prev, zoom }));
  }, []);

  const restoreUiState = useCallback((incoming) => {
    if (!incoming || typeof incoming !== "object") return;
    setUi((prev) => ({ ...prev, ...incoming, focusMode: false }));
  }, []);

  /** Only the durable bits belong in the project file. */
  const serializableUi = useMemo(
    () => ({
      leftPanelOpen: ui.leftPanelOpen,
      commentsPanelOpen: ui.commentsPanelOpen,
      focusMode: ui.focusMode,
      zoom: ui.zoom,
      activeChapterId: ui.activeChapterId,
      previewMode: ui.previewMode,
    }),
    [ui]
  );

  return {
    ui,
    patchUi,
    toggleLeftPanel,
    toggleCommentsPanel,
    toggleFocusMode,
    setZoom,
    restoreUiState,
    serializableUi,
  };
}
