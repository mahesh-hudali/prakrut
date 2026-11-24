import { useState } from "react";
import { Button, Checkbox, IconButton, PanelSection, TextInput } from "../../design-system";
import "./ChapterSidebar.css";

const FRONT_MATTER = [
  ["cover", "Cover"],
  ["titlePage", "Title page"],
  ["copyright", "Copyright"],
  ["dedication", "Dedication"],
  ["contents", "Contents"],
];

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
  const count = chapters?.length ?? 0;

  const commitRename = () => {
    const title = draftTitle.trim();
    if (renamingId && title) onRenameChapter?.(renamingId, title);
    setRenamingId(null);
  };

  return (
    <>
      <PanelSection
        title="Chapters"
        action={
          <Button size="sm" icon="plus" onClick={() => onAddChapter?.()}>
            New chapter
          </Button>
        }
      >
        <ol className="chapter-list">
          {(chapters ?? []).map((chapter, index) => (
            <li
              key={chapter.id}
              className={`chapter-item ${chapter.id === activeChapterId ? "is-active" : ""}`}
            >
              {renamingId === chapter.id ? (
                <TextInput
                  size="sm"
                  className="chapter-rename"
                  value={draftTitle}
                  aria-label="Chapter title"
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
                  aria-current={chapter.id === activeChapterId ? "true" : undefined}
                  onClick={() => onSelectChapter?.(chapter.id)}
                  onDoubleClick={() => {
                    setRenamingId(chapter.id);
                    setDraftTitle(chapter.title ?? "");
                  }}
                  title="Double-click to rename"
                >
                  <span className="chapter-number">{index + 1}</span>
                  <span className="chapter-title">{chapter.title || "Untitled chapter"}</span>
                </button>
              )}

              <span className="chapter-tools">
                <IconButton
                  size="sm"
                  icon="arrowUp"
                  label="Move up"
                  disabled={index === 0}
                  onClick={() => onMoveChapter?.(chapter.id, -1)}
                />
                <IconButton
                  size="sm"
                  icon="arrowDown"
                  label="Move down"
                  disabled={index === count - 1}
                  onClick={() => onMoveChapter?.(chapter.id, 1)}
                />
                <IconButton
                  size="sm"
                  icon="trash"
                  label="Delete chapter"
                  variant="danger"
                  disabled={count <= 1}
                  onClick={() => onDeleteChapter?.(chapter.id)}
                />
              </span>
            </li>
          ))}
        </ol>
      </PanelSection>

      <PanelSection title="Front matter">
        <div className="front-matter-list">
          {FRONT_MATTER.map(([key, label]) => (
            <Checkbox
              key={key}
              label={label}
              checked={Boolean(frontMatter?.[key])}
              onChange={(checked) => onToggleFrontMatter?.(key, checked)}
            />
          ))}
        </div>
      </PanelSection>
    </>
  );
}
