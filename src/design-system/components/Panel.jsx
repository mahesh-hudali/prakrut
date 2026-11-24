import { IconButton } from "./Button.jsx";
import "./Panel.css";

/**
 * Side panel next to the writing area (binder, comments, settings).
 * It slides open without moving the page; on narrow screens it floats over
 * the page instead of squeezing it.
 *
 * side: "left" | "right"
 */
export function Panel({ open, side = "left", label, className = "", children }) {
  return (
    <aside
      className={`ds-panel ds-panel--${side} ${open ? "is-open" : ""} ${className}`}
      aria-label={label}
      aria-hidden={!open}
      inert={open ? undefined : true}
      data-print="hide"
    >
      <div className="ds-panel__inner">{children}</div>
    </aside>
  );
}

/** Title row with optional actions and a close button. */
export function PanelHeader({ title, actions, onClose, closeLabel = "Close panel", children }) {
  return (
    <header className="ds-panel__header">
      {title ? <h2 className="ds-panel__title">{title}</h2> : null}
      {children}
      <span className="ds-panel__actions">
        {actions}
        {onClose ? (
          <IconButton icon="close" label={closeLabel} size="sm" onClick={onClose} />
        ) : null}
      </span>
    </header>
  );
}

export function PanelBody({ children, className = "" }) {
  return <div className={`ds-panel__body ${className}`}>{children}</div>;
}

/** A titled block inside a panel body. */
export function PanelSection({ title, action, children }) {
  return (
    <section className="ds-panel__section">
      {title || action ? (
        <div className="ds-panel__section-head">
          {title ? <h3 className="ds-panel__section-title">{title}</h3> : null}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Empty state: says what to do, not how it feels. */
export function EmptyState({ title, children }) {
  return (
    <div className="ds-empty">
      {title ? <p className="ds-empty__title">{title}</p> : null}
      <p className="ds-empty__body">{children}</p>
    </div>
  );
}
