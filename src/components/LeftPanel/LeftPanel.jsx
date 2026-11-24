import { useState } from "react";
import { Panel, PanelBody, PanelHeader, Tabs } from "../../design-system";
import ChapterSidebar from "../ChapterSidebar/ChapterSidebar";
import DocumentSettings from "../DocumentSettings/DocumentSettings";

const TABS = [
  { value: "chapters", label: "Book" },
  { value: "layout", label: "Layout" },
];

/**
 * The binder: chapters and front matter, plus page layout. Closed by default
 * so the manuscript owns the screen; the page never moves when it opens.
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
    <Panel open={open} side="left" label="Book navigation and settings">
      <PanelHeader onClose={onClose}>
        <Tabs tabs={TABS} value={tab} onChange={setTab} label="Panel sections" />
      </PanelHeader>
      <PanelBody>
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
          <DocumentSettings settings={settings} onChangeSettings={onChangeSettings} />
        )}
      </PanelBody>
    </Panel>
  );
}
