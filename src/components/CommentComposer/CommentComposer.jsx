import { useEffect, useRef, useState } from "react";
import { Button, Kbd, Surface, TextArea } from "../../design-system";
import "./CommentComposer.css";

const WIDTH = 320;

/** Floating "Add comment" editor anchored under the selection. */
export default function CommentComposer({ draft, onCancel, onSubmit }) {
  const [text, setText] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    setText("");
    const id = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [draft?.paragraphId, draft?.start, draft?.end]);

  if (!draft) return null;

  const top = Math.min(window.innerHeight - 220, Math.max(8, (draft.rect?.bottom ?? 120) + 10));
  const left = Math.min(
    Math.max(8, (draft.rect?.left ?? 80) - 20),
    window.innerWidth - WIDTH - 8
  );

  const submit = () => {
    const trimmed = text.trim();
    if (trimmed) onSubmit?.(trimmed);
  };

  return (
    <Surface
      className="comment-composer"
      style={{ top, left, width: Math.min(WIDTH, window.innerWidth - 16) }}
      role="dialog"
      aria-label="Add comment"
      onMouseDown={(event) => event.preventDefault()}
    >
      <blockquote className="comment-composer__quote">{draft.text?.slice(0, 160) || "—"}</blockquote>

      <TextArea
        ref={textareaRef}
        value={text}
        aria-label="Comment"
        placeholder="Write a note about this passage"
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

      <div className="comment-composer__actions">
        <span className="comment-composer__hint">
          <Kbd>⌘↵</Kbd> to add
        </span>
        <Button size="sm" onClick={() => onCancel?.()}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" disabled={!text.trim()} onClick={submit}>
          Add comment
        </Button>
      </div>
    </Surface>
  );
}
