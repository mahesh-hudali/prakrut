import { useEffect, useRef, useState } from "react";
import "./CommentComposer.css";

const WIDTH = 300;

/** Floating "Add comment" editor anchored to the selection. */
export default function CommentComposer({ draft, onCancel, onSubmit }) {
  const [text, setText] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    setText("");
    const id = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [draft?.paragraphId, draft?.start, draft?.end]);

  if (!draft) return null;

  const top = Math.min(
    window.innerHeight - 190,
    Math.max(8, (draft.rect?.bottom ?? 120) + 10)
  );
  const left = Math.min(
    Math.max(8, (draft.rect?.left ?? 80) - 20),
    window.innerWidth - WIDTH - 8
  );

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit?.(trimmed);
  };

  return (
    <div
      className="comment-composer"
      style={{ top, left, width: WIDTH }}
      role="dialog"
      aria-label="Add comment"
      onMouseDown={(event) => event.preventDefault()}
    >
      <div className="comment-composer-title">Add comment</div>

      <blockquote className="comment-composer-quote">
        {draft.text?.slice(0, 160) || "—"}
      </blockquote>

      <textarea
        ref={textareaRef}
        className="comment-composer-input"
        value={text}
        placeholder="Check this description…"
        rows={3}
        onChange={(event) => setText(event.target.value)}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel?.();
          }
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            submit();
          }
        }}
      />

      <div className="comment-composer-actions">
        <button type="button" className="ghost-btn" onClick={() => onCancel?.()}>
          Cancel
        </button>
        <button
          type="button"
          className="primary-btn"
          disabled={!text.trim()}
          onClick={submit}
        >
          Add
        </button>
      </div>
    </div>
  );
}
