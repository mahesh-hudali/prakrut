import { useId } from "react";
import "./Tabs.css";

/**
 * Tab strip. Content is rendered by the caller; use `tabPanelProps(value)`
 * on the active panel so it is labelled by its tab.
 *
 * tabs: [{ value, label }]
 */
export function Tabs({ tabs, value, onChange, label }) {
  const baseId = useId();

  const onKeyDown = (event) => {
    const index = tabs.findIndex((tab) => tab.value === value);
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const step = event.key === "ArrowRight" ? 1 : -1;
      const next = tabs[(index + step + tabs.length) % tabs.length];
      onChange?.(next.value);
      document.getElementById(`${baseId}-${next.value}`)?.focus();
    }
  };

  return (
    <div className="ds-tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            id={`${baseId}-${tab.value}`}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className="ds-tabs__tab"
            onClick={() => onChange?.(tab.value)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
