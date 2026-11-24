# Prakrut product blueprint

A decision-oriented blueprint for an offline-first Kannada writing environment
covering books, screenplays, stage plays and series.

**Product thesis:** build a professional writing environment designed around
Kannada — not a Kannada typing tool with a document editor attached.

**Five product principles**

1. Writing comes first: the editor must never feel like an office productivity application.
2. Kannada is native: typography, input, punctuation, pagination and text processing are designed for Kannada.
3. The manuscript belongs to the writer: local-first storage, portable projects and transparent recovery.
4. Structure should emerge naturally: writers should not need to think about document architecture while drafting.
5. Simple by default, powerful on demand: professional capability must not create beginner anxiety.

**Priority key:** MUST = required for a credible release · SHOULD = high-value,
can follow the core · COULD = optional differentiator · WON'T = deliberately
excluded from the stated release scope.

> Status: this copy covers Part 1 to Part 3.2. Later sections were not yet
> provided.

---

## Part 1 — User psychology

### 1.1 What writers need emotionally

| Need | Psychology / risk | Product response | Priority |
|---|---|---|---|
| Flow | Interruptions break creative immersion. | Fast editor, minimal chrome, predictable shortcuts. | MUST |
| Safety | Loss of months of work feels catastrophic. | Autosave, recovery, snapshots, portable local project. | MUST |
| Ownership | The manuscript is personal intellectual property. | No forced cloud; transparent file format and export. | MUST |
| Confidence | Blank-page anxiety delays starting. | Start-from-template, sample structure, immediate typing. | MUST |
| Control | Unexpected formatting or conversion damages trust. | Explicit, reversible actions; no silent rewriting. | MUST |
| Completion | Large projects feel unmanageable. | Chapter/scene structure and optional progress. | SHOULD |
| Recognition | Visible progress reinforces effort. | Page preview, word count, chapter status. | SHOULD |
| Motivation | Goals can help but can also shame. | Optional daily target; no punitive streaks. | SHOULD |
| Perfectionism | Editing every sentence interrupts drafting. | Draft/revision modes and low-friction comments. | SHOULD |
| Feedback | Writers may need trusted readers. | Comments and shareable review exports. | COULD |

### 1.2 Principles translated into product decisions

| Principle | Specific application | Priority |
|---|---|---|
| Flow state (Csikszentmihalyi) | Keep typing latency imperceptible; avoid modal interruptions and noisy animations. | MUST |
| Cognitive load | Expose only the controls needed for the current mode and task. | MUST |
| Hick's law | Limit primary toolbar to roughly 5–7 high-frequency actions; group the rest. | MUST |
| Fitts's law | Make common targets easy to reach; touch targets at least 44×44 CSS px. | MUST |
| Miller's law | Chunk large binders into books → parts → chapters → scenes; avoid giant flat lists. | SHOULD |
| Jakob's law | Use familiar editor, document and screenplay conventions; do not invent keyboard behaviour casually. | MUST |
| Zeigarnik effect | Show unfinished chapters/scenes as navigable work, not guilt-inducing warnings. | SHOULD |
| Goal-gradient effect | Show progress toward a user-defined chapter or project goal. | SHOULD |
| Peak-end rule | Make first successful typing and first export exceptionally reliable. | MUST |
| Loss aversion | Make save state, backup and recovery visible; confirm destructive actions. | MUST |
| Progressive disclosure | Reveal advanced layout, revision and screenplay tools when relevant. | MUST |
| Recognition over recall | Use visible element labels, autocomplete and contextual actions. | MUST |
| Habit loops | Offer "Continue writing" and reopen the last active project. | SHOULD |
| Streak psychology | Streaks are opt-in, private and forgiving; never use shame, red failure states or loss framing. | COULD |
| Language switching cost | Preserve mixed Kannada/English composition and make input switching reversible. | MUST |

### 1.3 Kannada–English composition

A bilingual sentence may naturally contain Kannada grammar, English product
names and borrowed technical vocabulary. Do not force a writer to classify
every token before typing.

- Keep transliteration local and non-blocking; suggestions must never steal editor focus.
- Allow an English run/word to be entered without changing the entire document language.
- Preserve composition buffer, punctuation, caret and undo history when switching input mode.
- Learn accepted words locally and transparently; provide "undo conversion", "always keep this word" and reset-learning controls.
- Never auto-correct a completed Kannada word without explicit acceptance.

### 1.4 Personas and jobs-to-be-done

| Persona | Primary job-to-be-done | Top needs | Priority implication |
|---|---|---|---|
| Kannada novelist | When I have an idea, help me draft and organise a long manuscript without losing flow. | Chapters, page layout, safe autosave, notes, export. | MUST: book editor and project safety. |
| Film / TV screenwriter | When I write a scene, let me move between action, character and dialogue at screenplay speed. | Tab/Enter flow, autocomplete, pagination, Fountain/FDX. | MUST: screenplay grammar and export. |
| Theatre playwright | When I structure a play, help me manage acts, scenes, dialogue and stage directions. | Play-specific elements, cast list, cues, rehearsal-friendly PDF. | SHOULD: stage-play mode. |
| Student / first-time writer | When I open the app, help me start without learning a complex tool. | Templates, plain language, examples, undo and recovery. | MUST: 60-second first value. |
| Series creator / showrunner | When I develop multiple episodes, keep characters, arcs and continuity connected. | Season/episode binder, series bible, character relationships. | SHOULD: series organisation; later advanced bible. |

### 1.5 Trust signals

- Persistent save indicator with explicit states: **Saving…**, **Saved locally**, **Offline — changes saved** and **Attention required**.
- Never display "Saved" until the durable write has completed; distinguish browser persistence from an external backup.
- Crash recovery that opens a recoverable copy and explains the timestamp and source.
- One-click project backup and restore; show the last backup date and file location where supported.
- No manuscript telemetry, remote AI processing or cloud sync without informed opt-in.
- Portable, documented `.kbook` format; clear export paths to DOCX, PDF, Fountain and FDX where supported.
- Destructive actions require confirmation and offer undo or recovery where technically possible.

---

## Part 2 — Design language

### 2.1 Personality and cultural direction

Literary, calm, precise, warm and quietly confident. It should feel like a
well-made writing desk, not a festival poster or a government form.

| Do | Avoid | Priority |
|---|---|---|
| Use paper, ink, restrained accent colours and strong Kannada typography. | Decorative motifs, temple silhouettes, flag colours or ornamental Kannada flourishes as default UI. | MUST |
| Use Kannada words naturally in language-specific workflows. | Translating every technical term awkwardly when bilingual users recognise the English term. | MUST |
| Let the manuscript carry cultural expression. | Cultural decoration competing with the writing surface. | MUST |
| Offer Kannada-first onboarding and English UI labels as a choice. | Assuming all Kannada writers have identical language fluency. | SHOULD |

### 2.2 Typography

Use a high-quality Kannada font with reliable shaping and a neutral Latin
companion. Validate actual rendered glyphs across Chrome, Firefox, Safari and
exported PDF — not just font specimens.

| Role | Suggested direction | Starting specification | Priority |
|---|---|---|---|
| Kannada manuscript | Noto Serif Kannada or Noto Sans Kannada; test additional licensed literary faces. | Book body 11.5–12.5 pt; line-height 1.55–1.7. | MUST |
| Latin manuscript | Source Serif 4 / Georgia for literary pages; Inter for UI. | Match perceived x-height and visual weight. | SHOULD |
| UI text | Noto Sans Kannada + Inter, system fallback. | 13–14 px; line-height 1.45–1.55. | MUST |
| Chapter titles | Kannada display face with clear conjuncts. | 22–30 pt depending on trim size. | SHOULD |
| Metadata | UI sans; restrained weight. | 11–12 px. | SHOULD |

Kannada-specific checks: vowel signs above and below the baseline must not
clip; conjuncts such as ಕ್ಷ and ತ್ತ must shape correctly; anusvara/visarga,
ottakshara clusters, punctuation and mixed Latin numerals must survive line
wrapping. Never set a tight fixed line box. Test font fallback and PDF
embedding.

### 2.3 Colour system

| Token | Light | Dark | Use / priority |
|---|---|---|---|
| Canvas | `#F3F1EB` | `#17191C` | Application background; SHOULD |
| Paper | `#FFFDF8` | `#22262B` | Writing page; MUST |
| Text primary | `#252522` | `#F1F0EA` | Body text; MUST |
| Text secondary | `#686862` | `#B6B7B2` | Metadata; MUST |
| Border | `#D8D5CC` | `#3B4046` | Dividers; MUST |
| Accent | `#286B66` | `#78B9AE` | Primary actions and focus; MUST |
| Accent subtle | `#E2EFEB` | `#263C39` | Selected/hover surfaces; SHOULD |
| Warning | `#8A5A16` | `#E4B65D` | Unsaved/error attention; MUST |
| Danger | `#A33A35` | `#E58A83` | Destructive actions; MUST |
| Highlight yellow | `#F7E8A5` | `#665A32` | User annotation; SHOULD |
| Highlight green | `#D7EAD8` | `#355640` | User annotation; SHOULD |
| Highlight blue | `#DCE8F5` | `#354B65` | User annotation; SHOULD |
| Highlight pink | `#F2DDE5` | `#654351` | User annotation; SHOULD |

Contrast: WCAG 2.2 AA — 4.5:1 for normal text, 3:1 for large text and
meaningful UI graphics/focus indicators. Do not communicate status by colour
alone. Validate every actual foreground/background pairing, including
highlights and disabled states.

### 2.4 Layout, iconography, motion and sound

| System | Recommendation | Priority |
|---|---|---|
| Spacing | 4 px base grid; common spacing 4, 8, 12, 16, 24, 32, 48 px. | MUST |
| Radius | 4 px controls, 8 px cards/popovers, 12 px dialogs; avoid overly rounded playful UI. | SHOULD |
| Elevation | Use subtle borders first; shadows only for floating menus and dialogs. | SHOULD |
| Icons | Consistent 1.75–2 px stroke; pair unfamiliar icons with labels; never rely on icon-only critical actions. | MUST |
| Motion | 120–180 ms for hover/focus; 160–220 ms for popovers; respect reduced-motion. | SHOULD |
| Sound | Off by default. No typing, save or achievement sounds. Optional subtle audio only for explicit accessibility needs. | MUST |
| Paper | Realistic page colour, trim, margins and gutter; keep surrounding canvas visually quiet. | MUST |

### 2.5 Bilingual UI and numbers

Use a language preference for application chrome independently from
manuscript language (example: "ಹೊಸ ಪುಸ್ತಕ / New Book"). Do not duplicate every
label in two languages in dense toolbars. Use Kannada digits only when the
writer explicitly selects them for manuscript content or publishing style; use
English digits in technical metadata, word counts and default screenplay scene
numbers. Never silently convert digits.

### 2.6 Design tokens

| Token family | Example tokens | Priority |
|---|---|---|
| Colour | color.canvas, color.paper, color.text.primary, color.text.muted, color.border, color.accent, color.warning, color.danger, color.highlight.* | MUST |
| Typography | font.ui.kn, font.ui.latin, font.body.kn, font.body.latin, font.display.kn; type.size.*; type.leading.* | MUST |
| Spacing | space.1=4px, space.2=8px, space.3=12px, space.4=16px, space.6=24px, space.8=32px | MUST |
| Radius | radius.control=4px, radius.surface=8px, radius.dialog=12px | SHOULD |
| Elevation | elevation.menu, elevation.dialog; prefer border-first surfaces | SHOULD |
| Motion | motion.fast=120ms, motion.normal=180ms, motion.slow=220ms; easing.standard | SHOULD |
| Layout | page.width, page.height, page.margin.*, page.gutter, panel.width.* | MUST |

---

## Part 3 — UX and interaction design

### 3.1 Information architecture

| Mode | Primary hierarchy | Main screens | Priority |
|---|---|---|---|
| Book | Project → Part (optional) → Chapter → Section → Block | Library, editor, binder, notes, comments, export/print setup. | MUST |
| Screenplay | Project → Draft → Scene → Elements | Screenplay editor, scene navigator, character list, title page, reports/export. | MUST |
| Stage play | Play → Act → Scene → Beat / cue | Play editor, cast, stage directions, cue list, rehearsal/print view. | SHOULD |
| Series | Series → Season → Episode → Scene | Series overview, episode editor, series bible, character/arc continuity. | SHOULD |

Use one shared project shell and editor foundation. Modes change the document
grammar, navigation and export rules — not create four unrelated applications.

### 3.2 First-run onboarding: value within 60 seconds

| Time | Experience | Success condition | Priority |
|---|---|---|---|
| 0–10 s | Choose "Write a book" or "Write a screenplay"; offer "Start blank" and a sample. | User understands the two core paths. | MUST |
| 10–20 s | Open a clean, preconfigured Kannada page or screenplay page. | No settings wizard. | MUST |
| 20–40 s | User types phonetic Kannada; suggestion appears at caret; Space accepts. | First successful Kannada sentence. | MUST |
| 40–50 s | Show save state and where the local project is stored. | User trusts the work is retained. | MUST |
| 50–60 s | Offer one contextual next step: add chapter or next screenplay element. | User continues writing. | SHOULD |

Empty state: one sentence, one primary action and one optional sample. Avoid a
dashboard full of blank cards, feature tours and account creation.
