<p align="center">
  <img src="assets/icon-256.png" alt="Figma WordPress Optimizer icon" width="128" height="128" />
</p>

<h1 align="center">Figma WordPress Optimizer — V19</h1>

<p align="center">
  <img alt="version" src="https://img.shields.io/badge/version-1.2.0-2563eb">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-16a34a">
  <img alt="figma api" src="https://img.shields.io/badge/Figma%20API-1.0.0-7c3aed">
  <img alt="network" src="https://img.shields.io/badge/network-offline-6b7280">
</p>

A Figma plugin that audits designs against a WordPress conversion SOP (Standard Operating Procedure), creates and manages color and text styles, runs an offline spelling/grammar pass, and applies one-click automated fixes to prepare files for handoff.

---

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Plugin Window](#plugin-window)
- [How to Use](#how-to-use)
- [Audit Checks](#audit-checks)
- [Colors](#colors)
- [Typography](#typography)
- [Spelling & Grammar](#spelling--grammar)
- [Automated Actions](#automated-actions)
- [Issue Categories](#issue-categories)
- [Scope](#scope)
- [Issue Management](#issue-management)
- [Smart Detection Logic](#smart-detection-logic)
- [Blocked vs Actionable Issues](#blocked-vs-actionable-issues)
- [Architecture](#architecture)
- [File Structure](#file-structure)
- [Known Limitations](#known-limitations)
- [FAQ](#faq)
- [Troubleshooting](#troubleshooting)
- [Changelog](#changelog)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Credits & Acknowledgements](#credits--acknowledgements)

---

## Overview

The plugin scans the selected frame and flags structural, stylistic, typographic, and export-readiness issues that would cause friction when converting designs to WordPress themes or blocks. After auditing, it offers one-click automated fixes for issues it can safely resolve.

The **Colors** and **Typography** tabs cover style management for both kinds of work:

- **Existing designs** — scan a frame to find unlinked colors and text, then create or apply the right styles in one click.
- **New designs** — generate a color palette (from an image or by hand) and a full type scale before you start designing.

**Plugin metadata:**

| Field | Value |
|---|---|
| Name | Figma WordPress Optimizer |
| Version | 1.2.0 |
| Figma API | 1.0.0 |
| Editor type | Figma (design files only) |
| Document access | dynamic-page |
| Network access | none (fully offline) |
| UI size | 760 × 860 px |
| Tabs | Audit · Spelling & Grammar · Colors · Typography |

---

## Installation

This is a private/local plugin. It is not published to the Figma Community.

1. Open Figma Desktop (required for local plugin development).
2. Go to **Plugins → Development → Import plugin from manifest…**
3. Select the `manifest.json` file from this folder.
4. The plugin will appear under **Plugins → Development → Figma WordPress Optimizer v19**.

---

## Plugin Window

The plugin panel is divided into these sections, top to bottom:

| Section | Description |
|---|---|
| Header | Plugin name, one-line description, and tab bar |
| Tab bar | Switch between **Audit**, **Spelling & Grammar**, **Colors**, and **Typography**. Colors and Typography scan results start with a toolbar: **Generate … Styles** then **Re-Scan**. |
| Toolbar | 8 audit action buttons (Audit tab) |
| Scope indicator | Shows whether the audit ran on the page or a selection |
| Progress bar | Live progress during audit (hidden when idle) |
| Message bar | Feedback after each action (e.g. "Renamed 12, skipped 3") |
| Stats grid | Stat cards, 6 columns, color-coded by category |
| Pill bar | Info pills, badges (total / actionable / shown / ignored), and the Reset Ignore list button |
| Issues list | Issues grouped into expandable, color-coded category sections with per-category "Ignore all" |
| Footer | Help text explaining shown/hidden counts + Close button |

---

## How to Use

### Typical workflow

1. Open the plugin via **Plugins → Development → Figma WordPress Optimizer v19**.
2. Select the frame (or component) you want to check. All scans work on the selection only.
3. Click **Run audit**. A progress bar shows live progress through nodes.
4. Review the stats grid and the issue groups below it.
5. For each issue group, use the **Focus** button to jump to the node in the canvas.
6. Use the action buttons in the toolbar to apply automated fixes.
7. Re-run the audit after each batch of fixes to see the updated count.
8. Use **Ignore** on any single issue, or **Ignore all** on an entire category, if it's intentional or out of scope for this handoff.
9. Switch to the **Colors** and **Typography** tabs and click **Scan** to link unlinked colors and text to styles, and merge duplicates.
10. Switch to the **Spelling & Grammar** tab to catch copy issues before handoff.

### Recommended fix order

1. Remove hidden layers (eliminates noise from subsequent checks)
2. Rename generic layers (improves readability for all other checks)
3. Convert buttons to Auto Layout
4. Make sections Auto Layout
5. Mark exportable assets
6. Flatten vectors
7. Outline strokes
8. Colors and Typography tabs: create & apply styles for unlinked colors and text, then merge duplicate styles
9. Address remaining font issues manually in Figma

---

## Audit Checks

The plugin runs **24 checks** on every node in scope, across **6 categories**. Each check produces issues with one of three severity levels: **high**, **medium**, or **low**.

### Accuracy & performance (added in V17, expanded V18)

| Issue type | Severity | Description | Condition |
|---|---|---|---|
| `text-overflow` | high | Text overflows its container — content will clip at runtime. | A `TEXT` node's bounding box extends beyond its parent container by more than 5px. |
| `auto-line-height` | medium | Text uses AUTO line-height — developers need an explicit value to implement accurately. | `TEXT` node has `lineHeight.unit === 'AUTO'`. |
| `missing-font` | high | Referenced font is not available — text will render with a fallback. | A `TEXT` node references a font family/style that fails `figma.loadFontAsync()`. |
| `section-overlap` | medium | One section overlaps another by a measurable amount. | Two consecutive top-level FRAME/COMPONENT/GROUP/SECTION nodes where the bottom edge of one overlaps the top edge of the next by more than 2px. |
| `section-spacing-inconsistency` | low | A section's padding differs from the dominant spacing pattern on the page. | Content-area padding on direct children of the selected frame deviates by more than 8px from the dominant (or secondary) pattern across 3+ sections. |
| `no-mobile-frame` | medium | No mobile frame found on this page — WordPress themes require responsive design for all breakpoints. | The page has a frame wider than 1024px but no frame ≤480px wide. |
| `multiple-fonts` | low | Multiple distinct font families detected — review and consolidate. | More than 2 unique font families are used across `TEXT` nodes in scope. |
| `interactive-no-states` | low | Component looks like a carousel/accordion/tabs/modal but has no state variants (hover, open, closed). | Node name matches an interactive-pattern (carousel, accordion, tabs, modal) but no child/sibling layer names indicate state variants. |

`auto-line-height`, `section-overlap`, and `no-mobile-frame` are listed under **Developer Handoff Notes** below the issue list rather than as errors.

### Structure and hierarchy

| Issue type | Severity | Description | Condition |
|---|---|---|---|
| `generic-name` | medium | Layer name is generic. Use a clear and descriptive name. | Name matches: Frame, Group, Rectangle, Text, Component, Instance (with optional trailing number), or a name from the generic set (frame, group, rectangle, vector, image, text, component, instance, line, polygon, ellipse, star, shape, copy). Vector-type nodes are exempt. |
| `deep-nesting` | medium | Hierarchy is deeply nested with wrapper-like containers. | The node itself or an ancestor chain contains 3+ consecutive "wrapper-like" containers (generic-named frames/groups, or names containing wrapper/inner/outer), OR depth ≥ 5 with a wrapper-like parent. |
| `background-layer` | low | Background may be better applied directly on the container. | A `RECTANGLE` child covers ≥90% of its parent's width and height, is not an image fill, and is not the only sibling. Apply the fill to the parent frame instead. |
| `empty-group` | medium | Empty group should be removed. | A `GROUP` node with zero children. |

### Styles and variables

| Issue type | Severity | Description | Condition |
|---|---|---|---|
| `missing-text-style` | high | Text is not linked to a text style or variable. | `TEXT` node has no `textStyleId` and no bound variables on any of: fontSize, fontFamily, fontWeight, letterSpacing, lineHeight, paragraphSpacing, fills, textRangeFills. |
| `missing-color-style` | high | Solid fill is not linked to a style or variable. | Node has at least one `SOLID` fill, no `fillStyleId`, and no bound variable on fills/fill/color at node level or paint level. |

### Buttons and sections

| Issue type | Severity | Description | Condition |
|---|---|---|---|
| `button-no-auto-layout` | high | Button should be built with an Auto Layout frame. | Node is identified as a likely button (see [Smart Detection Logic](#smart-detection-logic)) and does not use Auto Layout, and is not a direct child of an Auto Layout parent. |
| `section-no-auto-layout` | high | Section should use Auto Layout for stacking and responsive behavior. | Node is identified as a likely section (by name or structure), is not using Auto Layout, and none of its direct children use Auto Layout. |
| `fixed-height-section` | medium | Section appears to rely on a fixed height. Prefer content-driven height with padding. | Node is identified as a section, is of type FRAME/COMPONENT/SECTION, is not an Auto Layout frame, and has a height ≥ 240 px. |

### Assets and vectors

| Issue type | Severity | Description | Condition |
|---|---|---|---|
| `missing-export` | medium | Asset should be marked exportable. | Node is an exportable leaf (image fill, vector primitive, or small icon/logo group) and has no `exportSettings`. |
| `flatten-vectors` | low | Icon vector group may be flattened to reduce nested structure. | A FRAME, GROUP, or COMPONENT that is ≤64×64 px (or ≤150×150 px with an "icon"/"ico" name), containing ≥2 direct vector-like children (VECTOR, BOOLEAN_OPERATION, STAR, ELLIPSE, POLYGON, RECTANGLE). |
| `strokes-found` | low | Thin stroke may be better handled as a fill or dedicated separator asset. | Node has strokes and is NOT a container (FRAME/COMPONENT/SECTION), and is either a LINE, has a stroke weight ≤1 with minimal height/width, or is a decorative vector with stroke weight ≤1. |
| `image-fit-mode` | medium | Image fill uses Fit (letterboxing) or Crop (hard-to-replicate pan/zoom) instead of Fill. | A node has an `IMAGE` fill with `scaleMode` `FIT` or `CROP`. |

### Cleanup and separators

| Issue type | Severity | Description | Condition |
|---|---|---|---|
| `hidden-layer` | medium | Hidden layer should be removed before handoff. | `node.visible === false` |
| `line-object` | high | Avoid line objects for separators. Use borders on the relevant container instead. | `node.type === 'LINE'` |
| `mask-found` | high | Avoid masks where Image Fill can be used instead. | `node.isMask === true` |

Each issue card includes an expandable **"Why & how to fix"** panel with the rationale and recommended fix.

---

## Colors

The **Colors** tab opens on an entry screen with two choices: **Scan** (needs a selected frame) or **Generate Color Styles** (no selection needed).

### Scan — color audit

Scans every visible fill **and stroke** in the selected frame, **including layers inside component instances** (tagged *in component*). Results:

| Section | What it lists | Actions |
|---|---|---|
| Stat cards | Color styles in this file · styles from another file · detached colors (and layer count) · near-duplicate styles | Click a card to jump to its section |
| **Color Styles** | Local color styles used in the frame, with hex, opacity, and use count. Expand a row to see each layer (5 per page). | **Focus All**, **Delete** (asks first) |
| **Unlinked Colors → New Color** | Solid colors with no style and no matching style anywhere. Each gets an editable suggested name (e.g. `Brand / Blue`, `Text / Dark Gray`, `Neutral / White / 6%`). | **Create & Apply**, **Create & Apply All** |
| **Unlinked Colors → Matches Existing → Styles from this file** | Unlinked colors whose hex **and** opacity exactly match a local style. | **Apply Style**, **Apply All** |
| **Unlinked Colors → Matches Existing → Style from other file** | Colors that come from another Figma file — typical after copy-pasting between files. Figma keeps the link and shows the name in the fill panel, but the color isn't defined in this file. Covers both **color styles** and **color variables** from the other file (aliases are resolved to their final color), plus unlinked colors that match them. | **Create & Apply** (makes a local color style with the same name and color, then re-links the layers), **Create & Apply All** |
| **Needs manual fix** | Layers with several fills or strokes (e.g. image + color + gradients). A style replaces every paint, so these can't be linked automatically; each row explains what the layer has. | **Focus** |
| **Near-Duplicate Colors** | Local styles with the same opacity and practically the same color (CIE Lab ΔE < 3). Same color at a different opacity (e.g. White 100% / 20% / 8%) is listed separately as an *opacity variant* and never offered for merging — those are usually overlays. | **Merge colors →** (choose which style to keep), **Merge All** |

If a pasted style or variable has the same value as a local color style (same name preferred), it's treated as "from this file" so no duplicate is created. Color variables defined in this file count as linked and aren't listed.

### Generate Color Styles

Opens **Generate Color Styles from your brand assets** with two options:

- **Extract from image** — upload or drag in a JPG, PNG, or WebP. Colors are extracted offline (k-means clustering in Lab color space, up to 8 colors) and named by prominence: `Primary`, `Secondary`, `Accent`, `Tertiary`, with neutrals as `White` / `Light Gray` / `Gray` / `Dark Gray` / `Black` and a strong red as `Error`.
- **Create Color Palette** — build the palette by hand. Click a swatch for the color picker (saturation/brightness square, hue and opacity sliders, hex/% inputs, and an eyedropper where the browser supports it), or type hex codes directly.

Both screens share the same editable list: edit name, hex, and opacity; drag rows to reorder; delete rows; **+ Add New Color**; then **Create Color Styles**.

With **Add style guide to canvas** checked (the default), the plugin also places a **Style Guide / Colors** frame to the right of your content — one swatch card per style (linked to the style), with its name, hex and opacity — then selects and zooms to it.

## Typography

The **Typography** tab works the same way: **Scan** or **Generate Text Styles**.

### Scan — text audit

Text layers are grouped by font family, weight, size, line height, and letter spacing.

| Section | What it lists | Actions |
|---|---|---|
| Stat cards | Text styles in this file · styles from another file · unlinked text (and layers) · duplicate styles · fonts (families, sizes) | Click to jump |
| **Text Styles** | Local text styles used in the frame | **Focus All**, **Delete** |
| **Unlinked text → New Text** | Combinations with no matching style. Suggested web-standard names: `H1`–`H6` for large sizes (≥22px), `Eyebrow` for small uppercase text, otherwise `Body Large`, `Body`, `Body Small` or `Caption` relative to the most common size in the frame, with the weight added when it isn't Regular (`Body Bold`, `Body Small Medium`). | **Create & Apply**, **Create & Apply All** |
| **Matches Existing → Styles from this file** | Unlinked text exactly matching a local style | **Apply Style**, **Apply All** |
| **Matches Existing → Styles from other file** | Text linked to (or matching) a style from another file | **Create & Apply**, **Create & Apply All** |
| **Duplicate Text Styles** | Local styles with identical font, weight, size, and line height | **Merge**, **Merge All** |
| **Fonts** | Font families and weights in use, plus a size-usage chart that flags one-off sizes | — |

Text layers that mix fonts or styles inside one layer are skipped and counted in a note.

### Generate Text Styles

Builds a modular type scale and creates it as text styles:

- **Scale** — 1.125 Major Second (default), 1.200 Minor Third, 1.250 Major Third, 1.333 Perfect Fourth, 1.618 Golden Ratio, or a **Custom** ratio.
- **Base Size** — default 16px.
- **Heading** and **Body** settings — font, weight, line height (%), letter spacing (%). Defaults: Inter Regular, 150%, 0%.
- **Font list** — searchable, filterable by **All Fonts / Google Fonts / Installed by You**. Weights come from the styles Figma actually has for the font.
- **Styles generated** — `H1`–`H6` use the heading settings; `Para`, `Body`, and `Label` use the body settings. Each step multiplies the previous rounded size (at 1.125: Label 14.22 · Body 16 · Para 18 · H6 20.25 · H5 22.78 · H4 25.63 · H3 28.83 · H2 32.43 · H1 36.48).
- **Per-style edits** — the pencil on any row opens an editor for name, typeface, size, weight, line height, letter spacing, and text case; **Save** keeps that override (marked with a dot) and **Reset to scale** removes it. The trash icon removes a row.
- **+ Add Text Style** — adds more web-standard styles, each placed on the scale with sensible defaults: *Headings* (Display, H1–H6, Subtitle, Quote), *Body* (Para, Body Large, Body, Body Medium, Body Bold, Body Small) and *UI & labels* (Eyebrow and Overline — uppercase with tracking, Label, Caption, Button, Link — underlined, Nav, Small). **Custom style…** adds a blank row and opens the editor.

With **Add style guide to canvas** checked (the default), a **Style Guide / Typography** frame is placed on the canvas with a sample line for every style (linked to the style) and its font, size and line height.

The preview can only render fonts installed on this computer. Other fonts preview in a fallback with a note — the generated styles still use the chosen font.

### How styles are applied

- **Selection only** for scans and apply actions. **Merge** and **Delete** affect the whole file (styles are shared by every page) and always ask first.
- A style replaces every paint on a layer, so layers with **more than one fill or stroke are skipped** (and labelled in the layer list) rather than losing paints.
- **Layers inside component instances** are styled on the main component when it lives in this file (so every instance updates), otherwise as an instance override. Locked layers are skipped.
- **Name conflicts** — when a new style's name already exists, you choose **Update existing** (changes that style everywhere) or **Keep both**.
- Each action is a **single undo step** (⌘Z), and the tab re-scans automatically afterwards.

---

## Spelling & Grammar

A fully offline text-quality engine accessible via the **Spelling & Grammar** tab:

- **Spelling** — a misspelling dictionary maps common errors to corrections; each result shows the misspelled word highlighted in its surrounding context.
- **Grammar** — pattern rules covering repeated words, lowercase "I" pronoun, missing space after sentence-ending punctuation, space before punctuation, missing space after comma, double punctuation, incomplete ellipsis, double spaces, and all-caps text (5+ chars).
- **Readability** — Flesch Reading Ease score with grade label (Very Easy → Difficult), plus total words, sentence count, and average words-per-sentence metrics.
- **Long-sentence detection** — flags individual text layers where any sentence exceeds 30 words.
- All analysis runs entirely in the plugin iframe — no text leaves Figma.

---

## Automated Actions

The toolbar exposes 8 actions on the Audit tab. All actions re-run the audit after completing so the stats and issue list stay current.

### Run audit

Scans all nodes in scope and builds the issue report. Respects current selection as scope if anything is selected; otherwise scans the entire page. Emits live progress updates every 120 nodes.

### Rename generic layers

Targets nodes flagged as `generic-name`. Infers a meaningful replacement name using this priority order:

1. **TEXT node** — uses the actual character content (truncated to 32 chars with ellipsis)
2. **Button-like node** — uses the first visible text child + " Button" suffix
3. **Section / FRAME / GROUP / COMPONENT / SECTION** — scans visible text children, sorts by font size (largest first, then top-to-bottom), strips common filler phrases, limits to 4 words, appends " Section" if the label doesn't already end with "section"
4. **RECTANGLE with image fill** — "Image"
5. **VECTOR / BOOLEAN_OPERATION** — "Icon"
6. **LINE** — "Divider"
7. **GROUP** — "Content Group"
8. **FRAME** — "Content Frame"
9. **COMPONENT** — "Component Block"
10. Fallback — title-cased node type

Nodes inside instances, or locked nodes, are skipped with a reason.

### Remove hidden layers

Targets nodes flagged as `hidden-layer`. Removes them deepest-first (sorted by layer path depth, descending) to avoid parent-removal errors. Nodes inside instances or locked are skipped.

### Mark exportable assets

Targets nodes flagged as `missing-export`. Automatically selects the correct export format:

- **PNG @2x** — nodes with image fills, or names containing image/photo/hero/banner/thumbnail
- **SVG** — vector nodes (VECTOR, BOOLEAN_OPERATION, STAR, ELLIPSE, POLYGON, LINE), groups containing only vectors, or names containing icon/logo/illustration/graphic

If no audit results are available, re-runs `gatherExportCandidates` on the current scope.

### Convert buttons to Auto Layout

Targets nodes flagged as `button-no-auto-layout`.

- **FRAME or COMPONENT** — sets `layoutMode: HORIZONTAL`, centers on both axes, applies minimum 8px item spacing, minimum 16px horizontal padding, minimum 10px vertical padding.
- **GROUP** — creates a new FRAME, transfers all non-background children into it, copies visual style from any background rectangle found inside the group, then removes the original rectangle and group.

### Flatten selected vectors

Targets nodes flagged as `flatten-vectors`, or uses the current selection if anything is selected.

Groups vector siblings into "buckets" by parent node, then calls `figma.flatten()` on each bucket. Handles the case where the selection itself is the icon container.

### Outline strokes

Outlines only the thin separator/decorative strokes flagged as `strokes-found` (or, before any audit has run, the same thin-stroke candidates in the selection). Container borders on frames, components, and sections — cards, inputs — are never outlined. Skips nodes inside instances or locked nodes.

### Make Auto Layout

Targets nodes flagged as `section-no-auto-layout`, or the current selection if anything is selected.

- **FRAME or COMPONENT** — applies smart Auto Layout (see [Smart Detection Logic](#smart-detection-logic)) in-place.
- **GROUP** — creates a new FRAME at the same position and size, moves all children into it, applies smart Auto Layout, then removes the original group.

Reports how many sections received vertical vs horizontal layout in the message bar.

---

## Issue Categories

Issues are grouped into **6 collapsible sections** in the UI, each with its own accent color used consistently for its dot, stat numbers, and count badge:

| Category key | Display label | Color | Issue types |
|---|---|---|---|
| `accuracy` | Accuracy & performance | Red | text-overflow, auto-line-height, missing-font, section-overlap, no-mobile-frame, interactive-no-states, section-spacing-inconsistency |
| `structure` | Structure & hierarchy | Blue | generic-name, deep-nesting, background-layer |
| `styles` | Styles & variables | Violet | missing-text-style, missing-color-style, multiple-fonts |
| `buttons` | Buttons & sections | Amber | button-no-auto-layout, section-no-auto-layout, fixed-height-section |
| `assets` | Assets & vectors | Green | missing-export, flatten-vectors, strokes-found, image-fit-mode |
| `cleanup` | Cleanup & separators | Gray | hidden-layer, line-object, mask-found, empty-group |

Each category group is rendered as a collapsible section (open by default) with a colored dot, a count badge, and an **Ignore all** button in its header.

---

## Scope

Every tab works on the **current selection** only — select a frame or component first. Scan buttons stay disabled until something is selected.

The Colors and Typography tabs remember the frame they scanned: after **Focus** moves the selection to a single layer, **Re-Scan** and post-action refreshes still cover the original frame. Select a different frame and press **Re-Scan** to switch.

---

## Issue Management

### Per-issue Ignore

Each issue card has an **Ignore** button. Clicking it:

1. Adds the `nodeId:issueType` key to the UI's `ignoredAuditKeys` set and removes just that issue card from the list (instant, no re-audit).
2. Sends an `ignore-issue` message to the plugin backend, which adds the same key to the session-level `ignoredIssueKeys` Set.
3. Summary badges (total / actionable / shown / ignored) update immediately.

Only the specific issue that was ignored is affected — other issues for the same node, or the same issue type on other nodes, remain visible.

### Ignore all (per category)

Each category header has an **Ignore all** button. Clicking it ignores every currently-visible issue in that category only:

1. All issue keys in that category are added to `ignoredAuditKeys` and the entire category section is removed from the list.
2. An `ignore-issues-bulk` message sends all affected `{ nodeId, issueType }` pairs to the backend in one batch, which adds them to `ignoredIssueKeys`.

Issues in other categories are unaffected.

### Reset Ignore list

The **Reset Ignore list** button (in the pill bar) sends `clear-ignored` to the backend, which clears `ignoredIssueKeys` and re-runs the audit.

Ignored issues persist for the duration of the plugin session only. They are cleared when the plugin is closed or when **Reset Ignore list** is clicked.

### Focus

The **Focus** button on each issue card selects the flagged node and calls `figma.viewport.scrollAndZoomIntoView()` to navigate the canvas to it.

---

## Smart Detection Logic

### Button detection (`isLikelyButton`)

A node is treated as a button if:
- Its name contains "button", "btn", or "cta" (case-insensitive), **or**
- It is a FRAME, COMPONENT, INSTANCE, or GROUP with:
  - At least 1 direct TEXT child
  - 6 or fewer total children
  - Width ≤ 420 px
  - Height ≤ 140 px
  - Is not also detected as a section

### Section detection (`shouldTreatAsSection`)

A node is treated as a section if either of these is true:

**By name (`isLikelySection`):**
- `node.type === 'SECTION'`, or
- Name contains: section, hero, footer, header, testimonial, feature, content

**By structure (`isLikelySectionByStructure`):**
- Type is FRAME, GROUP, COMPONENT, or INSTANCE
- Is a direct child of the page (`parent.type === 'PAGE'`) **and** height ≥ 180 px, **or**
- Width ≥ 70% of parent width **and** height ≥ 180 px **and** has ≥ 2 children

### Auto Layout axis inference (`inferAutoLayoutAxis`)

Compares the spread of child center-points and the median step size between sorted children on each axis. Returns `HORIZONTAL` if:
- Horizontal spread is > 1.25× vertical spread **and** median child width is > 0.6× median height, **or**
- Median X step is > 1.25× median Y step **and** horizontal spread > median child width

Otherwise returns `VERTICAL`.

### Item spacing inference (`inferItemSpacing`)

Sorts children along the inferred axis, computes gap between each consecutive pair's edge, and returns the median gap value (clamped to [0, 499]).

### Export format selection (`getExportSpec`)

| Condition | Format |
|---|---|
| Image-like (image fill or name contains image/photo/hero/banner/thumbnail) | PNG, 2× scale |
| Vector-like (vector node, vector container, or name matches icon/logo/illustration/graphic) | SVG, contentsOnly |
| Anything else | PNG, 2× scale |

---

## Blocked vs Actionable Issues

Every issue that has an associated automated action is checked against `getBlockedReason` before being marked actionable.

An issue is **blocked** (not actionable) when:
- The node no longer exists
- The node is locked
- The node is inside a Figma instance (most structural edits are blocked by Figma in instances)
- The specific action has additional type-level restrictions (e.g. INSTANCE nodes cannot be converted as buttons; vectors inside instances cannot be flattened)

Blocked issues show a yellow "Blocked: [reason]" label. Actionable issues show a green "Actionable" label. The stats grid shows the actionable sub-count for each category beneath the total count.

---

## Architecture

The plugin follows the standard Figma plugin two-process model:

```
┌─────────────────────────────────────────┐
│  Figma sandbox (code.js)                │
│  ─ Reads/writes Figma document          │
│  ─ Runs audits, executes fixes          │
│  ─ Communicates via figma.ui.postMessage│
└────────────┬────────────────────────────┘
             │ pluginMessage (structured messages)
┌────────────▼────────────────────────────┐
│  WebView iframe (ui.html)               │
│  ─ Renders stats, issue cards, tabs     │
│  ─ Handles user interactions            │
│  ─ Sends action requests to sandbox     │
└─────────────────────────────────────────┘
```

### Message types (sandbox → UI)

| Type | Payload | Description |
|---|---|---|
| `busy` | `{ stage }` | Disables buttons, shows indeterminate progress |
| `progress` | `{ stage, completed, total }` | Updates progress bar during audit |
| `idle` | — | Re-enables buttons, hides progress bar |
| `report` | `{ report, extraMessage }` | Full audit results; triggers a re-render |
| `error` | `{ message }` | Shows error state in the UI |
| `color-scan-result` / `text-scan-result` | `{ data }` | Full Colors / Typography scan (rows, summary, duplicates) |
| `style-progress` | `{ scope, completed, total }` | Scan progress for the Colors / Typography tab |
| `style-action-done` | `{ scope, requestId, message, tone }` | Result of a style action (a re-scan follows, except for Generate) |
| `style-conflict` | `{ scope, requestId, names }` | Style names already exist — UI asks Update existing / Keep both and resends |
| `style-error` | `{ scope, requestId, message }` | A style scan or action failed |
| `fonts-list` | `{ fonts: [{ family, styles }] }` | Fonts available in Figma, for the type-scale generator |

### Message types (UI → sandbox)

| Type | Payload | Description |
|---|---|---|
| `run-audit` | — | Triggers `collectIssues()` and sends a report |
| `rename-generic` | — | Runs `renameGenericLayers()` then re-audits |
| `remove-hidden` | — | Runs `removeHiddenLayers()` then re-audits |
| `add-export-settings` | — | Runs `addExportSettings()` then re-audits |
| `flatten-vectors` | — | Runs `flattenSelectedVectorGroups()` then re-audits |
| `convert-buttons` | — | Runs `convertButtonsToAutoLayout()` then re-audits |
| `outline-strokes` | — | Runs `outlineStrokesInSelection()` then re-audits |
| `section-auto-layout` | — | Runs `makeSectionsAutoLayout()` then re-audits |
| `focus-node` | `{ nodeId }` | Selects node and zooms to it |
| `ignore-issue` | `{ nodeId, issueType }` | Adds a single issue key to the ignore set |
| `ignore-issues-bulk` | `{ pairs: [{ nodeId, issueType }] }` | Adds multiple issue keys to the ignore set (used by "Ignore all") |
| `clear-ignored` | — | Clears ignore set and re-audits |
| `style-scan` | `{ kind: 'paint' \| 'text', fresh }` | Scans colors or text in the selection |
| `style-rows` | `{ kind, action: 'apply' \| 'create' \| 'copy', rows: [{ key, name }], conflict? }` | Acts on scan rows by key (sandbox keeps the layer lists) |
| `style-create` | `{ kind, items, conflict? }` | Generate flows: creates color styles from a palette or text styles from a type scale |
| `style-merge` | `{ kind, groups: [{ keepId, removeIds }] }` | Re-links every layer in the file to the kept style, then deletes the others |
| `style-delete` | `{ kind, styleId }` | Deletes a local style |
| `list-fonts` | — | Requests the font list |
| `focus-nodes` | `{ nodeIds }` | Selects and zooms to several layers (Focus All) |
| `close` | — | Calls `figma.closePlugin()` |

### Session state (sandbox globals)

| Variable | Type | Purpose |
|---|---|---|
| `lastAuditNodeIds` | `string[]` | IDs of all nodes from the most recent audit; used to scope action targets |
| `lastAuditIssueTypesByNode` | `Map<string, string[]>` | Issue types per node ID from the last audit |
| `ignoredIssueKeys` | `Set<string>` | Session-level ignored `"nodeId:issueType"` keys |
| `lastUserSelectionIds` | `string[]` | Selection snapshot before each action, used to restore selection after ignore operations |
| `lastColorScan` / `lastTextScan` | `{ data, byKey }` | Most recent Colors / Typography scan, so UI actions can refer to rows by key |
| `lastColorRootIds` / `lastTextRootIds` | `string[]` | Frames last scanned by each tab, reused by Re-Scan after Focus |

### Client-side state (UI globals)

| Variable | Type | Purpose |
|---|---|---|
| `ignoredAuditKeys` | `Set<string>` | Mirrors `ignoredIssueKeys` for instant UI filtering without a re-audit |
| `lastIssues` | `Array` | Most recent full issue list, used to recompute summary badges as issues are ignored |

---

## File Structure

```
figma-wordpress-optimizer/
├── manifest.json     — Figma plugin manifest (name, entry points, permissions)
├── code.js           — Plugin sandbox: audit engine, color/text style scans and actions, fix actions, message handler
├── ui.html           — Plugin UI: HTML + CSS + inline JS (Audit, Spelling & Grammar, Colors, Typography tabs)
├── assets/           — Icon and branding assets (icon-512.png, icon-256.png, icon-128.png)
├── README.md         — This file
├── CHANGELOG.md      — Version history
├── CONTRIBUTING.md   — Contribution guidelines
└── LICENSE           — MIT license
```

---

## Known Limitations

- **Instance edits are blocked.** Figma's API does not allow editing nodes inside instances without first detaching them. Most structural fixes (rename, remove, convert, add export settings, auto layout) will be skipped for nodes inside instances.
- **Mixed fills/styles.** Nodes with `figma.mixed` fills or style IDs are treated conservatively and do not raise false positives for missing-style checks.
- **No persistence.** Ignored issues are session-only and reset when the plugin is closed.
- **Undo grouping (Audit tab).** Audit fix actions are a series of individual node mutations, so Figma's undo stack shows multiple steps. Colors and Typography actions are committed as a single undo step each.
- **Multi-paint layers.** A style replaces every fill or stroke on a layer, so layers with more than one paint are skipped by Colors actions and must be styled manually.
- **Mixed text.** Text layers that mix fonts/sizes inside one layer are skipped by Typography actions.
- **Font preview.** The type-scale preview renders only fonts installed on this computer; others use a fallback (the created styles are unaffected). The Google Fonts list is a bundled snapshot.
- **Auto layout padding is not inferred.** The "Make Auto Layout" action sets `itemSpacing` from child positions but applies zero padding. Padding must be set manually after conversion.
- **Button group conversion is lossy.** When converting a GROUP-based button, only the visual style of a detected background rectangle is transferred to the new frame. Other styling on the group itself is not preserved.
- **Export settings conflict detection.** The plugin skips nodes that already have any export settings, even if those settings are incomplete or incorrect.
- **Font availability checks depend on locally-installed fonts.** The `missing-font` check reflects font availability on the machine running Figma at scan time.
- **Network access is disabled.** The plugin runs entirely offline. No external API calls are made, and no design data ever leaves Figma.

---

## FAQ

**Does this plugin send my designs anywhere?**
No. `networkAccess` is set to `none` in the manifest — the plugin cannot make network requests. All audits, spelling/grammar checks, and typography analysis run locally inside the Figma plugin sandbox/iframe.

**Will "Ignore" or "Ignore all" permanently hide an issue?**
Only for the current plugin session. Ignored issues reset when you close the plugin, or immediately if you click **Reset Ignore list**.

**Why is an issue marked "Blocked" instead of "Actionable"?**
The node is either locked, inside a component instance, or no longer exists. See [Blocked vs Actionable Issues](#blocked-vs-actionable-issues).

**Can I run this on just part of my page?**
Yes — select one or more frames/layers before running the audit, and the scope automatically narrows to the selection and its descendants.

**Does merging styles affect components and instances?**
Merging re-links every layer in the file that uses the removed style, then deletes it. Layers inside instances can't be edited directly; they follow their main component, which is re-linked like any other layer.

**What is a "style from other file"?**
When you copy layers from another Figma file, they keep a link to that file's style. Figma shows the style name, but it isn't one of this file's styles. **Create & Apply** makes a local copy with the same name and values and re-links the layers to it.

**Why does `missing-font` flag a font I have installed?**
Figma loads fonts asynchronously per-document; if the font failed to load at scan time (e.g. it's a custom/team font not yet synced), it will be flagged. Re-run the audit after the font finishes loading.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Plugin doesn't appear under **Plugins → Development** | Make sure you imported `manifest.json` (not `code.js` or `ui.html`) via **Import plugin from manifest…**, and that you're using Figma Desktop. |
| "Run audit" button stays disabled | Wait for any in-progress action to finish — all toolbar buttons are disabled together while a scan or fix is running (`busy` state). |
| Audit seems to hang on large files | Very large pages can take longer; progress updates fire every 120 nodes. If it truly stalls, close and reopen the plugin and try auditing a selection instead of the whole page. |
| An automated fix skipped some nodes | Check the message bar — it reports skipped counts. Common reasons: node is locked or inside an instance (see [Known Limitations](#known-limitations)). |
| Ignored issues reappear after reopening the plugin | Expected — the ignore list is session-only by design (see [Known Limitations](#known-limitations)). |
| Colors / Typography tab shows no results | Select a frame and click **Scan** — these tabs don't run with the main audit. |
| "Create & Apply" skipped some layers | Check the toast — locked layers, layers inside instances, and layers with more than one fill/stroke are skipped. |
| A font is missing from the Generate Text Styles list | The list comes from Figma's available fonts. Install the font and restart Figma. |

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full version history.

**Latest: v1.2.0 (V19)**
- Typography & Colors split into separate **Colors** and **Typography** tabs
- Scan: create & apply styles for unlinked colors/text, apply matching styles, copy styles from other files, delete and merge styles
- Generate: color styles from an image or a hand-built palette (with color picker); text styles from a modular type scale

---

## Roadmap

- **Auto layout padding inference** — Detect inner spacing from child bounds and apply it automatically during section/button conversion.
- **Undo grouping** — Wrap Audit fix operations so each appears as a single undo step (Colors and Typography already do).
- **Persistent ignore list** — Store ignored keys in `figma.clientStorage` so they survive plugin close/reopen.
- **Component and variable coverage** — Flag components that do not use variable bindings for spacing and color tokens.
- **Batch fix by category** — Extend "Ignore all" with "Fix all in category" where an automated action exists.
- **Export settings validation** — Detect existing export settings that use incorrect formats (e.g. PNG on icon-named nodes).
- **Accessibility checks** — Tap-target sizing and missing alt-text analogues, building on the new contrast badges.
- **Section width checks** — Flag sections exceeding standard WordPress container widths (e.g. 1200 px max-width).

---

## Contributing

Contributions, bug reports, and feature suggestions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on reporting issues and submitting pull requests.

---

## License

Released under the [MIT License](LICENSE).

---

## Credits & Acknowledgements

Built for designers and developers working on Figma-to-WordPress handoffs. Spelling/grammar dictionaries, readability scoring, and color/contrast utilities are implemented from scratch and run fully offline within the plugin.
