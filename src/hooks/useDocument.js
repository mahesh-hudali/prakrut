import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  countDocumentStats,
  createChapter,
  createDocument,
  createParagraph,
  getParagraphText,
  setParagraphText,
} from "../models/documentModel.js";
import { remapAnnotationsForParagraph } from "../models/annotations.js";
import { normalizeRuns, toggleMarkOnRuns } from "../models/runs.js";
import { paginateDocument } from "../utils/pagination.js";
import { useUndoHistory } from "./useUndoHistory.js";

/**
 * Debounced measure-based pagination.
 * Recalculates when content or layout-affecting settings change —
 * not on unrelated UI chrome updates.
 */
export function usePagination(doc, { immediateToken = 0 } = {}) {
  const [pages, setPages] = useState([]);
  const [isPaginating, setIsPaginating] = useState(false);
  const timerRef = useRef(null);
  const latestDocRef = useRef(doc);
  const structureRef = useRef("");
  const immediateTokenRef = useRef(immediateToken);

  latestDocRef.current = doc;

  // Paragraph identity only. Splitting, merging or deleting a paragraph has to
  // reflow immediately or the caret would sit in a paragraph that is not on
  // screen yet; plain typing can wait for the debounce.
  const structureKey = useMemo(
    () =>
      doc.chapters
        .map((ch) => `${ch.id}:${ch.blocks.map((b) => b.id).join(",")}`)
        .join("|"),
    [doc.chapters]
  );

  // Layout fingerprint: only settings that affect page geometry / type.
  const layoutKey = useMemo(() => {
    const s = doc.settings;
    return JSON.stringify({
      pageWidth: s.pageWidth,
      pageHeight: s.pageHeight,
      margins: s.margins,
      typography: s.typography,
      chapters: doc.chapters.map((ch) => ({
        id: ch.id,
        blocks: ch.blocks.map((b) => ({
          id: b.id,
          style: b.style,
          align: b.align,
          text: getParagraphText(b),
        })),
      })),
    });
  }, [doc]);

  useEffect(() => {
    setIsPaginating(true);
    if (timerRef.current) clearTimeout(timerRef.current);

    const run = () => {
      const nextPages = paginateDocument(latestDocRef.current);
      setPages(nextPages);
      setIsPaginating(false);
    };

    // Structural edits and undo/redo jumps reflow at once; typing debounces.
    const structural =
      structureRef.current !== structureKey ||
      immediateTokenRef.current !== immediateToken;
    structureRef.current = structureKey;
    immediateTokenRef.current = immediateToken;

    // Debounce to avoid a full remeasure on every keystroke.
    timerRef.current = setTimeout(() => {
      // Wait for Kannada webfonts so measured heights match on-screen pages.
      if (document.fonts?.ready) {
        document.fonts.ready.then(run).catch(run);
      } else {
        run();
      }
    }, structural ? 0 : 120);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [layoutKey, structureKey, immediateToken]);

  return { pages, isPaginating, pageCount: Math.max(pages.length, 1) };
}

/** Apply a text change to one block and keep comments/highlights aligned. */
function applyBlockTextChange(prev, chapterId, blockId, nextText) {
  let previousText = null;

  const chapters = prev.chapters.map((chapter) => {
    if (chapter.id !== chapterId) return chapter;
    return {
      ...chapter,
      blocks: chapter.blocks.map((block) => {
        if (block.id !== blockId) return block;
        previousText = getParagraphText(block);
        return setParagraphText(block, nextText);
      }),
    };
  });

  if (previousText === null || previousText === nextText) {
    return previousText === null ? prev : { ...prev, chapters };
  }

  const remappedComments = remapAnnotationsForParagraph(
    prev.comments ?? [],
    blockId,
    previousText,
    nextText
  );
  const remappedHighlights = remapAnnotationsForParagraph(
    prev.highlights ?? [],
    blockId,
    previousText,
    nextText
  );

  // Annotations whose text the author deleted outright go with it; everything
  // else is shifted so it still points at the same words.
  return {
    ...prev,
    chapters,
    comments: remappedComments.annotations,
    highlights: remappedHighlights.annotations,
  };
}

/** Re-point annotations onto the paragraph they were merged into. */
function rebaseAnnotations(annotations, fromId, toId, shift) {
  return (annotations ?? []).map((annotation) =>
    annotation.paragraphId === fromId
      ? {
          ...annotation,
          paragraphId: toId,
          start: annotation.start + shift,
          end: annotation.end + shift,
        }
      : annotation
  );
}

/**
 * Remove paragraphs the author deleted outright, keeping at least one block
 * per chapter so there is always somewhere to type.
 */
function dropEmptyBlocks(doc, candidateIds) {
  const ids = new Set(candidateIds);

  const chapters = doc.chapters.map((chapter) => {
    const blocks = chapter.blocks.filter(
      (block) => !ids.has(block.id) || getParagraphText(block).length > 0
    );
    return blocks.length > 0
      ? { ...chapter, blocks }
      : { ...chapter, blocks: [createParagraph({ style: "normal" })] };
  });

  const survivingIds = new Set(
    chapters.flatMap((chapter) => chapter.blocks.map((block) => block.id))
  );

  return {
    ...doc,
    chapters,
    comments: (doc.comments ?? []).filter((c) =>
      survivingIds.has(c.paragraphId)
    ),
    highlights: (doc.highlights ?? []).filter((h) =>
      survivingIds.has(h.paragraphId)
    ),
  };
}

/**
 * Move annotations across a paragraph split so nothing points into a range
 * that no longer exists.
 */
function splitAnnotations(annotations, sourceId, targetId, offset, tailLength) {
  return (annotations ?? []).map((annotation) => {
    if (annotation.paragraphId !== sourceId) return annotation;

    if (annotation.end <= offset) return annotation;

    if (annotation.start >= offset) {
      return {
        ...annotation,
        paragraphId: targetId,
        start: annotation.start - offset,
        end: Math.min(annotation.end - offset, tailLength),
      };
    }

    // Straddles the split: keep the part that stays in the first paragraph.
    return { ...annotation, end: offset };
  });
}

export function useDocument(initialDoc = null) {
  const [doc, setDoc] = useState(() => initialDoc ?? createDocument());

  const stats = useMemo(() => countDocumentStats(doc), [doc]);
  const history = useUndoHistory(doc, setDoc);

  const updateSettings = useCallback((updater) => {
    setDoc((prev) => ({
      ...prev,
      settings:
        typeof updater === "function" ? updater(prev.settings) : updater,
    }));
  }, []);

  const updateMetadata = useCallback((partial) => {
    setDoc((prev) => ({
      ...prev,
      metadata: { ...prev.metadata, ...partial },
    }));
  }, []);

  const updateBlockText = useCallback((chapterId, blockId, text) => {
    setDoc((prev) => applyBlockTextChange(prev, chapterId, blockId, text));
  }, []);

  /**
   * Apply every paragraph change a single page edit produced, in one update.
   * The page surface is one contentEditable, so a keystroke can legitimately
   * touch several paragraphs (e.g. deleting a multi-paragraph selection).
   */
  const applyPageEdits = useCallback((edits, removedBlockIds = []) => {
    setDoc((prev) => {
      let next = prev;
      for (const edit of edits) {
        next = applyBlockTextChange(next, edit.chapterId, edit.blockId, edit.text);
      }
      if (removedBlockIds.length > 0) {
        next = dropEmptyBlocks(next, removedBlockIds);
      }
      return next;
    });
  }, []);

  /** Backspace at the start of a paragraph joins it onto the previous one. */
  const mergeWithPrevious = useCallback((chapterId, blockId, onMerged) => {
    setDoc((prev) => {
      const chapter = prev.chapters.find((c) => c.id === chapterId);
      const index = chapter?.blocks.findIndex((b) => b.id === blockId) ?? -1;
      if (!chapter || index <= 0) return prev;

      const previous = chapter.blocks[index - 1];
      const current = chapter.blocks[index];
      const previousText = getParagraphText(previous);

      const merged = {
        ...previous,
        runs: normalizeRuns([...(previous.runs ?? []), ...(current.runs ?? [])]),
      };

      const blocks = [...chapter.blocks];
      blocks.splice(index - 1, 2, merged);
      onMerged?.({ blockId: previous.id, offset: previousText.length });

      return {
        ...prev,
        chapters: prev.chapters.map((c) =>
          c.id === chapterId ? { ...c, blocks } : c
        ),
        comments: rebaseAnnotations(
          prev.comments,
          current.id,
          previous.id,
          previousText.length
        ),
        highlights: rebaseAnnotations(
          prev.highlights,
          current.id,
          previous.id,
          previousText.length
        ),
      };
    });
  }, []);

  /** Delete at the end of a paragraph pulls the next one up into it. */
  const mergeWithNext = useCallback((chapterId, blockId, onMerged) => {
    setDoc((prev) => {
      const chapter = prev.chapters.find((c) => c.id === chapterId);
      const index = chapter?.blocks.findIndex((b) => b.id === blockId) ?? -1;
      if (!chapter || index < 0 || index >= chapter.blocks.length - 1) return prev;

      const current = chapter.blocks[index];
      const next = chapter.blocks[index + 1];
      const currentText = getParagraphText(current);

      const merged = {
        ...current,
        runs: normalizeRuns([...(current.runs ?? []), ...(next.runs ?? [])]),
      };

      const blocks = [...chapter.blocks];
      blocks.splice(index, 2, merged);
      onMerged?.({ blockId: current.id, offset: currentText.length });

      return {
        ...prev,
        chapters: prev.chapters.map((c) =>
          c.id === chapterId ? { ...c, blocks } : c
        ),
        comments: rebaseAnnotations(
          prev.comments,
          next.id,
          current.id,
          currentText.length
        ),
        highlights: rebaseAnnotations(
          prev.highlights,
          next.id,
          current.id,
          currentText.length
        ),
      };
    });
  }, []);

  const updateBlockStyle = useCallback((chapterId, blockId, style) => {
    setDoc((prev) => ({
      ...prev,
      chapters: prev.chapters.map((ch) => {
        if (ch.id !== chapterId) return ch;
        return {
          ...ch,
          blocks: ch.blocks.map((block) =>
            block.id === blockId ? { ...block, style } : block
          ),
        };
      }),
    }));
  }, []);

  const updateBlockAlign = useCallback((chapterId, blockId, align) => {
    setDoc((prev) => ({
      ...prev,
      chapters: prev.chapters.map((ch) => {
        if (ch.id !== chapterId) return ch;
        return {
          ...ch,
          blocks: ch.blocks.map((block) =>
            block.id === blockId ? { ...block, align } : block
          ),
        };
      }),
    }));
  }, []);

  /** Toggle bold/italic/underline over a paragraph range. */
  const toggleBlockMark = useCallback((chapterId, blockId, start, end, markType) => {
    setDoc((prev) => ({
      ...prev,
      chapters: prev.chapters.map((ch) => {
        if (ch.id !== chapterId) return ch;
        return {
          ...ch,
          blocks: ch.blocks.map((block) =>
            block.id === blockId
              ? { ...block, runs: toggleMarkOnRuns(block.runs, start, end, markType) }
              : block
          ),
        };
      }),
    }));
  }, []);

  const splitBlockAt = useCallback((chapterId, blockId, offset, onCreated) => {
    setDoc((prev) => {
      const chapter = prev.chapters.find((c) => c.id === chapterId);
      const index = chapter?.blocks.findIndex((b) => b.id === blockId) ?? -1;
      if (!chapter || index < 0) return prev;

      const source = chapter.blocks[index];
      const full = getParagraphText(source);
      const before = full.slice(0, offset);
      const after = full.slice(offset);

      // Pressing Enter after a character cue naturally continues into dialogue.
      const nextStyle =
        source.style === "chapterTitle"
          ? "normal"
          : source.style === "character"
            ? "dialogue"
            : source.style;

      const current = setParagraphText(source, before);
      const created = createParagraph({ text: after, style: nextStyle });

      const blocks = [...chapter.blocks];
      blocks.splice(index, 1, current, created);
      onCreated?.(created);

      return {
        ...prev,
        chapters: prev.chapters.map((c) =>
          c.id === chapterId ? { ...c, blocks } : c
        ),
        comments: splitAnnotations(
          prev.comments,
          blockId,
          created.id,
          offset,
          after.length
        ),
        highlights: splitAnnotations(
          prev.highlights,
          blockId,
          created.id,
          offset,
          after.length
        ),
      };
    });
  }, []);

  const addChapter = useCallback((title) => {
    let created = null;
    setDoc((prev) => {
      const chapter = createChapter({
        title: title || `ಅಧ್ಯಾಯ ${prev.chapters.length + 1}`,
      });
      created = chapter;
      return { ...prev, chapters: [...prev.chapters, chapter] };
    });
    return created;
  }, []);

  const renameChapter = useCallback((chapterId, title) => {
    setDoc((prev) => ({
      ...prev,
      chapters: prev.chapters.map((chapter) => {
        if (chapter.id !== chapterId) return chapter;
        // Keep the on-page chapter title block in sync without touching content.
        const blocks = chapter.blocks.map((block, index) =>
          index === 0 && block.style === "chapterTitle"
            ? setParagraphText(block, title)
            : block
        );
        return { ...chapter, title, blocks };
      }),
    }));
  }, []);

  const deleteChapter = useCallback((chapterId) => {
    setDoc((prev) => {
      if (prev.chapters.length <= 1) return prev;
      return {
        ...prev,
        chapters: prev.chapters.filter((chapter) => chapter.id !== chapterId),
        comments: (prev.comments ?? []).filter((c) => c.chapterId !== chapterId),
        highlights: (prev.highlights ?? []).filter(
          (h) => h.chapterId !== chapterId
        ),
      };
    });
  }, []);

  const moveChapter = useCallback((chapterId, direction) => {
    setDoc((prev) => {
      const index = prev.chapters.findIndex((c) => c.id === chapterId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.chapters.length) return prev;
      const chapters = [...prev.chapters];
      const [moved] = chapters.splice(index, 1);
      chapters.splice(target, 0, moved);
      return { ...prev, chapters };
    });
  }, []);

  return {
    doc,
    setDoc,
    stats,
    history,
    updateSettings,
    updateMetadata,
    updateBlockText,
    applyPageEdits,
    updateBlockStyle,
    updateBlockAlign,
    toggleBlockMark,
    splitBlockAt,
    mergeWithPrevious,
    mergeWithNext,
    addChapter,
    renameChapter,
    deleteChapter,
    moveChapter,
  };
}
