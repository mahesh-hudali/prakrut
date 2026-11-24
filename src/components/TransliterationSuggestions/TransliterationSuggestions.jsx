import "./TransliterationSuggestions.css";

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
        top: Math.min(
          window.innerHeight - 220,
          Math.max(8, anchorRect.bottom + 6)
        ),
        left: Math.min(
          window.innerWidth - 280,
          Math.max(8, anchorRect.left)
        ),
      }
    : { top: 120, left: 120 };

  return (
    <ul
      className="xlit-suggestions"
      style={style}
      role="listbox"
      aria-label="Kannada transliteration suggestions"
    >
      <li className="xlit-word-hint">Roman: {word || "—"}</li>
      {suggestions.map((item, index) => (
        <li key={`${item}-${index}`}>
          <button
            type="button"
            role="option"
            aria-selected={index === selectedIndex}
            className={
              index === selectedIndex
                ? "xlit-suggestion is-active"
                : "xlit-suggestion"
            }
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect?.(item);
            }}
            onMouseEnter={() => onHover?.(index)}
          >
            <span className="xlit-kn">{item}</span>
            <span className="xlit-idx">{index + 1}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
