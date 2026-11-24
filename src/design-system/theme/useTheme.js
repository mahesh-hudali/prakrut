import { useCallback, useEffect, useState } from "react";

export const THEME_STORAGE_KEY = "prakrut:theme";
export const THEME_CHOICES = ["light", "dark", "system"];

function readChoice() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_CHOICES.includes(value) ? value : "system";
  } catch {
    return "system";
  }
}

function systemPrefersDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

/**
 * Applies the theme to <html data-theme>. "system" removes the attribute so
 * the CSS media query follows the OS, live. index.html applies the stored
 * choice before first paint, so there is no flash of the wrong theme.
 */
export function applyTheme(choice) {
  const root = document.documentElement;
  if (choice === "system") delete root.dataset.theme;
  else root.dataset.theme = choice;
}

export function useTheme() {
  const [choice, setChoiceState] = useState(readChoice);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    applyTheme(choice);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, choice);
    } catch {
      // Private mode: the choice just lasts for this visit.
    }
  }, [choice]);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!query) return undefined;
    const onChange = (event) => setSystemDark(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const setChoice = useCallback((next) => {
    if (THEME_CHOICES.includes(next)) setChoiceState(next);
  }, []);

  const resolved = choice === "system" ? (systemDark ? "dark" : "light") : choice;

  return { choice, resolved, setChoice };
}
