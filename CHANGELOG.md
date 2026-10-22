# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added
- **Build design system tab** (the tab formerly called UI Kit). A design system documented as frames and labels is a picture of a system; this turns it into the system itself
  - It opens the way the Audit, Colors and Typography tabs do — built from the same empty-state parts, so the tab looks like the rest of the plugin rather than like itself — with a choice: **Generate from scratch**, or **use what's already in this file**
  - **Read from canvas** no longer dead-ends on a file with no breakpoints. Parsing needs breakpoint names to read a heading like "Spacing/ Desktop", so the standard set is created first and the message says so
  - **From scratch is a wizard** — breakpoints, spacing and radius, typography, colour, the other token families, then elements — asking one question at a time and showing what each answer produces. **Nothing is written until the last step**, and everything then lands inside a single undo
  - **Every step is editable row by row**, the same shape as the Create Text Styles screen: name, a value per canvas size, a preview of the thing itself, and rename/remove on each row, with **+ Add** per family. Editing a cell keeps it; only changing a preset, base or ratio rebuilds the rows
  - **A canvas to start designing in.** Tokens and components are a foundation, not a starting point. The build now also creates an artboard at the widest canvas size — already carrying that size's grid style, already bound to the system (section padding, margin, gutter, background, type scale), already fluid with a min and max width — containing a hero, a wrapping card row and an empty section. If the elements were generated it places real instances of them. Design inside it and the responsive work is most of the way done
  - **Every token is drawn on the canvas**, grouped by family, with each sample **bound to its variable** rather than being a snapshot: a spacing bar binds its width, a radius sample its corners, a type specimen its font size, an icon square its width and height, an opacity swatch its opacity, a colour chip its fill. Retune a token and the page retunes with it. Responsive tokens list the value at every canvas size
  - **Export** — the system leaves Figma as **CSS custom properties** (with a media query per canvas size), **WordPress `theme.json`** (where the canvas sizes collapse into fluid typography — the narrowest becomes `fluid.min`, the widest `fluid.max`), **W3C DTCG tokens** (every mode carried in `$extensions`) or a **Tailwind config** (screens reversed to min-width, the way Tailwind reads them). Read back out of the variables that actually exist, not out of the wizard's answers
  - **Every step is shown, not described.** Spacing and radius are drawn as bars at their real width, the type scale is set in actual type, colour ramps are continuous strips, and the grid is drawn as columns. The prose that used to explain each step is gone
  - **Canvas sizes are editable** — each breakpoint's width can be changed, not just picked from a preset
  - **Container width, with the margin derived from it.** A page is a canvas width *and* a content column — 1600 page with a 1200 column, 1920 with 1400 — and the side margin is whatever is left over, halved. The Grid step now shows **Canvas · Container · Margin · Cols · Gutter** per canvas size: set the container and the margin follows, or type a margin to override it. On a narrow canvas the margin holds at a floor and the container gives way instead, which is what stops content touching the edge of a phone. These become `container/max`, `grid/margin`, `canvas/width`, `grid/columns` and `grid/gutter`
  - **The starter canvas is built the way a real page is** — full-bleed sections, each holding a centred **Container** whose max width is bound to `container/max`. That is what lets an image reach the edge of the page while the copy stays in the column
  - **Grid** — columns, gutter and margin per canvas size, with a live column diagram. Sensible defaults are derived from each width (12 columns at 1440, 4 at 375) and any of them can be overridden. These become `grid/columns`, `grid/gutter`, `grid/margin`, `canvas/width` and `canvas/content` tokens, **plus one grid style per canvas size** — a grid style cannot carry modes, so a responsive grid has to be one style each
  - **More families**: type sizes (responsive, with the ratio tightening as the canvas narrows while the base holds, so body copy never shrinks below comfort), line heights, border widths, icon sizes, opacity steps and the breakpoint widths themselves
  - **Upload a logo and the colour comes from it.** The Colour step takes a logo, reads its palette, and sets the brand and neutral from what it actually contains — brand being the most saturated colour that is not almost-black or almost-white, neutral the least saturated. Picking by frequency instead would hand back the background
  - **The logo is drawn on the token page**, leading it, in three tiles: original, mono dark and mono light. A raster logo cannot be recoloured, so the mono versions use the image fill's own **filters** — saturation stripped out, exposure pushed to either end — rather than pretending to redraw it
  - **Colour as a tier.** Brand and neutral each get a 50–900 ramp in `Primitives`, and the semantic names (`color/text/primary`, `color/bg/surface`) live in `Theme` and **alias** a ramp step — aliasing a different one in Dark, which is what makes a dark theme one edit instead of a repaint. Success, warning and danger are deliberately not generated: feedback colour is a product decision, not a brand one
  - Shadows are absent on purpose: a variable cannot hold an effect and an effect style has no modes, so per-breakpoint elevation has no clean answer in Figma today
  - **Tiered collections** — `Primitives` (raw values, one mode), `Theme` (Light/Dark) and `Responsive` (one mode per breakpoint). Each collection carries its own mode budget, which is what makes breakpoints and theming possible at the same time
  - **Breakpoint presets** for standard, Tailwind, Bootstrap, Material and WordPress/Gutenberg, so nobody types four numbers. How many modes a file allows depends on the Figma plan and the published figures contradict each other, so the plugin asks the file rather than guessing — if a preset asks for more than the file allows, **nothing is changed** and the message names the real ceiling
  - **An editable scale table** — rows are tokens, columns are breakpoints. **Read from canvas** proposes a table by reading labelled text, handling both the `"Component Padding - lg - 120px"` form and the `"Spacing/ Desktop"` heading above label/value pairs. It only ever proposes: the table stays the source of truth, so a misread is a visible wrong number rather than a silent one
  - **Generate** writes the table into variables. A responsive value **aliases a primitive** whenever one holds exactly that number, so retuning the ramp moves every semantic token with it. Reuse is by name, so a second run creates nothing
  - **Bind selection** binds padding, item spacing, counter-axis spacing and corner radius where the literal already matches a token **in that layer's current mode**. Semantic tokens win over primitives. Frames without auto layout have no padding or gap to bind and say so; a field already bound is counted, not rebound
  - **Preview at a breakpoint** overrides the selection's mode. Everything bound moves at once and everything else stays put — the quickest way to see how much of a frame is actually on the system
  - **Elements** — the kit itself, as real components with real variant properties: Button (3 variants x 3 states), Input, Checkbox, Radio, Switch, Badge, Alert, Avatar, Nav link and Card. One Button with a `Variant` and a `State` property, not nine separate Buttons. Padding, gaps and radii are bound to the scale as they are drawn, and colour tokens are created in `Primitives` and reused on a second run, so the kit is on-system from the start rather than needing a clean-up pass. Inter is not assumed — if it is missing the kit falls back to a font the machine actually has, and says so if there is none
  - **Generate &amp; apply** — one action for a design that already exists: read what it uses, make the tokens, and **bind them straight back into that design**. Previously reading a scale off the canvas left the tooling with tokens nothing used, and a second, separate survey was needed to wire them up. The entry screen now offers the two routes plainly: *Build from scratch* or *Build from a design*
  - **The token documentation is laid out in columns**, side by side and top-aligned — the way a UI kit page is actually read, rather than one tall column nobody scrolls to the end of. The spacing is **measured from a real kit page** rather than invented: 120 padding, 214 between sections, a rule under every title 30 below it, and content 50 below the rule. Auto layout applies one gap per frame, so the title and rule sit in their own header group to get 30 above and 50 below from a single section gap
  - **Apply to an existing design.** A design built before the system will almost never match it exactly — a padding of 23 where the scale says 24, a blue a shade off brand — so binding only exact matches bites on nothing. **Survey this design** matches every colour (by perceptual distance, not hex equality), type size and spacing to its nearest token and shows how far off each one is, marked *exact* or *off by n*. Nothing changes until you apply, and **Exact only** accepts the safe ones in a click. Colours bind through fills and strokes including per-run text fills; type binds font size and line height per run; spacing binds padding, gaps and radius. A zero is left alone — it is a choice, not a value to snap. Anything already bound is reported, not proposed again
  - **Make fluid** — the Figma-native way to be responsive, and now the first thing the Responsive section offers. Auto layout everywhere, children set to **fill**, rows of similar children set to **wrap** with a **minimum width**, and text set to grow in height. Dragging the frame's width then reflows it — four columns become two, then one — with no second frame to maintain. Icons, avatars and anything small and square keep their size rather than stretching. The root gets a floor and a ceiling taken from the narrowest and widest canvas sizes
  - **Responsive versions** — for the changes a flow cannot express (hiding a nav, swapping a component): select a frame and generate its narrower breakpoints. **Analyse layout** proposes the changes tokens cannot express, each with the numbers behind it ("its children need 1376px side by side; only 311px is available"): a row of unequal children stacks, a row of equal ones drops to however many columns fit, a nav with several links in a narrow frame hides. Nothing is proposed for the widest breakpoint, because that one *is* the design
  - Proposals stay proposals: they are a checklist, saved onto the source layers only when accepted, and replayed on a later run rather than re-derived. A generated frame that has been **edited since is reported and left alone, never overwritten**; generating from an already-generated frame is refused rather than quietly nesting
  - **Scale presets** — spacing as 4pt, 8pt, Tailwind or t-shirt, radius as subtle, rounded or pill. Ramps are defined as multiples of a base, so changing the base retunes the whole scale and keeps it on-grid. Rows can be renamed, deleted and added, the same shape as the Create Text Styles screen
  - Layout cannot come from tokens: `layoutMode`, `layoutSizingHorizontal`, `layoutWrap` and `visible` are enums and booleans, and Figma cannot bind a variable to any of them

### Changed
- **The plugin is now "Figma WordPress Optimizer v20".** The manifest `id` changed too, which is a **breaking change: remove the old plugin and re-import it from the manifest.** An `id` change is not an update — the old install keeps running the old code silently. The id had to change before the new tab shipped, because plugin data is scoped to it
- The tab strip now wraps. Five tabs fit at 760px, but the window can be dragged down to 400, where they previously clipped rather than reflowed and a tab became unreachable
- `getTokenCollection` no longer auto-picks a UI Kit collection for the Colors and Typography tabs. Those tabs write a single mode, so adopting a mode-aware collection would have produced a token with a Desktop value and three empty breakpoints

### Fixed
- **The survey proposed bindings onto layers painted by a style.** Writing `node.fills` on a styled layer silently detaches the style, so a survey run over a file that already uses paint or text styles would quietly unpick them — the opposite of putting a design on the system. Styled paints and styled text are now left alone and reported, with a note to convert those styles to variables first
- **Tokens read off a canvas matched nothing.** The matching pool whitelisted token name prefixes (`space/`, `radius/`, `grid/`), so a scale parsed from a file using its own naming — `spacing/300` rather than `space/300` — silently matched zero layers. Any numeric token is now a candidate length, with opacity and column counts excluded because they are not lengths
- **Generated containers were 1px tall and clipped their own content.** `resize()` resets both sizing modes to FIXED, so setting `primaryAxisSizingMode = 'AUTO'` and *then* resizing left the frame fixed at the resize height. The Card, Alert, Input and Avatar components and every starter-canvas section were affected. Resize now comes first. Found by building the output in a real Figma file and looking at it — the test harness had been modelling `resize()` as a plain width/height assignment, and now models the reset
- **The tab's buttons now match the Audit tab's.** They sit in the same bordered toolbar card, at full size with an icon beside the name, grouped under an **Apply & document** divider — rather than the small unlabelled buttons they were
- **Canvas size inputs did not line up.** The proportional screen bar came before the number field, so the field shifted left on every row. The field is now in a fixed column and the bar follows it
- **The wizard could open with no canvas sizes at all.** It hard-coded the `standard` preset, so a file whose presets did not include one started empty. It now prefers the file's own configured preset, then `standard`, then whatever exists
- **`nodeModeFor` read a property that does not exist.** Figma's node property is `explicitVariableModes`; the code read `explicitModes`, a name the test harness had invented. In Figma that branch was simply dead, and the tests passed for the wrong reason. The mock now models the real pair, including the fact that **`resolvedVariableModes` folds in modes inherited from ancestors** — so a child of a mode-overridden frame now resolves correctly in the tests as it always did in Figma
- **A single bound field hid a whole text layer from the survey.** A layer whose font size was already bound was skipped entirely, so its unbound line height was never offered. Typography is now checked field by field
- **The CSS export threw the dark theme away.** The Theme collection holds a value per mode and only the first was emitted. It now writes a `[data-theme="dark"]` block carrying every semantic colour that differs from light
- **The overflow fix was itself only half-applying.** `FILL` is valid only on an auto-layout *child*, and the text was being set up before it was appended — so the throw was swallowed and the copy stayed auto-width. The test harness now enforces Figma's real preconditions (`FILL` only on auto-layout children, `HUG` only on auto-layout frames and text, `layoutWrap` only with a layout mode, min/max width only on auto-layout nodes and their children), which is what caught it
- **The generated Card, Alert and Input overflowed their own containers** — Figma's own audit caught the Card's copy running 41px past its edge. Text that sizes itself to its content cannot sit inside a fixed-width parent, so the copy now fills the width and the containers hug their height
- `scopePanel` and `pgKeyOf` dispatched on object identity, so any scope that was not Colors fell through to Typography. Harmless with two tabs, wrong with three — both now dispatch on the scope's name

## [1.5.0] — 2026-10-19

Supersedes the untagged 1.4.0, whose changes were never written up separately.

### Fixed
- **A merged colour stayed in Near-Duplicate Colors with its Merge button still offered.** When a style and a variable hold the same value, merging in *Styles* mode links the style to the variable and deliberately deletes nothing — so on the next scan both tokens still existed and still looked like a duplicate. Merging again did the same thing, forever
  - A style whose paint is bound to a local variable no longer takes part in duplicate detection: it has no value of its own, it **is** that variable. The pair disappears as soon as it is linked
  - Genuine duplicates are still caught. A near-identical *unbound* style is reported against the variable rather than against its bound style, so nothing is hidden — only the redundant half of a linked pair is
  - Merging with **variables** is untouched: the replaced variable is still deleted and the pair still clears
  - A **failed** merge changes nothing, so the item stays listed for a retry with its reason shown
  - Typography was already correct for both cases — duplicate text styles are deleted on merge, and a text style bound to a variable group was already excluded. Confirmed by test rather than assumed

### Added
- **Convert** — turn the colours and type in a frame into one kind of token, instead of deleting and recreating them by hand. The buttons follow the Create dropdown:
  - Create = **Variables** → *Convert to Variable* on each Color Styles row and *Convert All to Variables* in its header
  - Create = **Styles** → *Convert to Style* on each Color Variables row and *Convert All to Styles*
  - *Convert everything to Variables/Styles* in the toolbar, shown only when the frame holds **both** kinds
  - **Style → variable**: reuses a variable of the same value, preferring the same name, so "Neutral / White" is reused rather than becoming "Neutral / White 2". Every layer and text range is re-bound. The old style is kept and linked to the variable by default, or removed when **nothing anywhere in the file** still uses it (and kept, with a note, when something does)
  - **Variable → style**: reuses a style of the same value, else creates one **bound to the variable**, and applies it. The variable is kept — a Figma variable cannot point at a style
  - Typography converts a text style to its five-variable group and binds the text layers
  - A dialog asks for scope (**this frame** or **entire file**) and what to do with the old style, and the result reports created / reused / re-bound / skipped. One ⌘Z undoes the whole thing
  - Running a conversion twice creates nothing. Colour and opacity are preserved exactly

### Changed
- **Swatch shape now says what a token is**, following Figma's own convention: a **circle** for a colour style, a **rounded square** for a colour variable, a **dashed square** for an unlinked colour — everywhere a swatch appears, with a tooltip and a legend under the Color Summary. Typography uses an "Aa" mark, circled for a text style and rounded-square for a variable group. The checkerboard behind partial opacity is unchanged
- **Toolbar**: the Generate button is now **Generate Palette** (Colors) and **Generate Type Scale** (Typography), and no longer changes with the dropdown — the dropdown already decides what gets made. Order is now `[Generate …] … [Re-Scan] Create [▾] [Convert everything …]`, with Re-Scan still primary

### Fixed
- **Text layers mixing fonts or sizes were skipped entirely** — *"3 text layers with mixed fonts or styles in one layer were skipped"* — and their fonts were missing from the Fonts summary. `textSpecOfNode()` returns null as soon as any typography property is `figma.mixed`, so the whole layer fell out of the scan. Mixed layers are now read **run by run**, the way multi-coloured text already was:
  - Each styled run becomes its own use, carrying the character range it covers, and runs are grouped by spec exactly as whole layers are — so a run matching an existing token lands under *Matches Existing Token* and a new one under *New Text*
  - A run that is only whitespace or punctuation (a space set in another font) is folded into the run before it, rather than littering the results with near-duplicate styles
  - **Apply, Create & Apply, Convert and Merge all target just those characters** — `setRangeTextStyleIdAsync` for styles, `setRangeBoundVariable` for variables. The rest of the layer is untouched
  - The uses list shows each run as the layer name plus a **"characters 1–23"** tag and a preview of the text
  - A layer counts **once** in the layer totals however many runs it has, and every run's font appears in the Fonts summary
  - A run whose font isn't installed is skipped **by name** — *"'Julius Sans One Regular' isn't installed"* — and only that run; previously the raw rejection surfaced instead
  - The "mixed fonts … skipped" warning is gone; the remaining note covers only layers that genuinely can't be read
- The **Fonts summary counted runs as layers**: a layer with three runs in one family was counted three times under a "N layers" label. It now counts distinct layers

### Fixed
- **Action buttons wrapped onto a second line at the plugin's real width.** The Convert button is a third action, and the 156px action column only fits two — so Color Variables rows (and Color Styles rows in Variables mode) broke across two lines. Earlier checks had run at 1200px wide, where it fits; the plugin's window is **760px**. Rows that show a Convert button now use a wider action column, applied to the header and the rows together so the columns stay aligned. Verified in both modes on both tabs at 760px
- **One ⌘Z could undo your own edits as well as the plugin's.** `commitUndo()` closes the *current* undo group, and it was only called at the end of an action — so the group it closed stretched back to the previous action, swallowing anything you had done on the canvas in between. The plugin now closes the previous group before it starts work, so one ⌘Z undoes exactly that action. A failed action also commits, instead of merging its partial work into the next one
- A typography layer whose variable bindings can't be cleared now **says so**. A surviving binding overrides the new text style, so the layer would silently keep its old appearance; the result now names the layer and what to do. Only the fields the group actually bound are unbound, rather than all five blindly

### Fixed
- **Typography "Convert to Style" always failed** with *"N skipped. Converting a text variable group back to a style is done from the Text Styles list"* — and that list was empty, because layers bound straight to variables use no text style. The Text Variables block listed **one row per variable** (`Caption Font Family`, `Caption Font Size`, …), and a single variable can't become a text style, so every row was skipped
  - Text variables are now grouped **by layer**: each distinct combination of bound variables is one group, and one group becomes one text style. Each styled segment of mixed text counts separately
  - The block shows **one row per group** — name, resolved type, layer count — with the individual variables listed when the row is expanded. The dead *Convert to Style* button is gone from single-variable rows
  - Converting resolves the group's values (a bound variable wins; an unbound property keeps the layer's own value, so a partially-bound layer still yields a complete style), reuses a matching text style or creates one, binds the style's fields back to the group's variables, and switches every layer to it, clearing its direct bindings. The variables are kept
  - A layer whose font isn't installed is skipped **by name** — *"'Irish Grover Regular' isn't installed, so 'Caption' was skipped"* — instead of failing the group
  - The result reads "N styles created, N reused, N layers updated" rather than a bare "20 skipped"
- New typography variables use **flat names** ("Caption Font Size") instead of "Caption/fontSize", which Figma renders as a folder per style. Variables named the old way are still matched, so re-running on an existing file stays idempotent and creates no flat duplicates

### Fixed
- **"Merge colors" did nothing when the pair contained a variable.** The button sent every member as a style id, so a variable resolved to nothing and was silently skipped — the pair survived the re-scan. Merging is now routed by what the group actually holds:
  - **style + style** — unchanged: re-link every layer in the file, then delete the replaced style
  - **variable + variable** — new `mergeVariables()`: re-binds every fill and stroke across all pages, including text runs and instance overrides, then re-points styles bound to a replaced variable and any variable that aliased it, then deletes it
  - **style + variable** — follows the Create dropdown. On **Variables** the layers move to the variable and the style is linked to it; on **Styles** the layers move to the style and the style is bound to the variable so both stay in sync. A variable is **never** deleted automatically
  - Mixed groups of three or more apply these rules to each member against whichever one you keep
- **Nothing is deleted while a layer still points at it.** If any layer can't be re-linked — inside an instance from another file, for instance — the token is kept and linked instead, and the result says *"N layers couldn't be re-linked — kept '<name>' linked instead"*. No layer is ever left holding a raw colour
- The merge dialog now shows each item's **kind** (with the swatch shape) and its **use count across the whole file**, not just the scanned frame, since deleting is a file-wide act. The default keeper follows the Create dropdown — a variable on Variables, a style on Styles
- An exact style + variable pair was listed **twice**: once under Near-Duplicate Colors and again under "Same value as a variable", each with its own button. They are now one entry with one button
- **Merge All** appears whenever there is at least one group (it previously needed two)

### Fixed
- **The Create Styles / Variables dropdown was ignored once a file already held tokens.** Scan a frame whose colours already exist as styles and every row offered only *Apply Style*, with no way to produce a variable — and the file ended up with styles and variables duplicating each other. Six causes, all fixed:
  - The scans matched unlinked values **against local styles only**; local variables were never a match source. Both scans now resolve against a single `buildTokenIndex()` covering styles *and* variables
  - The apply path **returned before the dropdown was ever read**, so sending a target would not have helped. The target check now runs first, for every row
  - Creating a variable from a style's value copied its **name but never linked the style to it** — manufacturing the duplicate the feature exists to prevent. The source style is now bound to the new variable
  - New variables always went to a "Design Tokens" collection. They now go to whichever local collection already holds the most variables of that kind, so a file with its own colour or type collection keeps using it
  - Near-duplicate detection (ΔE < 3) covered styles only. Variables take part now, including style↔variable near matches
- **Opacity of variable-bound paints was reported squared.** Measured in Figma: binding a COLOR variable **overwrites** `paint.opacity` with the variable's alpha, so the two are always equal — and the scan multiplied them, reporting a 20% colour as 4%. That wrong value then flowed into the panel, into matching, and into any token made from the row. Effective opacity is now the variable's alpha alone
  - The canvas was never affected; only the reported number was. Re-scanning corrects it
  - This misread **any** variable-bound paint, including ones bound by hand

### Changed
- One decision table (`plannedAction`) now drives the scan, Create & Apply, Generate and Merge, and is mirrored in the UI so a button can never promise something the sandbox won't do. Per row, depending on what exists and what the dropdown says: *Create & Apply*, *Apply Style*, *Apply Variable*, *Create Variable from Style*, or *Create Style from Variable*
- "Matches Existing Style" is now **"Matches Existing Token"**, its sub-block is "In this file", and the matching column names the style and/or variable found — including whether the two are linked
- Row and bulk buttons relabel themselves when the dropdown changes, without a re-scan
- Merging a near-duplicate group that contains a variable binds the style to it rather than deleting anything; variables are never deleted by a merge


### Added
- **Text styles that duplicate a variable group are now detected.** A text style whose five properties resolve to the same variables as an existing group is reported as a duplicate rather than sitting alongside it unnoticed

### Fixed
- **Colour styles are no longer created inside groups.** Figma turns a `/` in a style name into a folder, so "Brand / Primary" silently became a *Primary* style inside a *Brand* group. Names are flattened before creation — "Blue/500" becomes "Blue 500"
- **A paint bound to a deleted variable is no longer treated as linked.** The binding survives the variable, so a style could look wired to a token that no longer existed; only live local variables now count

## [1.3.0] — 2026-10-16

### Changed
- **Color extraction now returns every distinct color, with no limit.** The Colors box, its 2–24 range, the 12-color default and the old hardcoded 8 are all gone. A 200-swatch image now yields ~200 colors instead of 12
  - The algorithm changed to suit: k-means with a fixed cluster count can't express "all colors", so extraction now counts colors directly (5 bits per channel plus 4 bits of alpha, averaged back to full precision) and merges greedily, most-common first
  - The **only** thing that collapses colors is perceptual distance — ΔE < 4 at the same opacity. Nothing is truncated or dropped to satisfy a count
  - **Opacity is preserved**: the same color at 100% and at 25% stays two entries, each carrying its own opacity, instead of everything being forced to 100%
  - Sampling resolution raised to a 900px long edge so small accents are caught
  - In a large image, a color present in a single sampled pixel is treated as compression noise; small images keep everything
  - The extraction screen shows the total as read-only text ("195 colors found") and warns above 60 colors, but never limits

### Fixed
- **Extraction from a Figma frame invented colors that weren't in the design.** A yellow frame with black text produced 9 colors instead of 2. The frame was being rendered to a PNG and sampled, so every antialiased text edge became a "color"
  - **Frames are no longer rasterised for color.** `collectFrameColors()` walks the node tree and reads the actual design properties — every visible solid fill and stroke, and the *stops* of any gradient rather than the pixels between them. The exported PNG is now only the thumbnail
  - Hidden layers, paints with `visible: false`, and fully transparent paints contribute nothing. Colors are ranked by the area they cover, so the dominant color leads
  - The extraction screen says when values came from the design rather than from sampling
- **Image extraction rebuilt for accuracy.** Measured on a corpus of flat art, real antialiased text, JPEGs, a gradient, an illustration and photographs:

  | image | before | after |
  |---|---|---|
  | yellow bg + antialiased black text | 6 | **2** |
  | the same as a JPEG | 44 | **3** |
  | flat 3-color image | 3 | 3 |
  | multicolor illustration | 41 | **8** (6 shapes + background + outline) |
  | gradient | 20 | 19 |
  | photograph | 500 | 26 |

  - **Every color returned is now an exact value from the source.** Clusters keep their most frequent exact pixel rather than an average of their members, so a reported hex always exists in the image
  - **Grouping is share-adaptive**: a color covering ≥1% of the image is a design color and merges only when nearly identical (ΔE 4), while progressively rarer colors — the territory of antialiasing and compression noise — merge into their nearest neighbour at up to ΔE 22. Nothing is discarded to reach a smaller palette; rare colors are folded into the color they are a variation of
  - A color below **0.01% of the image** (about one pixel in ten thousand) cannot be a design color and is dropped. The most common color is always kept regardless
- **Uploaded images no longer report antialiasing as colors.** `suppressBlendArtifacts()` drops any color that sits on the line between two far more prominent colors in Lab space — which is exactly what a blended edge pixel is. The projection must fall strictly between the two anchors, so neither anchor can ever be removed, and a color is only dropped when both anchors are at least 4× more common
  - Verified both ways: the yellow/black design rendered as a PNG with blended edges now yields 2 colors, while an image of 200 genuinely distinct swatches still yields 195 — unchanged by the new filter
- **Color variables defined in this file were invisible in Scan results.** The scan recognised a variable-bound fill as "linked" and then dropped it — so variables the plugin had just created never appeared on a re-scan. They're now collected and listed

### Fixed
- **Text layers with more than one color were skipped entirely.** When different words or characters carry different colors, `node.fills` is `figma.mixed`, and the scan passed over the whole layer — so none of its colors were counted or offered. The scan now reads the layer run by run with `getStyledTextSegments`, and each colored run is reported as its own color
  - Each use carries the character range it covers, so **Create & Apply** styles or binds **only those characters** (`setRangeFillStyleIdAsync` / `setRangeFills`), leaving the layer's other colors untouched
  - A run that already uses a style or variable is attributed to it, exactly as a whole layer would be
  - The layer count still counts such a layer once, however many colors it holds

### Changed
- **The "same value as a variable" merge action now follows the Create dropdown** instead of always linking one way:
  - **Variables** selected → *Link to variable*: the style is pointed at the variable, so one value drives both
  - **Styles** selected → *Link to style*: the layers bound to the variable are pointed at the style instead, and the row shows how many layers that is. A Figma variable cannot reference a style, so in this direction the layers move rather than the variable — the panel and the dialog both say so
  - Either way nothing is deleted, and ⌘Z undoes it

### Added
- **Typography now has the full variable option, matching Colors.** The Create Styles / Variables dropdown is on the Typography **scan** toolbar as well as its Generate screen, sharing one per-tab setting
  - **Create & Apply** / **Create & Apply All** in Variables mode create (or reuse) the five typography variables for a scan row and **bind them to the text layers** via `setBoundVariable`, after loading the fonts and clearing any conflicting text style
  - A **Text Variables** block lists the typography variables from this file bound to text in the frame — name, property, value, use count, expandable layer list, **Focus All** and **Delete** — with a matching stat card. These were previously treated as "linked" and never shown
- **A style and a variable holding the same value are reported as duplicates.** They appear in the existing merge section — *Same value as a variable* under Near-Duplicate Colors, *Same values as a variable group* under Duplicate Text Styles — instead of only being listed separately in their own sections
  - **Link to variable** points the style at the variable, so one value drives both and editing the variable updates the style. **Nothing is deleted** and every layer using either keeps working; undoable with ⌘Z
  - Colors match on hex and opacity. A text style counts as a duplicate only when **every** property it defines is held by a variable of the right scope and value — a partial match is left alone
  - A style already bound to a variable is not re-reported
- **Color Variables block in the Colors scan results**, built from the same components as Color Styles: name, hex, opacity, use count, an expandable layer list, **Focus All**, and **Delete**. A matching stat card sits beside Color Styles, and the block collapses by default when empty
- A frame holding **both** styles and variables lists both, in their own sections; a variable-bound color is not re-reported as unlinked
- **Delete** on a variable row removes the local variable (`variable-delete`), leaving layers their color but unlinked — the same contract and wording as deleting a style, and undoable with ⌘Z
- **The Create Styles / Variables dropdown is now on the Colors Scan screen too**, in the scan toolbar beside Re-Scan. It's the same control and the same per-tab state as the Generate screen — one picker, not a second one — so the choice carries across both halves of the tab
  - **Create & Apply** and **Create & Apply All** honour it: in Variables mode they create (or reuse) a COLOR variable and **bind it to the scanned layers** via `setBoundVariableForPaint`, on fills or strokes as the row requires, instead of creating a paint style
  - Any existing variable of the same value is reused rather than duplicated, matching the Generate flow
  - A layer's conflicting fill/stroke style is cleared first, since a style and a variable can't both drive one paint
  - Layers with more than one fill or stroke are skipped with a reason, exactly as the styles path does
  - **Apply Style** rows are unaffected — they point at an existing style by design — and the style-name conflict prompt is skipped in Variables mode, since variables don't collide with style names
- **Change Frame** button on the extraction screen, beside **Change Image** — pick any frame on the canvas and extract from its rendered content. It reuses the same `export-selection` path as the landing panel rather than a separate mechanism, so images and frames run through identical extraction
- **Extract colors from a Figma layer, not just a file.** The Extract from image card gained a **Use "<layer>"** button that exports whatever is selected on the canvas (`exportAsync`, PNG, long edge capped at 512px) and runs it through the same extraction. It names the selected layer and is disabled until something is selected. Dragging a layer off the canvas into the plugin is not possible — plugin UI runs in a null-origin iframe, so Figma can't hand it drag data — and this is the supported route in
- Dragging something that carries a **link rather than a file** (e.g. an image dragged from a browser tab) now explains itself instead of failing silently: the plugin is offline by design and has nothing to fetch, so it points at saving the file or using the Figma selection
- **Create Styles or Variables** — both the Colors and Typography Generate screens now carry their own **Create** dropdown (Styles / Variables). The two are independent, so Colors can produce variables while Typography produces styles. Everything else about the screens is unchanged
- **Variables are reused instead of duplicated.** Before anything is created, the file's existing local styles *and* variables are indexed by value:
  - *Creating variables* — an existing variable of the same value is reused; failing that, an existing **style** of the same value supplies both the value and its name, so the two stay recognisably one token
  - *Creating styles* — a new style is **bound** to any existing variable that already holds its value (`setBoundVariableForPaint` for colour, `setBoundVariable` for each text property), so the style references the token rather than copying it
  - *Creating styles* — an existing style with the same value under a different name is reused outright rather than duplicated
  - Colour matching compares hex **and** opacity; typography matching compares font family, style, size, line height and letter spacing
- Typography variables are created as a **group per text style** (`H1/fontFamily`, `H1/fontSize`, `H1/fontStyle`, `H1/lineHeight`, `H1/letterSpacing`), since Figma has no single "text style variable". Number properties become FLOAT variables and font family/style become STRING variables, each scoped (`FONT_SIZE`, `LINE_HEIGHT`, …) so they only appear in the right pickers
- New variables go to a **Design Tokens** collection, created once and reused on later runs. Matching, however, searches every local collection
- **Colors → Extract from image: the number of colors is now yours to choose.** A **Colors** box on the extraction screen takes any value from **2 to 24** (default 12, was a hardcoded 8) and re-runs extraction on the loaded image without re-uploading it
- **Paste an image with ⌘V / Ctrl+V** anywhere on the Colors tab to extract colors from it
- **Drag and drop an image anywhere in the plugin window**, not just onto the small upload card. While a file is dragged, a full-window overlay fades in and states whether that file can be dropped — a different, amber state appears for unsupported file types. Files dropped on other tabs are swallowed so the webview can't navigate away from the plugin

### Changed
- Image sampling no longer smooths when downscaling. Interpolated downscaling blended adjacent pixels and invented colors at every edge, which then surfaced as extracted "colors" the image never contained; sampling is now nearest-neighbour
- Extraction clusters are merged at a fixed perceptual distance (ΔE 9) regardless of the requested count, so a high count returns fewer honest colors instead of splitting one color into near-duplicates. Requesting more colors raises the sampling resolution and the cluster count instead

### Fixed
- **Typography → Generate Text Styles: the "+ Add Text Style" button did nothing.** `.sm-dd-menu-wide` was declared *before* `.sm-dd-menu` with equal specificity, so the base rule's `top` won on source order and the wide menu ended up with both `top` and `bottom` set — collapsing it to 2px of border. The menu was opening with all 14 presets in the DOM, just with no height. Scoped the rule as `.sm-dd-menu.sm-dd-menu-wide` so it wins regardless of source order; it now renders 340px tall above the button. Only this one menu used the `-wide` variant, which is why the other dropdowns were unaffected
- **Colors → Create Color Palette: "+ Add New Color" always added the same purple** (`#7C3AED` was hardcoded), so every added row looked identical. New rows now take the next unused color from a set of 12 distinct hues, then continue around the hue circle at a fixed saturation/brightness, staying distinct and vivid indefinitely
- **Typography → Generate Text Styles stopped working after the first use.** A per-row weight override (set via the pencil editor) was never re-checked against the row's font family, so changing the Heading or Body font left rows asking for a weight that family doesn't have — e.g. Inter's "Semi Bold" against Abhaya Libre's "SemiBold". Generate then hard-failed on a validation toast and created nothing. Overrides are now resolved through `closestStyle()` against the row's actual family
- `closestStyle()` collapsed every weight to Regular when Figma's font list hadn't arrived yet; it now keeps the requested weight until the real list is known
- The preview-fallback note was styled as an amber warning and read like a failure. It is now a neutral "Preview only" note that says explicitly that Generate is unaffected
- The unavailable-weight message now names the style row it refers to, instead of only the font and weight

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
