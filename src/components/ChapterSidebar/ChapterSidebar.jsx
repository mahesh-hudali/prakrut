import { useState } from "react";
import "./ChapterSidebar.css";

export default function ChapterSidebar({
  chapters,
  activeChapterId,
  frontMatter,
  onSelectChapter,
  onAddChapter,
  onRenameChapter,
  onDeleteChapter,
  onMoveChapter,
  onToggleFrontMatter,
}) {
  const [renamingId, setRenamingId] = useState(null);
  const [draftTitle, setDraftTitle] = useState("");

  const commitRename = () => {
    const title = draftTitle.trim();
    if (renamingId && title) onRenameChapter?.(renamingId, title);
    setRenamingId(null);
  };

  return (
    <div className="chapter-sidebar">
      <section>
        <h2>Front matter</h2>
        <ul className="front-matter-list">
          {[
            ["cover", "Cover"],
            ["titlePage", "Title Page"],
            ["copyright", "Copyright"],
            ["dedication", "Dedication"],
            ["contents", "Contents"],
          ].map(([key, label]) => (
            <li key={key}>
              <label className="front-matter-item">
                <input
                  type="checkbox"
                  checked={Boolean(frontMatter?.[key])}
                  onChange={(event) =>
                    onToggleFrontMatter?.(key, event.target.checked)
                  }
                />
                {label}
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="chapter-sidebar-heading">
          <h2>Chapters</h2>
          <button
            type="button"
            className="chapter-add"
            onClick={() => onAddChapter?.()}
            title="New chapter"
          >
            + New
          </button>
        </div>

        <ul className="chapter-list">
          {(chapters ?? []).map((chapter, index) => (
            <li
              key={chapter.id}
              className={`chapter-item ${
                chapter.id === activeChapterId ? "is-active" : ""
              }`}
            >
              {renamingId === chapter.id ? (
                <input
                  className="chapter-rename"
                  value={draftTitle}
                  autoFocus
                  onChange={(event) => setDraftTitle(event.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitRename();
                    }
                    if (event.key === "Escape") setRenamingId(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="chapter-select"
                  onClick={() => onSelectChapter?.(chapter.id)}
                  onDoubleClick={() => {
                    setRenamingId(chapter.id);
                    setDraftTitle(chapter.title ?? "");
                  }}
                  title="Double-click to rename"
                >
                  <span className="chapter-number">{index + 1}</span>
                  <span className="chapter-title">
                    {chapter.title || "Untitled chapter"}
                  </span>
                </button>
              )}

              <span className="chapter-tools">
                <button
                  type="button"
                  title="Move up"
                  disabled={index === 0}
                  onClick={() => onMoveChapter?.(chapter.id, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  title="Move down"
                  disabled={index === (chapters?.length ?? 0) - 1}
                  onClick={() => onMoveChapter?.(chapter.id, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  title="Delete chapter"
                  disabled={(chapters?.length ?? 0) <= 1}
                  onClick={() => onDeleteChapter?.(chapter.id)}
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
