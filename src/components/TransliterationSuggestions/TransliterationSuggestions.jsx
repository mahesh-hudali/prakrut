import { Kbd, Surface } from "../../design-system";
import "./TransliterationSuggestions.css";

/** Kannada candidates for the Roman word at the caret. */
export default function TransliterationSuggestions({
  open,
  suggestions,
  selectedIndex,
  onSelect,
  onHover,
  anchorRect,
  word,
}) {
  if (!open || !suggestions?.length) return null;

  const style = anchorRect
    ? {
        top: Math.min(window.innerHeight - 260, Math.max(8, anchorRect.bottom + 6)),
        left: Math.min(window.innerWidth - 248, Math.max(8, anchorRect.left)),
      }
    : { top: 120, left: 120 };

  return (
    <Surface className="xlit" style={style}>
      <p className="xlit__word" lang="en">
        {word || "—"}
      </p>
      <ul className="xlit__list" role="listbox" aria-label="Kannada transliteration suggestions">
        {suggestions.map((item, index) => (
          <li key={`${item}-${index}`}>
            <button
              type="button"
              role="option"
              aria-selected={index === selectedIndex}
              className="xlit-suggestion"
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect?.(item);
              }}
              onMouseEnter={() => onHover?.(index)}
            >
              <span className="xlit-kn" lang="kn">
                {item}
              </span>
              <span className="xlit__index">{index + 1}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="xlit__help">
        <Kbd>↵</Kbd> accept <Kbd>Space</Kbd> accept and continue <Kbd>Esc</Kbd> dismiss
      </p>
    </Surface>
  );
}
