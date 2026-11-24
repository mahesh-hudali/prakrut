import { useMemo, useState } from "react";
import "./CommentsPanel.css";

function formatTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function CommentsPanel({
  open,
  comments,
  chapters,
  focusedCommentId,
  onFocusComment,
  onResolve,
  onDelete,
  onUpdate,
  onClose,
}) {
  const [showResolved, setShowResolved] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draftText, setDraftText] = useState("");

  const chapterTitles = useMemo(() => {
    const map = new Map();
    for (const chapter of chapters ?? []) map.set(chapter.id, chapter.title);
    return map;
  }, [chapters]);

  const visible = useMemo(() => {
    const list = comments ?? [];
    return showResolved ? list : list.filter((comment) => !comment.resolved);
  }, [comments, showResolved]);

  const unresolvedCount = (comments ?? []).filter((c) => !c.resolved).length;

  return (
    <aside
      className={`comments-panel ${open ? "is-open" : ""}`}
      aria-label="Comments"
      aria-hidden={!open}
    >
      <header className="comments-panel-header">
        <h2>Comments</h2>
        <span className="comments-count">{unresolvedCount} open</span>
        <button
          type="button"
          className="panel-close"
          onClick={onClose}
          aria-label="Close comments panel"
        >
          ✕
        </button>
      </header>

      <label className="comments-filter">
        <input
          type="checkbox"
          checked={showResolved}
          onChange={(event) => setShowResolved(event.target.checked)}
        />
        Show resolved
      </label>

      <div className="comments-list">
        {visible.length === 0 && (
          <p className="comments-empty">
            Select text on a page and choose <strong>💬 Comment</strong> to add a
            note. Unresolved comments stay neon-highlighted in the manuscript.
          </p>
        )}

        {visible.map((comment, index) => (
          <article
            key={comment.id}
            className={`comment-card ${
              focusedCommentId === comment.id ? "is-focused" : ""
            } ${comment.resolved ? "is-resolved" : ""}`}
            onClick={() => onFocusComment?.(comment)}
          >
            <header className="comment-card-header">
              <span className="comment-index">Comment #{index + 1}</span>
              <span className="comment-chapter">
                {chapterTitles.get(comment.chapterId) ?? ""}
              </span>
            </header>

            <blockquote className="comment-selected">
              {comment.selectedText || "—"}
            </blockquote>

            {editingId === comment.id ? (
              <div className="comment-edit">
                <textarea
                  value={draftText}
                  rows={3}
                  onChange={(event) => setDraftText(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                />
                <div className="comment-actions">
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      setEditingId(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      onUpdate?.(comment.id, draftText.trim());
                      setEditingId(null);
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <p className="comment-text">{comment.text}</p>
            )}

            <footer className="comment-card-footer">
              <span className={`comment-status ${comment.resolved ? "resolved" : ""}`}>
                {comment.resolved ? "Resolved" : "Unresolved"}
              </span>
              <time className="comment-time">{formatTime(comment.updatedAt)}</time>
            </footer>

            <div className="comment-actions">
              <button
                type="button"
                className="ghost-btn"
                onClick={(event) => {
                  event.stopPropagation();
                  setEditingId(comment.id);
                  setDraftText(comment.text);
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={(event) => {
                  event.stopPropagation();
                  onResolve?.(comment.id, !comment.resolved);
                }}
              >
                {comment.resolved ? "Reopen" : "Resolve"}
              </button>
              <button
                type="button"
                className="ghost-btn danger"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete?.(comment.id);
                }}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}
