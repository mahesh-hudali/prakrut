import { forwardRef, useId } from "react";
import { Icon } from "../icons/Icon.jsx";
import "./Field.css";

/**
 * Label + control + optional hint, stacked.
 * Use `group` for controls made of several buttons (a <label> would forward
 * clicks on its text to the first button).
 */
export function Field({ label, hint, group = false, children, className = "" }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className={`ds-field ${className}`}>
      <span className="ds-field__label">{label}</span>
      {children}
      {hint ? <span className="ds-field__hint">{hint}</span> : null}
    </Tag>
  );
}

/** Two or more fields side by side. */
export function FieldRow({ children }) {
  return <div className="ds-field-row">{children}</div>;
}

export const TextInput = forwardRef(function TextInput(
  { size = "md", className = "", ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      className={`ds-input ds-input--${size} ${className}`}
      {...rest}
    />
  );
});

export const TextArea = forwardRef(function TextArea(
  { className = "", rows = 3, ...rest },
  ref
) {
  return <textarea ref={ref} rows={rows} className={`ds-input ds-textarea ${className}`} {...rest} />;
});

/** Number input with a unit after it (", pt, em). */
export function NumberInput({ suffix, className = "", onChange, ...rest }) {
  return (
    <span className={`ds-number ${className}`}>
      <input
        type="number"
        className="ds-input"
        onChange={(event) => onChange?.(Number(event.target.value))}
        {...rest}
      />
      {suffix ? <span className="ds-number__suffix">{suffix}</span> : null}
    </span>
  );
}

/**
 * Native select (keyboard, screen readers and mobile pickers come for free)
 * with the design-system look.
 *
 * options: [{ value, label }]  or pass <option> children.
 */
export const Select = forwardRef(function Select(
  { options, size = "md", className = "", children, placeholder, ...rest },
  ref
) {
  return (
    <span className={`ds-select ds-select--${size} ${className}`}>
      <select ref={ref} {...rest}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options
          ? options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))
          : children}
      </select>
      <Icon name="chevronDown" size={14} className="ds-select__chevron" />
    </span>
  );
});

export function Checkbox({ label, checked, onChange, className = "", ...rest }) {
  const id = useId();
  return (
    <span className={`ds-checkbox ${className}`}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange?.(event.target.checked)}
        {...rest}
      />
      <span className="ds-checkbox__box" aria-hidden="true">
        <Icon name="check" size={12} />
      </span>
      <label htmlFor={id}>{label}</label>
    </span>
  );
}
