import { useState } from "react";
import ChapterSidebar from "../ChapterSidebar/ChapterSidebar";
import DocumentSettings from "../DocumentSettings/DocumentSettings";
import "./LeftPanel.css";

const TABS = [
  { id: "chapters", label: "Book" },
  { id: "layout", label: "Layout" },
];

/**
 * Sliding drawer holding navigation and advanced settings.
 * Hidden by default so the manuscript owns the workspace; the page geometry
 * never changes when it opens or closes.
 */
export default function LeftPanel({
  open,
  chapters,
  activeChapterId,
  frontMatter,
  settings,
  onChangeSettings,
  onSelectChapter,
  onAddChapter,
  onRenameChapter,
  onDeleteChapter,
  onMoveChapter,
  onToggleFrontMatter,
  onClose,
}) {
  const [tab, setTab] = useState("chapters");

  return (
    <aside
      className={`left-panel ${open ? "is-open" : ""}`}
      aria-label="Book navigation and settings"
      aria-hidden={!open}
    >
      <div className="left-panel-scroll">
        <div className="left-panel-tabs" role="tablist">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={`left-panel-tab ${tab === item.id ? "is-active" : ""}`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            className="panel-close"
            onClick={onClose}
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>

        {tab === "chapters" ? (
          <ChapterSidebar
            chapters={chapters}
            activeChapterId={activeChapterId}
            frontMatter={frontMatter}
            onSelectChapter={onSelectChapter}
            onAddChapter={onAddChapter}
            onRenameChapter={onRenameChapter}
            onDeleteChapter={onDeleteChapter}
            onMoveChapter={onMoveChapter}
            onToggleFrontMatter={onToggleFrontMatter}
          />
        ) : (
          <DocumentSettings
            settings={settings}
            onChangeSettings={onChangeSettings}
          />
        )}
      </div>
    </aside>
  );
}
