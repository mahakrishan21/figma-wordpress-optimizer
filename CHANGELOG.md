# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Documentation
- README **Plugin Window** rewritten for the current UI: the header's rules-reference **i** button, the toast system, the Audit tab's three-panel flow (empty / ready / results), the 10-button toolbar, the collapsible stats grid, Developer Handoff Notes, and the resize handles
- README **Automated Actions**: documented **Duplicate & Run Audit** (clone placement and `v1`/`v2`/`v3` naming), corrected "Run audit" which still claimed a whole-page fallback that V18 removed, and corrected the button count from 8 to 10
- README **Architecture**: added the four undocumented sandbox → UI messages (`selection-changed`, `revision-created`, `no-selection`, `texts-collected`) and the two undocumented UI → sandbox messages (`collect-texts`, `resize`); recorded the three retained-on-purpose bits of scaffolding (`prompt-select-frame`, `#msgBar`, the scope badge's "Full page" branch) so they don't get pruned
- README **Client-side state**: expanded from 2 entries to the 11 the UI actually keeps, including the `CS` / `TS` scope objects, `pendingStyleReq` and the `PG` progress registry
- README: `Screenshot/` added to the file structure, UI size noted as resizable (400–1200 × 400–960), and the remaining "message bar" references updated to toasts
- CONTRIBUTING: bug-report checklist now asks for the tab and selection instead of page-vs-selection scope, the new-check procedure includes `RULE_CATALOG`, and the CSS guideline records that the plugin is light-theme only and that style actions use the async setters plus a single `commitUndo()`

## [1.2.0] — 2026-10-01 (V19)

### Added
- **Colors tab** (replaces the color half of Typography & Colors)
  - Entry screen: **Scan** the selected frame, or **Generate Color Styles** without a selection
  - Scan covers fills **and strokes**: Color Styles (expand to see layers, Focus All, Delete), Unlinked Colors split into **New Color** (editable suggested names, Create & Apply / All), **Styles from this file** (Apply Style / All) and **Style from other file** (Create & Apply / All), plus Near-Duplicate Colors with **Merge**
  - Generate: **Extract from image** (JPG/PNG/WebP, offline k-means color extraction with role-based names) and **Create Color Palette** with a custom color picker (saturation/brightness, hue, opacity, hex, eyedropper)
  - Editable palette list: rename, edit hex/opacity, drag to reorder, delete, add colors, **Create Color Styles**
- **Typography tab** (replaces the type half of Typography & Colors)
  - Scan: Text Styles, Unlinked text (New Text / Styles from this file / Styles from other file), Duplicate Text Styles with **Merge / Merge All**, Fonts and size usage
  - Generate Text Styles: modular scale (1.125–1.618 or custom), base size, separate Heading and Body font/weight/line height/letter spacing, searchable font list filtered by All / Google Fonts / Installed by You, and a per-style editor for H1–H6, Para, Body, Label
- "Style from other file" detection: layers pasted from another file that still link to that file's **color styles, color variables, or text styles**; Create & Apply makes a local style and re-links them
- Generate Text Styles: **+ Add Text Style** with web-standard presets (Display, Subtitle, Quote, Body Large/Medium/Bold/Small, Eyebrow, Overline, Caption, Button, Link, Nav, Small) and custom rows; rows can be removed; text case per style
- Text scan suggests web-standard names (Eyebrow, Body Bold, Body Large, Body Small, Caption)
- Footer text follows the active tab, the selection, and scan results
- Colors and Typography scans include layers inside component instances; styles are applied to the main component when it's in this file, otherwise as instance overrides (verified in Figma: 39 color and 13 text layers inside components from another file)
- "Needs manual fix" list for layers with several fills/strokes, with a description of their paints; these no longer appear as rows whose Apply does nothing
- Near-duplicate colors use CIE Lab ΔE < 3 at equal opacity; same-color/different-opacity styles are flagged as opacity variants instead of merge candidates
- Colors/text from another file reuse an existing local style with the same value instead of creating a duplicate
- **Style guide on canvas** — after Generate, a "Style Guide / Colors" or "Style Guide / Typography" frame is placed beside your content with every new style applied (toggle: *Add style guide to canvas*)
- Colors and Typography entry screens show a "Frame ready to scan" state with the selected frame's name, like Audit and Spelling
- Name-conflict prompt (**Update existing / Keep both**) when a new style name already exists
- Scan results toolbar with **Generate Color/Text Styles** and **Re-Scan**; re-scans keep the scanned frame after Focus changes the selection
- Colors and Typography screens use the same components as the Audit tab (buttons, toolbar card, stats grid, collapsible sections)
- Colors and Typography actions are committed as a single undo step and refresh the scan automatically

### Changed
- Tabs are now Audit · Spelling & Grammar · Colors · Typography
- Styles are applied with Figma's async style setters (`setFillStyleIdAsync`, `setTextStyleIdAsync`, …), required under `documentAccess: "dynamic-page"`
- **Outline strokes** only outlines the thin strokes the audit flags as `strokes-found`; card/input borders on frames, components and sections are left alone
- Manifest renamed to "Figma WordPress Optimizer v19" with a new plugin id, so V18 and V19 can be installed side by side

### Fixed
- V18 color merge could silently drop fills on layers with several paints, and used a sync style setter that fails under dynamic page access; layers with multiple paints are now skipped and reported
- Developer Handoff Notes showed the full layer path as the name, and described every note as an AUTO line-height issue
- Spelling tab empty-state icon lines were invisible (undefined `--violet-500` token); its badge and "ready" check now use consistent colors
- Opening a dropdown in Generate Text Styles no longer swallows the next click elsewhere
- README: outdated version, check count, removed `near-dupe-spacing` rule, page-scope fallback, and category mapping

### Removed
- Typography & Colors tab, its Recommendations / Opportunities builders and the unused WCAG helpers

## [1.1.0] — 2026-06-26 (V18)

### Added
- **Toast notification system** — all status messages, action results, warnings and errors now slide in as toasts at the top of the plugin; auto-dismiss with hover-pause
- **Duplicate & Run Audit** — "Create Duplicate Before Changes" checkbox on ready screen; "Duplicate & Run Audit" button in toolbar; versioned naming (v1, v2, v3…)
- **Rules reference popup** — info `i` button in header opens a popup listing all 24 audit rules grouped by category
- `image-fit-mode` rule — flags image fills using Fit (letterboxing) or Crop (complex CSS replication) mode
- `section-spacing-inconsistency` rule — flags sections with inconsistent padding vs dominant pattern
- **Stat cards clickable** — clicking a stat card jumps to that category's accordion group
- **Collapse/Expand** buttons on Audit Stats section, Issue Summary accordion groups, and Typography & Colors section dividers
- **Focus buttons** on Unlinked Colors and Unlinked Text rows in Typography & Colors tab

### Changed
- **Selection-only scope** — all three tabs now work only on selected frame; no page fallback
- **Instance/component skipping** — all rules skip nodes inside instances; `missing-color-style` and `missing-text-style` also skip inside COMPONENT masters
- **Typography & Colors** excludes component/instance nodes from unlinked color/text detection
- **Footer** uses `margin-top: auto` (flex column body) — always pinned to viewport bottom
- `typoSummaryGrid` responsive with `minmax(120px, 1fr)` and proper side padding
- `Scan File` and `Scan Text Layers` buttons disabled until frame is selected
- Light theme only — removed `prefers-color-scheme: dark` media query

### Removed
- `near-dupe-spacing` audit rule (was producing false positives on valid 2px spacing scales)
- "Interactive w/o states" stat card from stats grid
- `typo-info-banner` hint text from all Typography & Colors blocks
- Actionable Recommendations block from Typography & Colors tab
- Inline revision banner (replaced by toast notification)
- Design System Opportunities section (removed in V17, documented here)

---

## [1.0.0] — 2026-06-15

First public-ready release (V17).

### Added
- New **Accuracy & performance** issue category (red) with 8 new audit checks:
  - `text-overflow` — text overflowing its container
  - `auto-line-height` — text using AUTO line-height instead of an explicit value
  - `missing-font` — text referencing a font that fails to load
  - `section-overlap` — overlapping top-level sections
  - `near-dupe-spacing` — near-duplicate Auto Layout spacing values
  - `no-mobile-frame` — page has a desktop frame but no mobile (≤480px) frame
  - `multiple-fonts` — more than 2 font families in use
  - `interactive-no-states` — carousels/accordions/tabs/modals without state variants
- New **Typography & Colors** tab:
  - Color style audit with WCAG contrast ratios against white/black
  - Unlinked color and unlinked text detection (3+ uses)
  - Near-duplicate color grouping with a **Merge colors** flow that creates/updates a Color Style and re-points matching layers
  - Unused Color/Text style detection
  - Font family and font size usage breakdown, including one-off size detection
  - Prioritized recommendations (high/medium/low) with Impact / Action / Benefit details
- Per-category **Ignore all** button in each accordion header
- Per-issue **"Why & how to fix"** expandable detail panel
- Summary badges: total issues, actionable issues, shown issues, ignored count
- Project branding: plugin icon (`assets/icon-512.png`, `icon-256.png`, `icon-128.png`)
- `LICENSE` (MIT), `CONTRIBUTING.md`, `CHANGELOG.md`

### Changed
- 6 issue categories now share a consistent color system (accuracy = red, structure = blue, styles = violet, buttons = amber, assets = green, cleanup = gray), applied consistently to accordion dots, stat numbers, and count badges
- Stats grid is now 6 columns, left-aligned
- Modernized spacing, borders, and radius across the UI (Linear/Vercel-style)
- "No mobile frame" stat label moved to vertically align with the "Automated Fixes" label

### Fixed
- **Ignore** button now ignores only the specific issue clicked, instead of clearing the entire issue list (previously triggered a full re-audit that reset all filtering)

### Removed
- Header close button (`#headerClose`) — use the footer **Close** button instead
- "No mobile frame" stat card from the stats grid (the underlying check still runs and appears in the issue list)
- Left-colored borders on stat cards and accordion items (replaced by category-colored dots and stat numbers)

---

## V16

### Added
- **Spelling & Grammar** tab: offline spelling dictionary (~320 entries), 9 grammar pattern rules, Flesch Reading Ease readability scoring, and long-sentence detection
- Redesigned UI with a full light/dark CSS custom-property theme, blue accent color, tab navigation, collapsible issue groups with sticky category headers, and an improved stats grid

### Changed
- Accordion containers use `overflow: clip` so sticky category headers work while scrolling
- Scroll container height increased from 330px to 400px
- Issue count badge changed from gray to blue; total issues badge turns red when issues exist

---

## V1–V15

Initial structural audit engine: 15 checks across 5 categories (structure, styles, buttons, assets, cleanup), 8 automated fix actions, smart button/section/auto-layout detection, and the blocked-vs-actionable issue model.
