import { useEffect, useState } from "react";
import { Icon, Select } from "../../design-system";
import "./StatusBar.css";

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5];

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine ?? true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

function formatTime(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
}

/**
 * Save states from the product blueprint (1.5). "Saved" is only shown after a
 * durable write has completed; an untouched new project says so plainly.
 * Every state has text and an icon, never colour alone.
 */
function describeSave(status, online) {
  switch (status) {
    case "saved":
      return online
        ? { text: "Saved locally", icon: "check", tone: "ok" }
        : { text: "Offline — changes saved", icon: "check", tone: "ok" };
    case "error":
      return { text: "Attention required", icon: "alert", tone: "error" };
    case "new":
      return { text: "Not saved yet", icon: "dot", tone: "neutral" };
    default:
      return { text: "Saving…", icon: "dot", tone: "busy" };
  }
}

/**
 * Bottom bar: save state and counts on the left, a contextual message and
 * zoom on the right. In focus mode it hides with the toolbar, except when the
 * save needs attention.
 */
export default function StatusBar({
  saveStatus,
  savedAt,
  pageCount,
  isPaginating,
  stats,
  zoom,
  onZoomChange,
  message,
}) {
  const online = useOnline();
  const save = describeSave(saveStatus, online);
  const browserTime = formatTime(savedAt?.browser);
  const fileTime = formatTime(savedAt?.file);
  const detail = [
    browserTime ? `Saved in this browser at ${browserTime}.` : "Not yet saved in this browser.",
    fileTime ? `Last saved to a project file at ${fileTime}.` : "Not yet saved to a project file — use File › Save to keep a copy you control.",
  ].join(" ");

  return (
    <footer
      className={`status-bar ${save.tone === "error" ? "needs-attention" : ""}`}
      data-print="hide"
    >
      <span className={`status-bar__save is-${save.tone}`} role="status" title={detail}>
        {save.icon === "dot" ? (
          <span className="status-bar__dot" aria-hidden="true" />
        ) : (
          <Icon name={save.icon} size={14} />
        )}
        {save.text}
      </span>

      <dl className="status-bar__counts">
        <div className="status-bar__count status-bar__count--words">
          <dt>Words</dt>
          <dd>{stats.words.toLocaleString("en-IN")}</dd>
        </div>
        <div className="status-bar__count">
          <dt>Characters</dt>
          <dd>{stats.characters.toLocaleString("en-IN")}</dd>
        </div>
        <div className="status-bar__count">
          <dt>Pages</dt>
          <dd aria-busy={isPaginating}>{pageCount}</dd>
        </div>
      </dl>

      <span className="status-bar__message" role="status" aria-live="polite">
        {message}
      </span>

      <Select
        size="sm"
        className="status-bar__zoom"
        aria-label="Zoom"
        value={zoom}
        onChange={(event) => onZoomChange?.(Number(event.target.value))}
        options={ZOOM_LEVELS.map((level) => ({
          value: level,
          label: `${Math.round(level * 100)}%`,
        }))}
      />
    </footer>
  );
}
