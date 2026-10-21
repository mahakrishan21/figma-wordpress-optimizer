<p align="center">
  <img src="assets/icon-256.png" alt="Figma WordPress Optimizer icon" width="128" height="128" />
</p>

<h1 align="center">Figma WordPress Optimizer — V19</h1>

<p align="center">
  <img alt="version" src="https://img.shields.io/badge/version-1.3.0-2563eb">
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
- [Styles or variables](#styles-or-variables)
- [Build design system](#build-design-system)
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
| Version | 1.3.0 |
| Figma API | 1.0.0 |
| Editor type | Figma (design files only) |
| Document access | dynamic-page |
| Network access | none (fully offline) |
| UI size | 760 × 860 px (resizable: drag the right edge, bottom edge, or corner — 400–1200 × 400–960) |
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

Chrome that is always present, whichever tab you are on:

| Element | Description |
|---|---|
| Header | Plugin icon, name, one-line description, and an **i** button that opens the [rules reference popup](#rules-reference-popup) — all 24 audit rules grouped by category |
| Tab bar | **Audit** · **Spelling & Grammar** · **Colors** · **Typography** · **Build design system**. The strip wraps, so every tab stays reachable at the minimum window width |
| Toasts | Every status message, action result, warning and error slides in at the top of the panel and auto-dismisses; hovering pauses the timer |
| Footer | Help text that follows the active tab, the selection and the scan results, plus the **Close** button |
| Resize handles | Right edge, bottom edge, and bottom-right corner. The size is clamped to 400–1200 × 400–960 px |

The **Audit** tab moves through three panels:

| Panel | When it shows | Contents |
|---|---|---|
| **Empty** | Nothing selected | "Ready to audit your design" illustration and a disabled **Run Audit** button |
| **Ready** | A frame is selected, audit not yet run | "Frame ready to audit", the frame's name, **Run Audit**, and the **Create Duplicate Before Changes** checkbox |
| **Results** | After the first audit | Everything in the table below |

The results panel, top to bottom:

| Section | Description |
|---|---|
| Toolbar | **Run Audit** and **Duplicate & Run Audit**, then an *Automated Fixes* label and 7 fix buttons (Rename generic, Remove hidden, Mark exports, Auto Layout, Flatten vectors, Outline strokes, Make Auto Layout), then **Re-scan**. All of them disable together while any action runs. |
| Progress bar | Live progress during the audit, with a percentage (hidden when idle) |
| Stats grid | Stat cards, 6 columns, color-coded by category, collapsible. Clicking a card jumps to that category's accordion group. A scope badge sits in its header. |
| Pill bar | Info pills, badges (total / actionable / shown / ignored), and the **Reset Ignore list** button |
| Issues list | Issues grouped into expandable, color-coded category sections, each with **Ignore all** and a **Why & how to fix** panel per issue |
| Developer Handoff Notes | Plain-language notes for the issue types a developer needs told about rather than fixed in Figma (`auto-line-height`, `section-overlap`, `no-mobile-frame`) |

The **Colors** and **Typography** tabs each open on an entry screen (**Scan** / **Generate …**), and their scan results start with their own toolbar: **Generate … Styles** then **Re-Scan**.

### Rules reference popup

The **i** button in the header lists all 24 audit rules grouped by the 6 issue categories, so you can see what the audit looks for without running it. Click the backdrop or press Escape to close.

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
| Stat cards | Color styles in this file · **color variables in this file** · styles from another file · detached colors (and layer count) · near-duplicate styles | Click a card to jump to its section |
| **Color Styles** | Local color styles used in the frame, with hex, opacity, and use count. Expand a row to see each layer (5 per page). | **Focus All**, **Delete** (asks first) |
| **Color Variables** | Color variables defined in this file and used in the frame, listed the same way — name, hex, opacity, use count, expandable layer list. A frame using both styles and variables shows both sections, and a variable-bound color is not re-reported as unlinked. | **Focus All**, **Delete** (asks first) |
| **Unlinked Colors → New Color** | Solid colors with no style and no matching style anywhere. Each gets an editable suggested name (e.g. `Brand / Blue`, `Text / Dark Gray`, `Neutral / White / 6%`). | **Create & Apply**, **Create & Apply All** |
| **Unlinked Colors → Matches Existing → Styles from this file** | Unlinked colors whose hex **and** opacity exactly match a local style. | **Apply Style**, **Apply All** |
| **Unlinked Colors → Matches Existing → Style from other file** | Colors that come from another Figma file — typical after copy-pasting between files. Figma keeps the link and shows the name in the fill panel, but the color isn't defined in this file. Covers both **color styles** and **color variables** from the other file (aliases are resolved to their final color), plus unlinked colors that match them. | **Create & Apply** (makes a local color style with the same name and color, then re-links the layers), **Create & Apply All** |
| **Needs manual fix** | Layers with several fills or strokes (e.g. image + color + gradients). A style replaces every paint, so these can't be linked automatically; each row explains what the layer has. | **Focus** |
| **Near-Duplicate Colors** | Local styles with the same opacity and practically the same color (CIE Lab ΔE < 3). Same color at a different opacity (e.g. White 100% / 20% / 8%) is listed separately as an *opacity variant* and never offered for merging — those are usually overlays. | **Merge colors →** (choose which style to keep), **Merge All** |

If a pasted style or variable has the same value as a local color style (same name preferred), it's treated as "from this file" so no duplicate is created. Color variables defined in this file count as linked and aren't listed.

### Generate Color Styles

Opens **Generate Color Styles from your brand assets** with two options:

- **Extract from image** — get the image four ways: click **Upload Image**, **drag and drop** it anywhere in the plugin window, **paste** it with ⌘V / Ctrl+V, or — for artwork already in Figma — select the layer on the canvas and click **Use "<layer>"**, which exports it as a PNG and extracts from that. (Dragging a layer off the Figma canvas into the plugin isn't possible: plugin UI runs in a null-origin iframe, so Figma can't pass it drag data. The selection button is the route in. An image dragged from a browser tab carries a link, not a file, and the plugin is offline by design — it says so rather than failing quietly.) JPG, PNG and WebP are accepted; while you drag, the window dims and shows whether the file can be dropped.
  Colors are extracted offline and named by prominence: `Primary`, `Secondary`, `Accent`, `Tertiary`, with neutrals as `White` / `Light Gray` / `Gray` / `Dark Gray` / `Black` and a strong red as `Error`.
  **Every distinct color is returned — there is no limit and no count to set.** A 200-swatch image gives ~200 colors. The only thing that collapses two colors is perceptual distance: they must be within ΔE 4 *and* at the same opacity. Opacity is preserved, so the same color at 100% and 25% stays two separate entries. In a large image a color present in a single sampled pixel is treated as compression noise. The screen reports the total as read-only text.
  Beside **Change Image** there's **Change Frame**: select any frame on the canvas and extract from it.

  **Frames are read, not sampled.** The plugin walks the frame's node tree and takes the actual design values — every visible solid fill and stroke, plus the stops of any gradient — so a yellow frame with black text gives exactly two colors. Hidden layers, invisible paints and fully transparent paints contribute nothing. The exported PNG is only the thumbnail.

  **Uploaded images** have no design properties to read, so they are sampled. Three rules keep that honest:

  - **Exact values only.** Each color group keeps its most frequent exact pixel, so every hex reported genuinely occurs in the image — nothing is averaged into existence.
  - **Grouping scales with prominence.** A color covering ≥1% of the image is treated as a design color and merges only when nearly identical (ΔE 4). Rarer colors — where antialiasing and compression noise live — merge into their nearest neighbour at up to ΔE 22. Rare colors are folded into the color they are a variation of, never discarded to shrink the palette.
  - **Blends are recognised.** A color sitting on the line between two far more prominent colors is an antialiased or blended edge. Since the test requires it to fall strictly *between* two anchors, a genuinely distinct color is never removed.

  In practice: a yellow background with antialiased black text gives **2** colors, a flat three-color image gives **3**, a six-color illustration gives **8** (shapes, background and outline), while a gradient keeps ~19 and a photograph ~26. A lossy JPEG of a flat design may add one extra color, because the compression really did put it there — scan the frame, or use a PNG, for exact values.
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

**Text in more than one color** is handled fully: when different words or characters carry different colors, the Colors scan reads the layer run by run and reports each color separately, showing the text each one covers. Create & Apply then styles or binds **only those characters**, leaving the layer's other colors untouched. The layer is still counted once however many colors it holds.

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

### Styles or variables

The **Create** dropdown — **Styles** or **Variables** — is set independently for Colors and Typography. In each tab it appears on both the **Scan** toolbar and the **Generate** screen, sharing one setting.

On either scan, **Create & Apply** / **Create & Apply All** follow the choice. In Variables mode they create (or reuse) the variable — one COLOR variable, or the five typography variables for a text row — and bind it to the scanned layers rather than creating a style. **Apply Style** rows are unaffected, since they point at an existing style by design.

Each scan also lists the **variables from this file** used in the frame — *Color Variables* and *Text Variables* — alongside the style sections, with the same actions.

### Merging a style with a variable

When a style and a variable hold the same value, they're the same token stored twice. The scan reports them in the existing merge section — *Same value as a variable* under Near-Duplicate Colors, *Same values as a variable group* under Duplicate Text Styles — rather than only listing them separately.

The action follows the **Create** dropdown:

- **Variables** selected → **Link to variable**: the style is pointed at the variable, so one value drives both and editing the variable updates the style.
- **Styles** selected → **Link to style**: the layers bound to the variable are pointed at the style instead, and the row shows how many layers that is. A Figma variable can't reference a style, so in this direction the layers move rather than the variable.

Either way nothing is deleted and every layer keeps working (⌘Z undoes it). Colors match on hex and opacity; a text style counts only when **every** property it defines is held by a matching variable, so a partial match is left alone.

On the Colors scan, **Create & Apply** / **Create & Apply All** follow the choice: in Variables mode they create (or reuse) a color variable and bind it to the scanned layers — fills or strokes, whichever the row covers — rather than creating a paint style. **Apply Style** rows are unaffected, since they point at an existing style by design.

Whichever you pick, the plugin indexes the file's existing local styles **and** variables by value first, and reuses what it finds:

| You chose | What already exists | What happens |
|---|---|---|
| Variables | A variable with that value | It's reused — nothing is created |
| Variables | A *style* with that value | The variable is created from the style's value **and takes its name**, so the pair stays recognisably one token |
| Styles | A variable with that value | The style is created and **bound** to that variable, so it references the token instead of copying it |
| Styles | A style with that value under another name | That style is reused rather than duplicated |
| Either | Nothing matching | A new one is created |

Colors are matched on hex **and** opacity. Typography is matched on font family, style, size, line height and letter spacing.

Figma has no single "text style variable", so **Typography → Variables** creates a group per style — `H1/fontFamily` and `H1/fontStyle` as STRING variables, `H1/fontSize`, `H1/lineHeight` and `H1/letterSpacing` as FLOAT variables, each scoped so it only offers itself in the right picker. AUTO line height has no number to store and is skipped.

Each text style keeps its **own** group: a variable belonging to another style's group is never handed over just because the value matches, so changing H1's font can't silently move Body. A free-standing variable of your own (say `Brand/Heading Size` scoped to `FONT_SIZE`) *is* reused. Re-running Generate matches on name, so it creates nothing the second time.

New variables land in a **Design Tokens** collection, created once and reused afterwards; matching searches every local collection.

Binding is best-effort — if a particular Figma build rejects a field, the style is still created correctly and the toast reports how many bindings took.

### How styles are applied

- **Selection only** for scans and apply actions. **Merge** and **Delete** affect the whole file (styles are shared by every page) and always ask first.
- A style replaces every paint on a layer, so layers with **more than one fill or stroke are skipped** (and labelled in the layer list) rather than losing paints.
- **Layers inside component instances** are styled on the main component when it lives in this file (so every instance updates), otherwise as an instance override. Locked layers are skipped.
- **Name conflicts** — when a new style's name already exists, you choose **Update existing** (changes that style everywhere) or **Keep both**.
- Each action is a **single undo step** (⌘Z), and the tab re-scans automatically afterwards.

---

## Build design system

A design system documented as frames and labels is a *picture* of a system. A designer reads "Spacing / Desktop → 300 = 24px" and types `24` into a padding field; nothing enforces the scale, nothing updates when it changes, and every breakpoint is produced by duplicating a frame and resizing it by hand.

The **Build design system** tab turns that documentation into the system itself.

It opens with a choice, the way the Colors tab does:

| | |
|---|---|
| **Generate from scratch** | A wizard: canvas sizes → grid → spacing & radius → type scale → colour → extras → elements → review. One question at a time, each **showing** what the answer produces — spacing as bars at real width, the type scale set in actual type, colour as continuous ramps, the grid drawn as columns. **Nothing is written until the last step**, and everything then lands in a single undo |
| **Use what's in this file** | Open a system the file already has, or read a scale documented on the canvas |

### Token families

| Family | Tier | Notes |
|---|---|---|
| Canvas width & content width | Responsive | each breakpoint's width is editable |
| Grid — columns, gutter, margin | Responsive | plus **one grid style per canvas size**, since a grid style cannot carry modes |
| Spacing, radius | Primitive | multiples of an editable base |
| Type sizes | Responsive | the ratio tightens as the canvas narrows; the base holds, so body copy never shrinks |
| Line heights, border widths, icon sizes, opacity, breakpoint widths | Primitive | |
| Colour ramps — brand, neutral, success, warning, danger | Primitive | 50–900 from one hex |
| Semantic colour — `color/text/primary`, `color/bg/surface` … | Theme | **aliases** a ramp step, a different one per Light/Dark |

Semantic colour aliasing per mode is what makes a dark theme one edit rather than a repaint.

Every step is editable row by row — name, a value per canvas size, a preview, and rename/remove on each row, with **+ Add** per family. Editing a cell keeps it; only changing a preset, base or ratio rebuilds the rows.

### Every token on the canvas

A variable that lives only in the Variables panel is invisible while you design. **Document on canvas** draws all of them, grouped by family, with each sample **bound to its variable**:

| Family | Sample | Bound field |
|---|---|---|
| Spacing | a bar at real width | `width` |
| Radius | a rounded rectangle | the corner radii |
| Type scale | "Ag" in real type | `fontSize` |
| Icon size | a square | `width` + `height` |
| Opacity | a swatch | `opacity` |
| Border width | an outlined box | `strokeWeight` |
| Colour | a chip | the fill's `color` |

Because they are bound rather than drawn once, retuning a token retunes the page. Responsive tokens list their value at every canvas size.

### Export

| Format | Notes |
|---|---|
| CSS custom properties | one `:root` block plus a `@media (max-width: …)` per canvas size, carrying only what changes |
| WordPress `theme.json` | `color.palette`, `spacing.spacingSizes`, and **fluid** `typography.fontSizes` — the narrowest canvas becomes `fluid.min`, the widest `fluid.max` |
| W3C DTCG tokens | nested by path, typed, with every mode carried in `$extensions["com.figma.modes"]` |
| Tailwind config | `screens` reversed to min-width the way Tailwind reads them, plus spacing, radius, colours and font sizes |

Everything is read back out of the variables that actually exist, so what is exported is what the file holds. The plugin is fully offline, so the result appears as text to copy.

**Shadows are absent on purpose.** A variable cannot hold an effect, and an effect style has no modes, so per-breakpoint elevation has no clean answer in Figma today.

### Collections

Three tiers are created, split by what varies:

| Collection | Modes | Holds |
|---|---|---|
| `Primitives` | one | the raw ramp — `space/300`, `radius/md`. A ramp does not change per breakpoint |
| `Theme` | Light / Dark | semantic colour, for later phases |
| `Responsive` | one per breakpoint | `space/section/lg`, `container/max` — the tokens that genuinely differ |

Each collection carries **its own mode budget**, which is what makes breakpoints and theming possible at the same time.

The Colors and Typography tabs never adopt these collections. Those tabs write a single mode, so a mode-aware collection would give you a token with a Desktop value and three empty breakpoints.

### Breakpoints

Presets ship for **standard**, **Tailwind**, **Bootstrap**, **Material** and **WordPress/Gutenberg**. Each breakpoint becomes a mode on the `Responsive` collection.

How many modes a file allows depends on the Figma plan, and the published figures contradict each other — so the plugin does not predict it. It asks the file, and if a preset wants more modes than the file allows, **nothing is changed** and the message names the real ceiling and how many breakpoints to drop.

### The scale table

Rows are tokens, columns are breakpoints. Edit any cell.

**Read from canvas** proposes a table by reading labelled text, handling both of the ways a scale is normally documented:

| On the canvas | Read as |
|---|---|
| `"Component Padding - lg - 120px"` inside a frame named `Component Padding - Desktop` | `component-padding/lg`, Desktop = 120 |
| A heading `"Spacing/ Desktop"` above text pairs `"300"` / `"24px"` | `spacing/300`, Desktop = 24 |

It only ever *proposes*. The table stays the source of truth, so anything misread is a visible wrong number rather than a silent one, and prose that merely mentions a px value is reported as unread rather than guessed at.

### Generate

Writes the table into variables. A responsive value **aliases a primitive** whenever one holds exactly that number — `space/section/sm` at Desktop is 64, `space/700` is 64, so the former points at the latter and retuning the ramp moves every semantic token with it. Where nothing matches, the raw number is written and counted separately, so the report shows how much of the system is actually wired together.

Reuse is by name, so running it twice creates nothing.

### Bind selection

Binds `paddingLeft/Right/Top/Bottom`, `itemSpacing`, `counterAxisSpacing` and `cornerRadius` where the layer's literal value already matches a token **in that layer's current mode**. Semantic tokens are tried before primitives.

A field that is already bound is counted, not rebound. Frames without auto layout have no padding or gap to bind and say so. Locked layers are skipped with a reason.

### Elements

The kit itself, as **real components with real variant properties** — one `Button` carrying a `Variant` and a `State` property, not nine separate Buttons.

| Element | Variants |
|---|---|
| Button | Primary / Secondary / Tertiary x Default / Hover / Disabled |
| Input | Default / Filled / Focus / Error / Disabled |
| Checkbox, Radio, Switch | two states each |
| Badge | Neutral / Brand / Success / Warning / Danger |
| Alert | Info / Success / Warning / Danger |
| Avatar | sm / md / lg |
| Nav link | Default / Active |
| Card | one |

Padding, gaps and radii are bound to the scale **as they are drawn**, and colour tokens (`color/brand/default`, `color/text/primary`, …) are created in `Primitives` and reused on a second run. The kit is on-system from the start rather than needing a clean-up pass afterwards.

Inter is not assumed. If it is not installed the kit falls back to a font the machine actually has, and if there is no usable font at all it says so rather than failing on every text layer.

### Make fluid

The Figma-native way to be responsive: one frame that adapts as you drag its width, rather than a frame per size.

| What it sets | Why |
|---|---|
| auto layout on containers that lack it | without a flow there is nothing to reflow |
| children to **fill** | they share the width instead of keeping their own |
| rows of similar children to **wrap**, each with a **minimum width** | this is the whole mechanism — once a child cannot stay above its minimum the row wraps, and four columns become two, then one |
| text to grow in **height** | copy wraps rather than overflowing |
| a **min** and **max width** on the root | it cannot collapse below the narrowest canvas or stretch past the widest |

Icons, avatars and anything small and square keep their size — an icon that stretches is worse than one that stays put.

Two API rules this respects, both of which throw if broken: `FILL` is valid only on an auto-layout **child**, and `layoutMode` must be set **before** `minWidth`/`maxWidth`.

### Responsive versions

For the changes a flow cannot express — hiding a nav, swapping a component for a hamburger.

Select the frame you designed at the widest breakpoint, then **Analyse layout**.

Values already reflow from the tokens. This proposes the **layout** changes that tokens cannot express, each with the numbers behind it:

| Proposal | When |
|---|---|
| stack vertically | a row of unequal children needs more width than it has |
| drop to *n* columns | a row of equal children — *n* is however many actually fit |
| fill the available width | a child is wider than its container |
| hide | a nav with several links in a narrow frame |

Nothing is proposed for the widest breakpoint, because that one *is* the design.

Proposals stay proposals. They appear as a checklist, are saved onto the source layers only when accepted, and are replayed on a later run instead of being re-derived — so regenerating after a design change is one click, not a re-decision.

**A generated frame that has been edited since is reported and left alone, never overwritten.** The fingerprint used to detect that deliberately ignores width and height, since auto layout and the active mode compute those; otherwise a frame would look edited merely because Figma re-settled it. Generating from an already-generated frame is refused rather than quietly nesting.

### Scale presets

| Spacing | Radius |
|---|---|
| 4pt grid, 8pt grid, Tailwind, T-shirt (xs–3xl) | Subtle, Rounded, Pill |

Ramps are defined as **multiples of a base**, not fixed pixels, so changing the base retunes the whole scale and keeps it on-grid. Rows can be renamed, deleted and added. Rebuilding from a preset writes nothing — it only replaces the table, which stays a proposal until **Generate**.

### Preview at a breakpoint

Overrides the selection's mode for the `Responsive` collection. Everything bound moves at once; everything else stays put — which is the quickest way to see how much of a frame is actually on the system.

### What tokens cannot do

`layoutMode`, `layoutSizingHorizontal`, `layoutWrap` and `visible` are enums and booleans, and Figma cannot bind a variable to any of them. So **values** reflow from tokens, but **layout changes** — row becoming column, four columns becoming one, a nav becoming a hamburger — cannot, and are not attempted here.

Shadows have no answer at all: variables cannot hold effects, and effect styles have no modes.

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

The Audit toolbar exposes 10 buttons: **Run Audit**, **Duplicate & Run Audit**, seven automated fixes, and **Re-scan**. Every fix re-runs the audit after completing, so the stats and issue list stay current, and reports its result in a toast (e.g. "Renamed 12, skipped 3").

### Run audit

Scans every node in the **selection** and builds the issue report — there is no page fallback, and the button stays disabled until a frame is selected. Emits live progress updates every 120 nodes.

### Duplicate & Run Audit

Clones each selected frame before anything is changed, so the original stays untouched as a before/after reference. Each clone is placed 80 px to the right of its source and named `<frame> v1`, `v2`, `v3`… — the first version number not already taken on the page (a trailing `v<n>` on the source name is stripped first, so duplicating "Home v2" gives "Home v3", not "Home v2 v1"). The clones become the selection, and the audit then runs on them.

The same thing is available up front as the **Create Duplicate Before Changes** checkbox on the ready panel.

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

Reports how many sections received vertical vs horizontal layout in a toast.

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
| `selection-changed` | `{ count, names }` | Fired on every Figma `selectionchange` (and once at startup); drives the empty/ready panels and the disabled state of every Scan button |
| `revision-created` | `{ names }` | Names of the duplicate frames made by **Duplicate & Run Audit** |
| `no-selection` | — | The Spelling & Grammar scan was asked to run with nothing selected |
| `texts-collected` | `{ texts: [{ id, text, path }] }` | Every text layer in the selection, for the Spelling & Grammar engine to analyze in the iframe |

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
| `collect-texts` | — | Returns every text layer in the selection as `texts-collected` (Spelling & Grammar) |
| `resize` | `{ width, height }` | Resizes the plugin window; clamped to 400–1200 × 400–960 |
| `close` | — | Calls `figma.closePlugin()` |

`code.js` also handles a `prompt-select-frame` message that nothing in `ui.html` currently sends — a leftover from the pre-V19 entry screens, kept deliberately. Two other bits of UI scaffolding are kept the same way: the `#msgBar` element (`showMsg` now forwards everything to `showToast`) and the scope badge's "Full page" branch (`markReportData` always reports `selection`). Leave them in place.

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
| `ignoredSpellKeys` | `Set<string>` | Same idea for Spelling & Grammar results, which are filtered entirely in the iframe |
| `lastIssues` | `Array` | Most recent full issue list, used to recompute summary badges as issues are ignored |
| `auditHasRun` / `spellHasRun` | `boolean` | Whether each tab should show its results panel or its entry panel |
| `spellTotalIssues` | `number` | Spelling issue count, for the summary badges |
| `hasSelection` / `selectionLabel` | `boolean` / `string` | Latest `selection-changed` payload; gates every Scan button and fills the "ready" panels |
| `revisionCopyNames` | `string[]` | Names reported by `revision-created`, shown in the toast |
| `CS` / `TS` | `object` | One scope object per style tab (`makeScope`), holding `screen`, `data`, `rows`, `expanded`, `pages`, `collapsed`, `names`, `editing`, `busy`, plus `palette` / `extract` on Colors and `fonts` / `fontMap` on Typography |
| `pendingStyleReq` | `object` | In-flight style requests by `requestId`, so a `style-conflict` reply can be resent with the user's choice |
| `PG` | `object` | Progress-bar registry — one entry per tab, keyed `audit` / `spelling` / `colors` / `text` |

---

## File Structure

```
figma-wordpress-optimizer/
├── manifest.json     — Figma plugin manifest (name, entry points, permissions)
├── code.js           — Plugin sandbox: audit engine, color/text style scans and actions, fix actions, message handler
├── ui.html           — Plugin UI: HTML + CSS + inline JS (Audit, Spelling & Grammar, Colors, Typography tabs)
├── assets/           — Icon and branding assets (icon-512.png, icon-256.png, icon-128.png)
├── Screenshot/       — UI reference images for the Colors and Typography tabs (design spec, not shipped code)
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
That is the only way it runs. Every tab works on the selection and its descendants — select one or more frames/layers first. There is no whole-page mode, and the Run Audit / Scan buttons stay disabled until something is selected.

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
| "Run audit" button stays disabled | Either nothing is selected (select a frame first — every tab is selection-only), or an action is still running, which disables all toolbar buttons together (`busy` state). |
| Audit seems to hang on large files | Very large frames can take longer; progress updates fire every 120 nodes. If it truly stalls, close and reopen the plugin and audit a smaller frame. |
| An automated fix skipped some nodes | Check the toast — it reports skipped counts. Common reasons: node is locked or inside an instance (see [Known Limitations](#known-limitations)). |
| Ignored issues reappear after reopening the plugin | Expected — the ignore list is session-only by design (see [Known Limitations](#known-limitations)). |
| Colors / Typography tab shows no results | Select a frame and click **Scan** — these tabs don't run with the main audit. |
| "Create & Apply" skipped some layers | Check the toast — locked layers, layers inside instances, and layers with more than one fill/stroke are skipped. |
| A font is missing from the Generate Text Styles list | The list comes from Figma's available fonts. Install the font and restart Figma. |

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full version history.

**Latest: v1.3.0**
- **Create Styles or Variables** — chosen per tab, on both the Scan and Generate screens, with existing styles and variables reused instead of duplicated
- Colors and Typography scans list the **variables** from this file, not just the styles
- A style and a variable holding the same value are reported as duplicates and can be **merged in either direction**
- **Color extraction rebuilt**: frames are read from their design properties rather than rasterised, images return exact source values with antialiasing and compression artifacts filtered out, and there is no limit on how many colors come back
- **Text in more than one color** is scanned run by run instead of being skipped
- Images can be dropped anywhere in the window, pasted with ⌘V, or taken from the selected Figma frame

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
