/**
 * One stroke icon set for the whole app (24px grid, 1.75px stroke, round
 * caps). Icons inherit `currentColor`, so they follow text colour and theme.
 *
 *   <Icon name="undo" />            decorative (next to a text label)
 *   <Icon name="undo" label="Undo"/> meaningful on its own
 */

import { ICON_PATHS } from "./paths.jsx";


export function Icon({ name, size = 18, label, className = "", ...rest }) {
  const content = ICON_PATHS[name];
  if (!content) return null;
  return (
    <svg
      className={`ds-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...rest}
    >
      {content}
    </svg>
  );
}
