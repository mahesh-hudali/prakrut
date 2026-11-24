import { useCallback, useEffect, useRef, useState } from "react";

// Same-origin by default so the Vite proxy handles it; a hardcoded backend
// origin breaks under CORS whenever Vite starts on a non-default port.
const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const DEBOUNCE_MS = 150;
const WORD_CHAR = /[A-Za-z]/;

export function getCurrentWord(text, caret) {
  let start = caret;
  while (start > 0 && WORD_CHAR.test(text[start - 1])) {
    start -= 1;
  }
  let end = caret;
  while (end < text.length && WORD_CHAR.test(text[end])) {
    end += 1;
  }
  return {
    word: text.slice(start, end),
    start,
    end,
  };
}

/**
 * Reuses the proven local IndicXlit workflow:
 * detect Roman word at caret → debounce → POST /transliterate → suggestions.
 */
export function useTransliteration() {
  const [suggestions, setSuggestions] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [wordRange, setWordRange] = useState({ start: 0, end: 0, word: "" });

  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const requestIdRef = useRef(0);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setSelectedIndex(0);
    setOpen(false);
    setLoading(false);
  }, []);

  const fetchSuggestions = useCallback(
    async (word) => {
      if (!word || word.length < 1) {
        clearSuggestions();
        return;
      }

      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = ++requestIdRef.current;

      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE}/transliterate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: word, lang: "kn" }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        if (requestId !== requestIdRef.current) return;

        const result = Array.isArray(data.result) ? data.result : [];
        setSuggestions(result);
        setSelectedIndex(0);
        setOpen(result.length > 0);
      } catch (err) {
        if (err.name === "AbortError") return;
        if (requestId === requestIdRef.current) {
          setError(
            err instanceof TypeError
              ? API_BASE
                ? "Transliteration needs the local server — run: npm run backend"
                : "Transliteration server unreachable — restart the app with: npm start"
              : err.message || "Transliteration failed"
          );
          clearSuggestions();
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [clearSuggestions]
  );

  const scheduleFetch = useCallback(
    (word) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchSuggestions(word);
      }, DEBOUNCE_MS);
    },
    [fetchSuggestions]
  );

  const syncFromCaret = useCallback(
    (value, caret) => {
      const current = getCurrentWord(value, caret);
      setWordRange(current);
      if (!current.word) {
        clearSuggestions();
        return;
      }
      scheduleFetch(current.word);
    },
    [clearSuggestions, scheduleFetch]
  );

  const handleSuggestionKeys = useCallback(
    (event, { onAccept }) => {
      if (!open || suggestions.length === 0) return false;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((i) => (i + 1) % suggestions.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex(
          (i) => (i - 1 + suggestions.length) % suggestions.length
        );
        return true;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        onAccept(suggestions[selectedIndex], { appendSpace: false });
        return true;
      }
      if (event.key === " ") {
        event.preventDefault();
        onAccept(suggestions[selectedIndex], { appendSpace: true });
        return true;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        clearSuggestions();
        return true;
      }
      return false;
    },
    [clearSuggestions, open, selectedIndex, suggestions]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return {
    suggestions,
    selectedIndex,
    setSelectedIndex,
    open,
    loading,
    error,
    wordRange,
    setWordRange,
    clearSuggestions,
    syncFromCaret,
    handleSuggestionKeys,
  };
}
