# Prakrut design system

The single source of UI for the app. It implements Part 2 of
[`docs/product-blueprint.md`](../../docs/product-blueprint.md). If this guide
and the blueprint disagree, the blueprint wins: update this folder to match.

```
design-system/
  tokens.css          colours, type, space, radius, motion, layers (light + dark)
  base.css            reset, focus ring, reduced motion, print rules
  index.js            the only import path for app code
  icons/              one stroke icon set (Icon.jsx, paths.jsx)
  components/         Button, IconButton, SegmentedControl, Field…, Menu…,
                      Panel…, Tabs, Surface, Toast, Toolbar…, Badge, Kbd, Wordmark
  hooks/              useAnchoredMenu (menu placement)
  theme/              useTheme (light / dark / match system)
```

```jsx
import { Button, MenuButton, MenuItem, Panel } from "../../design-system";
```

## Rules

1. **Tokens only.** Components never use raw hex values or pixel spacing outside the
   4 px grid. Need a new value? Add a semantic token to `tokens.css` for both themes.
2. **Writing comes first.** Chrome is quiet: borders before shadows; shadows only on
   menus, popovers and dialogs. The page is the brightest (light) or most defined
   (dark) surface.
3. **Seven primary actions at most** in the toolbar (Hick's law). Everything else
   goes in a labelled menu or the Binder.
4. **Labels for anything unfamiliar.** Icon-only buttons are allowed for well-known
   actions (undo, redo, close) and always carry `label` (accessible name and tooltip).
   Critical actions (Export, Save) always have text.
5. **Status is never colour alone.** Pair colour with an icon and words.
6. **Sentence case**, plain verbs, no all-caps labels, no emoji in UI.
7. **Touch targets** grow to 44 × 44 px on touch screens automatically (`pointer: coarse`).
8. **Motion** only answers an action (menus opening, panels sliding) and is removed
   with `prefers-reduced-motion`.
9. **No sound.**

## Tokens

| Family | Tokens |
|---|---|
| Colour | `--color-canvas`, `--color-chrome`, `--color-surface`, `--color-surface-sunken`, `--color-paper`, `--color-text`, `--color-text-muted`, `--color-text-subtle`, `--color-border`, `--color-border-strong`, `--color-accent`, `--color-accent-hover`, `--color-accent-subtle`, `--color-warning`, `--color-danger`, `--color-success`, `--color-highlight-{yellow,green,blue,pink}`, `--color-page-ink`, `--color-caret`, `--color-selection`, `--color-inverse*` |
| Type | `--font-ui`, `--font-body-kn`, `--font-body-latin`, `--font-display-kn`, `--text-xs…xl`, `--weight-*`, `--leading-*` |
| Space | `--space-1` (4px) … `--space-12` (48px) |
| Radius | `--radius-control` 4px, `--radius-surface` 8px, `--radius-dialog` 12px, `--radius-page` |
| Elevation | `--elevation-menu`, `--elevation-dialog`, `--shadow-page` |
| Motion | `--motion-fast` 120ms, `--motion-normal` 180ms, `--motion-slow` 220ms, `--easing-standard` |
| Size | `--control-sm`, `--control-md`, `--toolbar-height`, `--statusbar-height`, `--panel-width` |

Page geometry (`--page-width`, `--margin-*`, `--gutter`, `--font-size`…) comes from
the document's own settings, not from here (`settingsToCssVars`).

## Theme

`useTheme()` returns `{ choice, resolved, setChoice }` and writes
`<html data-theme>`. `index.html` applies the saved choice before first paint.
With "Match system" the attribute is removed and the OS setting applies live.
Printing always uses ink on white. Exports (PDF/DOCX) never read theme colours.

## Components

| Component | Use for |
|---|---|
| `Button` | Text actions. `variant`: `primary` (one per area), `secondary`, `ghost`, `danger`. `preserveSelection` keeps the editor selection when clicked. |
| `IconButton` | Well-known icon actions. Requires `label`; optional `shortcut`, `pressed`, `badge`. |
| `SegmentedControl` | One choice out of a few, always visible (paragraph style, alignment). |
| `Field`, `FieldRow`, `TextInput`, `TextArea`, `NumberInput`, `Select`, `Checkbox` | Forms. Use `<Field group>` around multi-button controls. |
| `MenuButton`, `MenuItem`, `MenuSeparator`, `MenuLabel` | Menus with arrow-key navigation. `MenuItem checked` = radio choice; add `toggle` for on/off. |
| `Panel`, `PanelHeader`, `PanelBody`, `PanelSection`, `EmptyState` | Side panels; they float over the page on narrow screens. |
| `Tabs` | Switching panel sections. |
| `Surface` | Positioned floating cards (popovers, suggestions). `tone="inverse"` for the selection bar. |
| `Toast` | A bottom message with actions (e.g. restore unsaved work). |
| `Toolbar`, `ToolbarGroup`, `ToolbarDivider`, `ToolbarSpacer` | Bars of controls. |
| `Badge`, `Kbd` | Counts; keyboard shortcuts. |
| `Icon` | 24px stroke icons. Add new artwork in `icons/paths.jsx`. |
| `Wordmark` | ಪ್ರಾಕೃತ in the Kannada display face. |
