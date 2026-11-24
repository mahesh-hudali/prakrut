import { forwardRef } from "react";
import { Icon } from "../icons/Icon.jsx";
import { preserveSelectionHandler } from "./preserveSelection.js";
import "./Button.css";

/**
 * Text button.
 * variant: "primary" (one per area: the main action), "secondary" (bordered),
 *          "ghost" (toolbar and inline actions), "danger"
 * size:    "sm" | "md"
 */
export const Button = forwardRef(function Button(
  {
    variant = "ghost",
    size = "md",
    icon,
    iconEnd,
    pressed,
    preserveSelection = false,
    className = "",
    children,
    onMouseDown,
    type = "button",
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`ds-button ds-button--${variant} ds-button--${size} ${className}`}
      aria-pressed={pressed}
      onMouseDown={
        preserveSelection ? preserveSelectionHandler(onMouseDown) : onMouseDown
      }
      {...rest}
    >
      {icon ? <Icon name={icon} size={size === "sm" ? 16 : 18} /> : null}
      {children != null ? <span className="ds-button__label">{children}</span> : null}
      {iconEnd ? <Icon name={iconEnd} size={14} className="ds-button__end" /> : null}
    </button>
  );
});

/**
 * Icon-only button. `label` is required: it becomes the accessible name and
 * the tooltip. `shortcut` is appended to the tooltip, e.g. "Undo (⌘Z)".
 */
export const IconButton = forwardRef(function IconButton(
  {
    icon,
    label,
    shortcut,
    size = "md",
    variant = "ghost",
    pressed,
    badge,
    preserveSelection = false,
    className = "",
    onMouseDown,
    type = "button",
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`ds-button ds-button--${variant} ds-button--${size} ds-button--icon ${className}`}
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-pressed={pressed}
      onMouseDown={
        preserveSelection ? preserveSelectionHandler(onMouseDown) : onMouseDown
      }
      {...rest}
    >
      <Icon name={icon} size={size === "sm" ? 16 : 18} />
      {badge ? <span className="ds-button__badge">{badge}</span> : null}
    </button>
  );
});
