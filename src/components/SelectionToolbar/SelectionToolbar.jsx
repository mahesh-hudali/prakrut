import { HIGHLIGHT_COLORS } from "../../models/annotations";
import "./SelectionToolbar.css";

const TOOLBAR_WIDTH = 300;
const TOOLBAR_HEIGHT = 40;

/**
 * Floating toolbar shown while text is selected.
 * Every button uses onMouseDown+preventDefault so the DOM selection survives
 * the click and the action still knows what the user picked.
 */
export default function SelectionToolbar({
  selection,
  activeMarks = [],
  onToggleMark,
  onHighlight,
  onComment,
  onFreeze,
  onUnfreeze,
}) {
  if (!selection?.rect) return null;

  const { rect } = selection;
  const top = Math.max(8, rect.top - TOOLBAR_HEIGHT - 10);
  const left = Math.min(
    Math.max(8, rect.left + rect.width / 2 - TOOLBAR_WIDTH / 2),
    window.innerWidth - TOOLBAR_WIDTH - 8
  );

  const hold = (event) => {
    event.preventDefault();
    onFreeze?.();
  };

  return (
    <div
      className="selection-toolbar"
      style={{ top, left, width: TOOLBAR_WIDTH }}
      role="toolbar"
      aria-label="Text formatting"
      onMouseDown={hold}
    >
      {[
        ["bold", "B", "Bold"],
        ["italic", "I", "Italic"],
        ["underline", "U", "Underline"],
      ].map(([type, glyph, label]) => (
        <button
          key={type}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={activeMarks.includes(type)}
          className={`selection-btn mark-${type} ${
            activeMarks.includes(type) ? "is-active" : ""
          }`}
          onMouseDown={hold}
          onClick={() => {
            onToggleMark?.(type);
            onUnfreeze?.();
          }}
        >
          {glyph}
        </button>
      ))}

      <span className="selection-divider" aria-hidden="true" />

      <span className="selection-swatches">
        {Object.values(HIGHLIGHT_COLORS).map((color) => (
          <button
            key={color.id}
            type="button"
            title={`Highlight ${color.label}`}
            aria-label={`Highlight ${color.label}`}
            className="selection-swatch"
            style={{ background: color.css }}
            onMouseDown={hold}
            onClick={() => {
              onHighlight?.(color.id);
              onUnfreeze?.();
            }}
          />
        ))}
      </span>

      <span className="selection-divider" aria-hidden="true" />

      <button
        type="button"
        className="selection-btn selection-comment"
        title="Add comment"
        onMouseDown={hold}
        onClick={() => onComment?.()}
      >
        💬 Comment
      </button>
    </div>
  );
}
