import { Icon } from "../icons/Icon.jsx";
import { preserveSelectionHandler } from "./preserveSelection.js";
import "./SegmentedControl.css";

/**
 * A row of mutually exclusive options (writing mode, alignment, theme).
 *
 * options: [{ value, label, icon?, shortcut? }]
 * iconOnly: show icons, keep labels as accessible names and tooltips
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  label,
  iconOnly = false,
  size = "md",
  preserveSelection = false,
  className = "",
}) {
  return (
    <div
      className={`ds-segmented ds-segmented--${size} ${className}`}
      role="group"
      aria-label={label}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const tooltip = option.shortcut
          ? `${option.label} (${option.shortcut})`
          : option.label;
        return (
          <button
            key={option.value}
            type="button"
            className="ds-segmented__option"
            aria-pressed={selected}
            aria-label={iconOnly ? option.label : undefined}
            title={tooltip}
            onMouseDown={preserveSelection ? preserveSelectionHandler() : undefined}
            onClick={() => onChange?.(option.value)}
          >
            {option.icon ? <Icon name={option.icon} size={16} /> : null}
            {iconOnly ? null : <span>{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
