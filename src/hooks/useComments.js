import { useCallback, useMemo } from "react";
import {
  DEFAULT_COMMENT_COLOR,
  createComment,
  createHighlight,
} from "../models/annotations.js";

/**
 * Comment + highlight operations on the canonical document model.
 * An unresolved comment always owns a neon highlight; resolving removes it.
 */
export function useComments(doc, setDoc) {
  const comments = doc.comments ?? [];
  const highlights = doc.highlights ?? [];

  const unresolvedHighlights = useMemo(
    () => highlights.filter((highlight) => !highlight.resolved),
    [highlights]
  );

  const addComment = useCallback(
    ({ chapterId, paragraphId, start, end, selectedText, text, color }) => {
      const comment = createComment({
        chapterId,
        paragraphId,
        start,
        end,
        selectedText,
        text,
        color: color ?? DEFAULT_COMMENT_COLOR,
      });

      const highlight = createHighlight({
        chapterId,
        paragraphId,
        start,
        end,
        color: comment.color,
        commentId: comment.id,
      });

      setDoc((prev) => ({
        ...prev,
        comments: [...(prev.comments ?? []), comment],
        highlights: [...(prev.highlights ?? []), highlight],
      }));

      return comment;
    },
    [setDoc]
  );

  const updateComment = useCallback(
    (commentId, text) => {
      setDoc((prev) => ({
        ...prev,
        comments: (prev.comments ?? []).map((comment) =>
          comment.id === commentId
            ? { ...comment, text, updatedAt: new Date().toISOString() }
            : comment
        ),
      }));
    },
    [setDoc]
  );

  /** Resolving keeps the note but drops its neon highlight. */
  const resolveComment = useCallback(
    (commentId, resolved = true) => {
      setDoc((prev) => ({
        ...prev,
        comments: (prev.comments ?? []).map((comment) =>
          comment.id === commentId
            ? { ...comment, resolved, updatedAt: new Date().toISOString() }
            : comment
        ),
        highlights: (prev.highlights ?? []).map((highlight) =>
          highlight.commentId === commentId
            ? { ...highlight, resolved }
            : highlight
        ),
      }));
    },
    [setDoc]
  );

  const deleteComment = useCallback(
    (commentId) => {
      setDoc((prev) => ({
        ...prev,
        comments: (prev.comments ?? []).filter(
          (comment) => comment.id !== commentId
        ),
        highlights: (prev.highlights ?? []).filter(
          (highlight) => highlight.commentId !== commentId
        ),
      }));
    },
    [setDoc]
  );

  const addHighlight = useCallback(
    ({ chapterId, paragraphId, start, end, color }) => {
      const highlight = createHighlight({
        chapterId,
        paragraphId,
        start,
        end,
        color,
      });
      setDoc((prev) => ({
        ...prev,
        highlights: [...(prev.highlights ?? []), highlight],
      }));
      return highlight;
    },
    [setDoc]
  );

  const stats = useMemo(() => {
    const total = comments.length;
    const resolved = comments.filter((comment) => comment.resolved).length;
    return { total, resolved, unresolved: total - resolved };
  }, [comments]);

  return {
    comments,
    highlights,
    unresolvedHighlights,
    stats,
    addComment,
    updateComment,
    resolveComment,
    deleteComment,
    addHighlight,
  };
}
