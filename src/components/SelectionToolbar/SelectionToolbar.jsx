import { Button, Surface } from "../../design-system";
import { HIGHLIGHT_COLORS } from "../../models/annotations";
import "./SelectionToolbar.css";

const TOOLBAR_WIDTH = 304;
const TOOLBAR_HEIGHT = 40;

const MARKS = [
  ["bold", "B", "Bold"],
  ["italic", "I", "Italic"],
  ["underline", "U", "Underline"],
];

/**
 * Floating toolbar over selected text. Every control prevents mousedown so
 * the DOM selection survives the click and the action knows what was picked.
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
    <Surface
      tone="inverse"
      className="selection-toolbar"
      style={{ top, left, width: TOOLBAR_WIDTH }}
      role="toolbar"
      aria-label="Text formatting"
      onMouseDown={hold}
    >
      {MARKS.map(([type, glyph, label]) => (
        <Button
          key={type}
          size="sm"
          className={`selection-toolbar__mark mark-${type}`}
          aria-label={label}
          title={label}
          pressed={activeMarks.includes(type)}
          onMouseDown={hold}
          onClick={() => {
            onToggleMark?.(type);
            onUnfreeze?.();
          }}
        >
          {glyph}
        </Button>
      ))}

      <span className="selection-toolbar__divider" aria-hidden="true" />

      <span className="selection-toolbar__swatches" role="group" aria-label="Highlight">
        {Object.values(HIGHLIGHT_COLORS)
          .filter((color) => !color.retired)
          .map((color) => (
          <button
            key={color.id}
            type="button"
            title={`Highlight ${color.label.toLowerCase()}`}
            aria-label={`Highlight ${color.label.toLowerCase()}`}
            className="selection-toolbar__swatch"
            style={{ "--swatch": color.css }}
            onMouseDown={hold}
            onClick={() => {
              onHighlight?.(color.id);
              onUnfreeze?.();
            }}
          />
        ))}
      </span>

      <span className="selection-toolbar__divider" aria-hidden="true" />

      <Button size="sm" icon="commentAdd" onMouseDown={hold} onClick={() => onComment?.()}>
        Comment
      </Button>
    </Surface>
  );
}
