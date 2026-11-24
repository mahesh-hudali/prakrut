import "./Toolbar.css";

/** Horizontal bar of controls. Groups are separated by dividers, not boxes. */
export function Toolbar({ label, className = "", children, ...rest }) {
  return (
    <div role="toolbar" aria-label={label} className={`ds-toolbar ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function ToolbarGroup({ label, className = "", children }) {
  return (
    <div role="group" aria-label={label} className={`ds-toolbar__group ${className}`}>
      {children}
    </div>
  );
}

export function ToolbarDivider({ className = "" }) {
  return <span className={`ds-toolbar__divider ${className}`} aria-hidden="true" />;
}

export function ToolbarSpacer() {
  return <span className="ds-toolbar__spacer" aria-hidden="true" />;
}

/** Small count pill, e.g. unresolved comments. */
export function Badge({ children, tone = "neutral" }) {
  return <span className={`ds-badge ds-badge--${tone}`}>{children}</span>;
}

/** A keyboard shortcut, e.g. <Kbd>⌘Z</Kbd>. */
export function Kbd({ children }) {
  return <kbd className="ds-kbd">{children}</kbd>;
}
