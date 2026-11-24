import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  Panel,
  PanelBody,
  PanelHeader,
  TextArea,
} from "../../design-system";
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
  const stop = (handler) => (event) => {
    event.stopPropagation();
    handler();
  };

  return (
    <Panel open={open} side="right" label="Comments">
      <PanelHeader title="Comments" onClose={onClose} closeLabel="Close comments">
        {unresolvedCount > 0 ? <Badge tone="accent">{unresolvedCount}</Badge> : null}
      </PanelHeader>

      <div className="comments-filter">
        <Checkbox label="Show resolved" checked={showResolved} onChange={setShowResolved} />
      </div>

      <PanelBody className="comments-list">
        {visible.length === 0 ? (
          <EmptyState title={showResolved ? "No comments yet" : "No open comments"}>
            Select text on the page and choose Comment to leave a note for
            yourself or an editor.
          </EmptyState>
        ) : null}

        {visible.map((comment) => (
          <article
            key={comment.id}
            className={`comment-card ${focusedCommentId === comment.id ? "is-focused" : ""} ${
              comment.resolved ? "is-resolved" : ""
            }`}
            onClick={() => onFocusComment?.(comment)}
          >
            <header className="comment-card__meta">
              <span>{chapterTitles.get(comment.chapterId) ?? ""}</span>
              <time>{formatTime(comment.updatedAt)}</time>
            </header>

            <blockquote className="comment-card__quote">{comment.selectedText || "—"}</blockquote>

            {editingId === comment.id ? (
              <div className="comment-card__edit" onClick={(event) => event.stopPropagation()}>
                <TextArea
                  value={draftText}
                  aria-label="Edit comment"
                  onChange={(event) => setDraftText(event.target.value)}
                />
                <div className="comment-card__actions">
                  <Button size="sm" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      onUpdate?.(comment.id, draftText.trim());
                      setEditingId(null);
                    }}
                  >
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <p className="comment-card__text">{comment.text}</p>
            )}

            {editingId !== comment.id ? (
              <footer className="comment-card__actions">
                {comment.resolved ? <span className="comment-card__status">Resolved</span> : null}
                <Button
                  size="sm"
                  onClick={stop(() => {
                    setEditingId(comment.id);
                    setDraftText(comment.text);
                  })}
                >
                  Edit
                </Button>
                <Button size="sm" onClick={stop(() => onResolve?.(comment.id, !comment.resolved))}>
                  {comment.resolved ? "Reopen" : "Resolve"}
                </Button>
                <Button size="sm" variant="danger" onClick={stop(() => onDelete?.(comment.id))}>
                  Delete
                </Button>
              </footer>
            ) : null}
          </article>
        ))}
      </PanelBody>
    </Panel>
  );
}
