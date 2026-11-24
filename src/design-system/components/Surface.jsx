import { forwardRef } from "react";
import "./Surface.css";

/**
 * A floating card positioned by the caller (popovers, the comment composer,
 * transliteration suggestions).
 *
 * tone: "raised" (default) | "inverse" (dark-on-light for the selection bar)
 */
export const Surface = forwardRef(function Surface(
  { tone = "raised", className = "", style, children, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={`ds-surface ds-surface--${tone} ${className}`}
      style={style}
      data-print="hide"
      {...rest}
    >
      {children}
    </div>
  );
});

/**
 * A message pinned to the bottom of the screen with actions, e.g. restoring
 * autosaved work. Use `role="alertdialog"` when it needs an answer.
 */
export function Toast({ title, description, actions, role = "status", label }) {
  return (
    <div className="ds-toast" role={role} aria-label={label ?? title} data-print="hide">
      <div className="ds-toast__text">
        <strong>{title}</strong>
        {description ? <span>{description}</span> : null}
      </div>
      {actions ? <div className="ds-toast__actions">{actions}</div> : null}
    </div>
  );
}
