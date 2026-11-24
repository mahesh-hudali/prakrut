import { createContext, useContext, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAnchoredMenu } from "../hooks/useAnchoredMenu.js";
import { Icon } from "../icons/Icon.jsx";
import { Button, IconButton } from "./Button.jsx";
import "./Menu.css";

const MenuContext = createContext({ close: () => {} });

function menuItems(menu) {
  return [...(menu?.querySelectorAll('[role^="menuitem"]:not(:disabled)') ?? [])];
}

/**
 * A button that opens a menu.
 *
 *   <MenuButton label="File">
 *     <MenuItem onSelect={save} shortcut="⌘S">Save</MenuItem>
 *   </MenuButton>
 *
 * iconOnly + icon renders an IconButton trigger. Arrow keys move between
 * items, Escape closes and returns focus to the trigger.
 */
export function MenuButton({
  label,
  icon,
  iconOnly = false,
  variant = "ghost",
  size = "md",
  align = "left",
  disabled = false,
  showChevron = true,
  menuLabel,
  className = "",
  children,
}) {
  const { open, setOpen, toggle, triggerRef, menuRef, menuStyle } =
    useAnchoredMenu({ align });

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  };

  // Move focus into the menu when it opens.
  useEffect(() => {
    if (!open) return undefined;
    const id = requestAnimationFrame(() => menuItems(menuRef.current)[0]?.focus());
    return () => cancelAnimationFrame(id);
  }, [open, menuRef]);

  const onKeyDown = (event) => {
    const items = menuItems(menuRef.current);
    const index = items.indexOf(document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items.at(-1)?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  const triggerProps = {
    ref: triggerRef,
    "aria-haspopup": "menu",
    "aria-expanded": open,
    disabled,
    onClick: toggle,
    variant,
    size,
  };

  return (
    <>
      {iconOnly ? (
        <IconButton {...triggerProps} icon={icon} label={label} className={className} />
      ) : (
        <Button
          {...triggerProps}
          icon={icon}
          iconEnd={showChevron ? "chevronDown" : undefined}
          className={className}
        >
          {label}
        </Button>
      )}

      {open &&
        createPortal(
          <MenuContext.Provider value={{ close }}>
            <div
              ref={menuRef}
              className="ds-menu"
              style={menuStyle}
              role="menu"
              aria-label={menuLabel ?? label}
              onKeyDown={onKeyDown}
            >
              {children}
            </div>
          </MenuContext.Provider>,
          document.body
        )}
    </>
  );
}

/**
 * checked: undefined → plain item; true/false → a choice. A choice is a
 * radio item (one of several, e.g. Light / Dark) unless `toggle` is set,
 * which makes it an on/off checkbox item (e.g. Focus mode).
 */
export function MenuItem({
  onSelect,
  icon,
  shortcut,
  checked,
  toggle = false,
  disabled = false,
  danger = false,
  children,
}) {
  const { close } = useContext(MenuContext);
  const isChoice = checked !== undefined;

  return (
    <button
      type="button"
      role={isChoice ? (toggle ? "menuitemcheckbox" : "menuitemradio") : "menuitem"}
      aria-checked={isChoice ? checked : undefined}
      tabIndex={-1}
      disabled={disabled}
      className={`ds-menu__item ${danger ? "is-danger" : ""}`}
      onClick={() => {
        close(false);
        onSelect?.();
      }}
    >
      <span className="ds-menu__icon">
        {isChoice ? (checked ? <Icon name="check" size={16} /> : null) : icon ? (
          <Icon name={icon} size={16} />
        ) : null}
      </span>
      <span className="ds-menu__text">{children}</span>
      {shortcut ? <span className="ds-menu__shortcut">{shortcut}</span> : null}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="ds-menu__separator" role="separator" />;
}

/** A heading for a group of items, in sentence case. */
export function MenuLabel({ children }) {
  return (
    <div className="ds-menu__label" role="presentation">
      {children}
    </div>
  );
}
