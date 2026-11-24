/**
 * ProseMirror schema for Prakrut manuscripts (via Tiptap).
 *
 *   doc → chapter+ → paragraph+ → text (with marks)
 *
 * A paragraph carries one of the app's paragraph styles (Normal, Character,
 * Action, Dialogue, Chapter title, …) as `blockStyle`, plus a stable `id`
 * that comments, exports and future revision tracking rely on.
 *
 * Inline formatting is ProseMirror marks, so it applies to any selection,
 * across paragraphs, the way Google Docs does: bold / italic / underline from
 * StarterKit, font family and size from TextStyle, and `annotation` for
 * comment and highlight ranges.
 */
import { Extension, Mark, Node, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { BLOCK_STYLES } from "../models/documentModel.js";
import { createId } from "../models/ids.js";

/** After Enter, some styles hand over to the next natural one. */
const NEXT_STYLE_AFTER_ENTER = {
  chapterTitle: "normal",
  sectionHeading: "normal",
  subheading: "normal",
  sceneBreak: "normal",
  character: "dialogue",
};

/**
 * Inline CSS for a paragraph style. Vertical rhythm uses padding rather than
 * margins so heights add up exactly (no margin collapsing), which keeps page
 * breaks predictable.
 */
export function blockStyleCss(styleId) {
  const def = BLOCK_STYLES[styleId] ?? BLOCK_STYLES.normal;
  const rules = [
    `padding-top:${def.marginTopEm ?? 0}em`,
    `padding-bottom:calc(${def.marginBottomEm ?? 0}em + var(--paragraph-spacing))`,
    `font-size:${def.fontSizeScale ?? 1}em`,
    `font-weight:${def.fontWeight ?? "inherit"}`,
  ];
  if (def.italic) rules.push("font-style:italic");
  if (def.paddingLeftEm) rules.push(`padding-left:${def.paddingLeftEm}em`);
  if (def.paddingRightEm) rules.push(`padding-right:${def.paddingRightEm}em`);
  if (def.letterSpacingEm) {
    rules.push(`letter-spacing:calc(var(--letter-spacing) + ${def.letterSpacingEm}em)`);
  }
  rules.push(`text-indent:${def.indentFirstLine ? "var(--first-line-indent)" : "0"}`);
  return rules.join(";");
}

/** The document is a sequence of chapters. */
export const BookDocument = Node.create({
  name: "doc",
  topNode: true,
  content: "chapter+",
});

/**
 * A chapter is isolating: Backspace at its start does not merge it into the
 * previous chapter, and selections cannot accidentally fuse two chapters.
 */
export const Chapter = Node.create({
  name: "chapter",
  content: "paragraph+",
  isolating: true,
  defining: true,

  addAttributes() {
    return {
      id: { default: null, keepOnSplit: false, renderHTML: (a) => ({ "data-chapter-id": a.id }) },
      title: { default: "", renderHTML: () => ({}) },
    };
  },

  parseHTML() {
    return [{ tag: "section[data-chapter-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["section", mergeAttributes(HTMLAttributes, { class: "manuscript-chapter" }), 0];
  },
});

export const BookParagraph = Node.create({
  name: "paragraph",
  priority: 1000,
  content: "inline*",

  addAttributes() {
    return {
      id: {
        default: null,
        keepOnSplit: false,
        parseHTML: (el) => el.getAttribute("data-block-id"),
        renderHTML: (a) => ({ "data-block-id": a.id }),
      },
      blockStyle: {
        default: "normal",
        parseHTML: (el) => el.getAttribute("data-style") || "normal",
        renderHTML: (a) => ({
          "data-style": a.blockStyle,
          class: `page-paragraph style-${a.blockStyle}`,
          style: blockStyleCss(a.blockStyle),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "p" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    // Alignment: explicit per-paragraph choice, else the style's default,
    // else the book default (inherited from the page).
    const def = BLOCK_STYLES[node.attrs.blockStyle] ?? BLOCK_STYLES.normal;
    const align = node.attrs.textAlign || def.align;
    return ["p", mergeAttributes(HTMLAttributes, align ? { style: `text-align:${align}` } : {}), 0];
  },

  addKeyboardShortcuts() {
    return {
      // Screenplay flow: Enter after a character cue continues as dialogue;
      // after a heading or chapter title, back to normal prose.
      Enter: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        if (!empty || $from.parent.type.name !== "paragraph") return false;
        const next = NEXT_STYLE_AFTER_ENTER[$from.parent.attrs.blockStyle];
        if (!next) return false;
        return editor
          .chain()
          .splitBlock()
          .updateAttributes("paragraph", { blockStyle: next, textAlign: null })
          .run();
      },
    };
  },
});

/**
 * Comment / highlight range. Several can overlap, so the mark does not
 * exclude itself. Typing at its edge does not extend it.
 */
export const Annotation = Mark.create({
  name: "annotation",
  inclusive: false,
  excludes: "",

  addAttributes() {
    return {
      highlightId: { default: null },
      commentId: { default: null },
      color: { default: "neonYellow" },
      resolved: { default: false },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-highlight-id]" }];
  },

  renderHTML({ mark }) {
    const { highlightId, commentId, color, resolved } = mark.attrs;
    const token = {
      neonYellow: "yellow",
      neonGreen: "green",
      blue: "blue",
      pink: "pink",
      orange: "yellow",
    }[color] ?? "yellow";
    return [
      "span",
      {
        class: `comment-mark ${resolved ? "is-resolved" : "is-unresolved"}`,
        "data-highlight-id": highlightId,
        "data-comment-id": commentId ?? "",
        style: resolved ? "" : `--comment-highlight: var(--color-highlight-${token})`,
      },
      0,
    ];
  },
});

/**
 * Every chapter and paragraph keeps a unique id: new ones get an id, and a
 * paragraph produced by splitting (which would copy the id) gets a fresh one.
 */
export const UniqueIds = Extension.create({
  name: "uniqueIds",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("uniqueIds"),
        appendTransaction: (transactions, _old, state) => {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const seen = new Set();
          let tr = null;
          state.doc.descendants((node, pos) => {
            if (node.type.name !== "paragraph" && node.type.name !== "chapter") {
              return node.type.name === "doc";
            }
            const id = node.attrs.id;
            if (!id || seen.has(id)) {
              tr = tr ?? state.tr;
              const fresh = createId(node.type.name === "chapter" ? "ch" : "p");
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, id: fresh });
              seen.add(fresh);
            } else {
              seen.add(id);
            }
            return node.type.name === "chapter";
          });
          if (tr) tr.setMeta("addToHistory", false);
          return tr;
        },
      }),
    ];
  },
});

/**
 * Exact text input for Kannada.
 *
 * Chrome snaps the caret to the end of what it considers one letter. When a
 * writer types a consonant + virama (ಲ + ್) in front of existing text, the
 * new "ಲ್" fuses with the next consonant (ರಾ → ಲ್ರಾ) and Chrome moves the
 * caret past the whole cluster, so the next keystroke lands in the wrong
 * place and the word is scrambled — even in a plain <textarea>.
 *
 * Here typed characters are inserted by the editor at its own, exact
 * position instead of by the browser. IME composition is left alone.
 */
export const ExactTextInput = Extension.create({
  name: "exactTextInput",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("exactTextInput"),
        props: {
          handleDOMEvents: {
            beforeinput(view, event) {
              if (event.inputType !== "insertText" || !event.data) return false;
              if (event.isComposing || view.composing) return false;
              event.preventDefault();
              const { from, to } = view.state.selection;
              view.dispatch(view.state.tr.insertText(event.data, from, to).scrollIntoView());
              return true;
            },
          },
        },
      }),
    ];
  },
});
