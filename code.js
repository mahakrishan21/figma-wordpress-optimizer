figma.showUI(__html__, { width: 760, height: 860, themeColors: true });

function broadcastSelection() {
  const sel = figma.currentPage.selection;
  figma.ui.postMessage({
    type: 'selection-changed',
    count: sel.length,
    names: sel.slice(0, 3).map(n => n.name)
  });
}

figma.on('selectionchange', broadcastSelection);
broadcastSelection();

const GENERIC_NAMES = new Set([
  'frame', 'group', 'rectangle', 'vector', 'image', 'text', 'component', 'instance', 'line', 'polygon', 'ellipse', 'star', 'shape', 'copy'
]);
const ISSUE_TO_STAT = {
  'hidden-layer': 'hiddenLayers',
  'generic-name': 'genericNames',
  'deep-nesting': 'deepNesting',
  'missing-text-style': 'missingTextStyles',
  'missing-color-style': 'missingColorStyles',
  'button-no-auto-layout': 'buttonsWithoutAutoLayout',
  'fixed-height-section': 'fixedSectionHeights',
  'flatten-vectors': 'vectorsToFlatten',
  'strokes-found': 'strokesFound',
  'line-object': 'lineObjects',
  'mask-found': 'masksFound',
  'missing-export': 'missingExportSettings',
  'section-no-auto-layout': 'sectionsWithoutAutoLayout',
  'background-layer': 'backgroundWrappers',
  'empty-group': 'emptyGroups',
  // v17 new checks
  'text-overflow': 'textOverflow',
  'auto-line-height': 'autoLineHeight',

  'section-overlap': 'sectionOverlaps',
  'missing-font': 'missingFonts',
  'no-mobile-frame': 'noMobileFrame',
  'interactive-no-states': 'interactivePatterns',
  'multiple-fonts': 'multipleFonts',
  'section-spacing-inconsistency': 'sectionPaddingIssues',
  'image-fit-mode': 'imageFitMode'
};

// Static lookup: why each issue matters and how to fix it.
// Shown in the UI as an expandable "Why & how to fix" panel per issue card.
const ISSUE_DETAILS = {
  'hidden-layer': {
    why: 'Hidden layers are invisible in the final product but bloat the Figma file and confuse developers inspecting the design. They also export in some formats and slow down plugin processing.',
    steps: ['Open the Layers panel (left sidebar).', 'Look for layers with a strikethrough eye icon.', 'Delete layers you no longer need, or move draft content to a separate "Scratch" page outside the handoff frame.', 'Use the automated "Remove hidden layers" button in this plugin to clear them in bulk.']
  },
  'generic-name': {
    why: 'Layer names become CSS class names, ACF field keys, and component IDs in WordPress. A name like "Frame 47" is meaningless to a developer and forces them to guess the intent.',
    steps: ['Double-click the layer name in the Layers panel.', 'Use a descriptive semantic name: "Hero Section", "Primary CTA Button", "Team Card".', 'For text nodes, the plugin will rename them to their content automatically.', 'Use the "Rename generic layers" button to batch-fix all detected generic names.']
  },
  'deep-nesting': {
    why: 'Deeply nested wrapper frames add zero visual value but create complex DOM hierarchies in WordPress. Each unnecessary wrapper layer becomes an extra HTML div a developer must wade through.',
    steps: ['Select the nested wrapper frame.', 'Check if it serves a layout purpose (padding, overflow clipping) or is just grouping.', 'If purely structural, select all children (Cmd/Ctrl+A), cut, and paste them into the parent frame.', 'Delete the now-empty wrapper. Re-check that spacing and alignment are preserved.']
  },
  'missing-text-style': {
    why: 'Text without a linked style forces developers to hard-code font size, weight, and line-height inline. When the brand typography changes, they must hunt down every instance manually instead of updating one CSS variable.',
    steps: ['Select the text node.', 'In the right panel, look for "Text Styles" (the 4-dot grid icon near the font name).', 'Click the icon and pick an existing style that matches, or click "+" to create a new one.', 'Name the style semantically: "Heading/H2", "Body/Regular", "Label/Small".', 'Re-run the audit to confirm the issue resolves.']
  },
  'missing-color-style': {
    why: 'Unlinked fill colors become magic hex values in CSS. If the brand color changes from #1A73E8 to #1557B0, a developer must manually find and replace every instance instead of changing one CSS custom property.',
    steps: ['Select the layer with the unlinked fill.', 'In the Fill section of the right panel, click the 4-dot style icon.', 'Choose an existing color style or create a new one via "+".', 'Name it clearly: "Primary/Brand Blue", "Neutral/Background".', 'Alternatively, bind it to a Figma Variable for dark mode / theming support.']
  },
  'button-no-auto-layout': {
    why: 'Buttons built without Auto Layout have a fixed width that does not adapt to label length. Developers implementing this as a CSS button will end up with text overflow or rigid widths that break responsively.',
    steps: ['Select the button frame.', 'Press Shift+A (or right-click → Add Auto Layout).', 'Set Horizontal direction, add left/right padding to match your design (e.g. 20px).', 'Set "Hug" on width so the button shrinks/grows with its label.', 'Use the "Convert buttons to Auto Layout" action in this plugin to fix detected buttons automatically.']
  },
  'section-no-auto-layout': {
    why: 'Sections without Auto Layout use absolute coordinates for their children. Developers must hard-code each child\'s position in CSS, making the layout fragile and non-responsive when content changes.',
    steps: ['Select the section frame.', 'Press Shift+A to add Auto Layout.', 'Choose Vertical for stacked sections, Horizontal for side-by-side columns.', 'Set padding (top/bottom/left/right) to match the design\'s visual spacing.', 'Use the "Make Auto Layout" button in this plugin to batch-convert detected sections.']
  },
  'fixed-height-section': {
    why: 'A section with a fixed pixel height will clip content in WordPress when text length varies (CMS content, translations, user-generated data). Content-driven height adapts naturally.',
    steps: ['Select the section frame.', 'In the right panel, change Height from a fixed value to "Hug contents".', 'Add explicit padding-top and padding-bottom instead of relying on the frame height.', 'If the section must be a fixed height (e.g. full-viewport hero), set min-height in code and let the design show the minimum.']
  },
  'flatten-vectors': {
    why: 'Icon groups with multiple vector paths create unnecessary nesting in the exported SVG. A flat, merged vector exports as a single clean path that\'s easier to style, animate, and compress.',
    steps: ['Select the icon group.', 'Press Cmd/Ctrl+E (Flatten) to merge all paths into one.', 'Rename the resulting vector to something descriptive ("chevron-down", "arrow-right").', 'Use the "Flatten selected vectors" button to flatten all detected icons at once.']
  },
  'empty-group': {
    why: 'Empty groups are leftover containers that add clutter to the layer panel, confuse developers, and can cause unexpected behaviour when scripts iterate over all children.',
    steps: ['Select the empty group.', 'Press Backspace or Delete to remove it.', 'If the group was intentional (placeholder), add a comment or rename it to "~placeholder" to signal intent.']
  },
  'strokes-found': {
    why: 'Thin decorative strokes on vector or line nodes are brittle in CSS. They do not scale correctly at different pixel densities and force developers to use SVG stroke-width instead of a simpler border or background approach.',
    steps: ['Select the node with the thin stroke.', 'If it is a separator, convert it to a 1px-tall rectangle with a fill instead of a LINE with a stroke.', 'If it is an icon outline, keep the stroke inside the vector and flatten the paths (Cmd/Ctrl+E).', 'For container borders (cards, inputs), use the frame\'s own stroke property — those map cleanly to CSS border.']
  },
  'line-object': {
    why: 'Figma LINE nodes export poorly — they have no area, making them tricky to interact with and impossible to style consistently. CSS borders on containers are more robust and semantically correct.',
    steps: ['Delete the LINE node.', 'Select the container frame above or below the line.', 'Add a bottom border (stroke) to the container frame in Figma.', 'In code, this becomes border-bottom: 1px solid <color> on the parent element — reliable and responsive.']
  },
  'mask-found': {
    why: 'Figma masks clip a layer using another layer\'s shape. In WordPress this maps to CSS clip-path or overflow:hidden, which can cause unexpected clipping on mobile or when content grows. An Image Fill achieves the same crop with zero extra DOM nodes.',
    steps: ['Identify what the mask is clipping (usually a photo inside a shape).', 'Delete the mask layer and the masked image.', 'Select the shape that was the mask (rectangle, circle, etc.).', 'Add an Image Fill to that shape instead: Fill panel → click "+" → choose Image.', 'The shape now holds the image natively — no mask needed.']
  },
  'background-layer': {
    why: 'A standalone full-width rectangle used only as a background creates an extra DOM element. Applying the fill directly to the parent container eliminates the extra layer and keeps the HTML shallower.',
    steps: ['Note the fill color or image on the background rectangle.', 'Select the parent frame that contains this rectangle.', 'Apply the same fill to the parent frame directly.', 'Delete the standalone rectangle.', 'Verify nothing visually changed — the parent frame now carries the background.']
  },
  'missing-export': {
    why: 'Assets without export settings cannot be exported from Figma programmatically. Developers must manually drag images out, which breaks automated handoff pipelines and causes inconsistent resolution.',
    steps: ['Select the asset (image, icon, illustration).', 'In the right panel, scroll to "Export" at the bottom.', 'Click "+" to add an export preset.', 'For photos: PNG @2x. For icons/logos: SVG.', 'Use the "Mark exportable assets" button to bulk-add export settings to all detected assets.']
  },
  'image-fit-mode': {
    why: 'Fit mode leaves letterboxing (whitespace) around the image because it scales to fit rather than cover. Crop mode manually repositions the image inside the frame — the exact pan/zoom values are stored in an imageTransform matrix that developers cannot easily read or replicate in CSS, so the image often looks different in the built WordPress page. Both modes should be replaced with Fill (cover) for reliable handoff.',
    steps: ['Select the layer.', 'In the Fill panel, click the image fill swatch to open the image editor.', 'Change the scale mode from "Fit" or "Crop" to "Fill" (the cover icon).', 'If the image focal point shifts, use the pan handles inside the fill editor to recentre the subject.', 'Alternatively, pre-crop the image in an external editor and re-import it so no Figma transform is needed.', 'Re-run the audit to confirm the issue is resolved.']
  },
  // v17 new checks
  'text-overflow': {
    why: 'The text node\'s bounding box extends past its parent container. In WordPress, browsers clip this overflow or wrap text differently depending on CSS rules — the rendered result will not match the design.',
    steps: ['Select the text node shown in the path above.', 'Option 1: Resize the parent frame so it is wide/tall enough to contain the text.', 'Option 2: Set the text\'s resize mode to "Auto height" or "Auto width" so it grows with content.', 'Option 3: Shorten the copy if it is placeholder text that will be shorter in production.', 'Re-run the audit to confirm the overflow is resolved.']
  },
  'auto-line-height': {
    why: 'Figma\'s AUTO line-height uses the font\'s internal metrics, which differ between operating systems and browsers. Without an explicit px or % value, the developer must guess — leading to subtle spacing differences between the design and the built page.',
    steps: ['Select the text node.', 'In the right panel, find the Line height field (looks like multi-line spacing icon).', 'Replace "Auto" with a specific value — common ratios: body text = 1.5× font size, headings = 1.1–1.25× font size.', 'For 16px body text, try 24px (150%) as a starting point.', 'Bind it to a text style so the value propagates across all matching text nodes.']
  },

  'section-overlap': {
    why: 'Overlapping sections map to either a negative margin-top or position:absolute with z-index in CSS — both are fragile and can break the layout at different viewport widths or when content changes length.',
    steps: ['Check if the overlap is intentional (e.g. a card that visually bleeds into the next section).', 'If intentional: document it with a note on the frame ("Intentional overlap: card bleeds 40px into next section").', 'If unintentional: drag one section up or down until its bounding box no longer overlaps the other.', 'Use Figma\'s smart guides — hold Shift while dragging — to snap to integer Y values.', 'Re-run the audit to confirm the overlap is resolved.']
  },
  'missing-font': {
    why: 'Figma renders a fallback font when a font is not installed. The developer sees the correct font name in the spec but cannot reproduce the exact metrics — weight, tracking, and line-height all differ per font family.',
    steps: ['Install the missing font on your system. For Google Fonts: download from fonts.google.com and install via Font Book (macOS).', 'For licensed fonts: ask your brand team for the font file.', 'After installing, restart Figma — new fonts do not appear until Figma relaunches.', 'Alternative: replace the font in the design with one that is already available across your team.', 'Re-run the audit to confirm the font loads successfully.']
  },
  'no-mobile-frame': {
    why: 'WordPress themes are built mobile-first. Without a mobile frame, developers must guess how the layout adapts below 768px — breakpoints, font sizes, column stacking, and padding all need explicit design decisions.',
    steps: ['Duplicate your desktop frame (Cmd/Ctrl+D).', 'Resize the duplicate to 375px wide (standard iPhone viewport).', 'Adapt the layout: stack columns vertically, increase tap targets to ≥44px, adjust font sizes for readability.', 'Name the frame consistently with the desktop counterpart: "Home — Mobile" if desktop is "Home — Desktop".', 'Re-run the audit from this mobile frame to check for layout issues at the narrower width.']
  },
  'interactive-no-states': {
    why: 'Interactive components (carousels, accordions, modals, tabs) require multiple states to be implemented in WordPress — open/closed, hover, active, disabled. Without designed states, developers invent their own interactions, which will not match the intended UX.',
    steps: ['Select the interactive component.', 'Convert it to a Figma Component (Cmd/Ctrl+Alt+K) if it is not already one.', 'Add variants via the Component panel: "State=Default", "State=Hover", "State=Open" (for accordions/modals), "State=Active" (for tabs).', 'Design each state by duplicating the default and making the interaction-specific changes.', 'Use Prototype → Interactive Components to wire the states so they preview correctly in Figma.']
  },
  'multiple-fonts': {
    why: 'More than two distinct font families in a design often signals an accidental font substitution. Each unique font family adds an extra web font request in WordPress, increasing page load time and potentially mismatching the brand guidelines.',
    steps: ['Open the right panel and inspect the font family fields across text nodes.', 'Identify which font is the "intruder" — often a system font (Helvetica, Arial) that replaced a brand font that wasn\'t installed.', 'Select all text nodes using the unwanted font (Edit → Select All with Same Font).', 'Change the font family to the correct brand font.', 'Re-run the audit to confirm only the expected 1–2 font families remain.']
  },
  'section-spacing-inconsistency': {
    why: 'Inconsistent section padding breaks the visual rhythm of the page and forces developers to hard-code differing spacing values rather than using a shared spacing token or scale.',
    steps: ['Note the expected padding value shown in this issue — it reflects the dominant pattern across similar sections on this page.', 'Select the section and adjust its padding (via Auto Layout or frame constraints) to align with that value.', 'Use a Figma variable or spacing token so all sections stay in sync when the value changes.', 'Compare this section side-by-side with adjacent sections in the canvas to verify the visual rhythm is restored.']
  }
};

let lastAuditNodeIds = [];
let lastAuditIssueTypesByNode = new Map();
let ignoredIssueKeys = new Set();
let lastUserSelectionIds = [];

function captureSelectionIds() {
  lastUserSelectionIds = figma.currentPage.selection.map(n => n.id);
}

async function restoreSelectionIds() {
  if (!lastUserSelectionIds.length) return;
  const restored = [];
  for (const id of lastUserSelectionIds) {
    try {
      const node = await figma.getNodeByIdAsync(id);
      if (node && isEditableNode(node) && node.parent) restored.push(node);
    } catch (e) {}
  }
  try {
    if (restored.length) figma.currentPage.selection = restored;
  } catch (e) {}
}

function pause() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function normalizeName(name) {
  return (name || '').trim().toLowerCase();
}

function isSceneNode(node) {
  return node && typeof node.type === 'string' && node.visible !== undefined;
}

function hasChildren(node) {
  return node && 'children' in node && Array.isArray(node.children);
}

function isAutoLayoutFrame(node) {
  return (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') && node.layoutMode && node.layoutMode !== 'NONE';
}

function isLikelyButton(node) {
  const n = normalizeName(node.name);
  if (n.includes('button') || n.includes('btn') || n.includes('cta')) return true;
  if ((node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE' || node.type === 'GROUP') && hasChildren(node)) {
    if (isLikelySection(node) || isLikelySectionByStructure(node)) return false;
    const textChildren = node.children.filter(c => c.type === 'TEXT');
    return textChildren.length >= 1 && node.children.length <= 6 && node.width <= 420 && node.height <= 140;
  }
  return false;
}

function isLikelySection(node) {
  const n = normalizeName(node.name);
  return node.type === 'SECTION' || n.includes('section') || n.includes('hero') || n.includes('footer') || n.includes('header') || n.includes('testimonial') || n.includes('feature') || n.includes('content');
}

function isLikelySectionByStructure(node) {
  if (!node || !['FRAME', 'GROUP', 'COMPONENT', 'INSTANCE'].includes(node.type)) return false;
  const parent = node.parent;
  const w = typeof node.width === 'number' ? node.width : 0;
  const h = typeof node.height === 'number' ? node.height : 0;
  const pw = parent && typeof parent.width === 'number' ? parent.width : 0;
  const directOnPage = parent && parent.type === 'PAGE';
  const nearFullWidth = pw > 0 ? w >= pw * 0.7 : w >= 900;
  const substantialBlock = h >= 180;
  const hasManyChildren = hasChildren(node) && node.children.length >= 2;
  return ((directOnPage && substantialBlock) || (nearFullWidth && substantialBlock && hasManyChildren));
}

function shouldTreatAsSection(node) {
  return isLikelySection(node) || isLikelySectionByStructure(node);
}

function getVisibleEditableChildren(node) {
  if (!hasChildren(node)) return [];
  return node.children.filter(child => isEditableNode(child) && child.visible !== false);
}

function median(values) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function inferAutoLayoutAxis(node) {
  const children = getVisibleEditableChildren(node);
  if (children.length < 2) return 'VERTICAL';

  const centersX = children.map(c => (c.x || 0) + (c.width || 0) / 2);
  const centersY = children.map(c => (c.y || 0) + (c.height || 0) / 2);
  const spreadX = Math.max.apply(null, centersX) - Math.min.apply(null, centersX);
  const spreadY = Math.max.apply(null, centersY) - Math.min.apply(null, centersY);

  const widths = children.map(c => c.width || 0);
  const heights = children.map(c => c.height || 0);
  const medianWidth = median(widths);
  const medianHeight = median(heights);

  const sortedByY = children.slice().sort((a, b) => a.y - b.y);
  const sortedByX = children.slice().sort((a, b) => a.x - b.x);

  const ySteps = [];
  for (let i = 1; i < sortedByY.length; i++) {
    ySteps.push(Math.abs((sortedByY[i].y || 0) - (sortedByY[i - 1].y || 0)));
  }
  const xSteps = [];
  for (let i = 1; i < sortedByX.length; i++) {
    xSteps.push(Math.abs((sortedByX[i].x || 0) - (sortedByX[i - 1].x || 0)));
  }

  const medianYStep = median(ySteps);
  const medianXStep = median(xSteps);

  const looksHorizontal =
    (spreadX > spreadY * 1.25 && medianWidth > medianHeight * 0.6) ||
    (medianXStep > 0 && medianXStep >= medianYStep * 1.25 && spreadX > medianWidth);

  return looksHorizontal ? 'HORIZONTAL' : 'VERTICAL';
}

function inferItemSpacing(node, axis) {
  const children = getVisibleEditableChildren(node);
  if (children.length < 2) return 0;
  const sorted = children.slice().sort((a, b) => axis === 'HORIZONTAL' ? a.x - b.x : a.y - b.y);
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const prevEnd = axis === 'HORIZONTAL' ? (prev.x || 0) + (prev.width || 0) : (prev.y || 0) + (prev.height || 0);
    const currStart = axis === 'HORIZONTAL' ? (curr.x || 0) : (curr.y || 0);
    const gap = Math.round(currStart - prevEnd);
    if (gap >= 0 && gap < 500) gaps.push(gap);
  }
  return Math.max(0, Math.round(median(gaps)));
}

function applySmartAutoLayout(frame) {
  const axis = inferAutoLayoutAxis(frame);
  frame.layoutMode = axis;
  frame.primaryAxisSizingMode = 'AUTO';
  frame.counterAxisSizingMode = 'AUTO';
  frame.primaryAxisAlignItems = 'MIN';
  frame.counterAxisAlignItems = 'MIN';
  frame.itemSpacing = inferItemSpacing(frame, axis);
  if ('strokesIncludedInLayout' in frame) frame.strokesIncludedInLayout = true;
  return axis;
}

function isVectorLikeNode(node) {
  return !!node && ['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'ELLIPSE', 'POLYGON', 'RECTANGLE', 'LINE'].includes(node.type);
}

function hasImageFill(node) {
  return !!node && ('fills' in node) && node.fills !== figma.mixed && Array.isArray(node.fills) && node.fills.some(f => f.type === 'IMAGE');
}

function isRasterLikeNode(node) {
  const n = normalizeName(node.name || '');
  return hasImageFill(node) || n.includes('image') || n.includes('photo') || n.includes('hero') || n.includes('banner') || n.includes('thumbnail');
}

function isVectorContainer(node) {
  return hasChildren(node) && node.children.length > 0 && node.children.every(c => isVectorLikeNode(c));
}

function getExportSpec(node) {
  const imageLike = isRasterLikeNode(node);
  const vectorLike = isVectorLikeNode(node) || isVectorContainer(node);
  if (imageLike) {
    return { format: 'PNG', constraint: { type: 'SCALE', value: 2 }, suffix: '' };
  }
  if (vectorLike || /icon|logo|illustration|graphic/.test(normalizeName(node.name))) {
    return { format: 'SVG', contentsOnly: true, suffix: '' };
  }
  return { format: 'PNG', constraint: { type: 'SCALE', value: 2 }, suffix: '' };
}

function getAllNodes(rootNodes) {
  const out = [];
  const visit = (node, depth = 0, parent = null) => {
    if (!isSceneNode(node)) return;
    out.push({ node, depth, parent });
    if (hasChildren(node)) {
      for (const child of node.children) visit(child, depth + 1, node);
    }
  };
  for (const root of rootNodes) visit(root, 0, null);
  return out;
}

function getScopeNodes() {
  return figma.currentPage.selection.slice();
}

async function resolveNodesByIds(ids) {
  const out = [];
  for (const id of ids) {
    try {
      const node = await figma.getNodeByIdAsync(id);
      if (node) out.push(node);
    } catch (e) {}
  }
  return out;
}

async function getActionNodes(preferIssueTypes = null) {
  let nodes = [];
  if (lastAuditNodeIds.length) {
    nodes = await resolveNodesByIds(lastAuditNodeIds);
  } else {
    nodes = getAllNodes(getScopeNodes()).map(x => x.node);
  }
  if (preferIssueTypes && preferIssueTypes.length) {
    nodes = nodes.filter(node => {
      const issueTypes = lastAuditIssueTypesByNode.get(node.id) || [];
      return issueTypes.some(type => preferIssueTypes.includes(type));
    });
  }
  const seen = new Set();
  return nodes.filter(node => {
    if (!node || seen.has(node.id)) return false;
    seen.add(node.id);
    return true;
  });
}

function getVisibleTextCandidates(node, limit = 24) {
  const out = [];
  const visit = (current) => {
    if (!current || out.length >= limit) return;
    if (current.type === 'TEXT') {
      const text = (current.characters || '').replace(/\s+/g, ' ').trim();
      if (text) out.push({ node: current, text, size: typeof current.fontSize === 'number' ? current.fontSize : 0, y: typeof current.y === 'number' ? current.y : 0 });
      return;
    }
    if (hasChildren(current) && !ancestorTypes(current).includes('INSTANCE')) {
      for (const child of current.children) {
        if (out.length >= limit) break;
        visit(child);
      }
    }
  };
  visit(node);
  return out;
}

function prettifySectionLabel(text) {
  if (!text) return '';
  let t = text.replace(/[|•·]+/g, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/^(welcome to|discover|explore|learn more about)\s+/i, '');
  t = t.replace(/[.!?,:;]+$/g, '').trim();
  if (!t) return '';
  const words = t.split(' ').filter(Boolean).slice(0, 4);
  const cleaned = words.join(' ');
  return cleaned.length > 40 ? cleaned.slice(0, 40).trim() : cleaned;
}

function inferSectionNameFromContent(node) {
  const texts = getVisibleTextCandidates(node);
  if (!texts.length) return '';
  texts.sort((a, b) => {
    if ((b.size || 0) !== (a.size || 0)) return (b.size || 0) - (a.size || 0);
    return (a.y || 0) - (b.y || 0);
  });
  for (const item of texts) {
    const label = prettifySectionLabel(item.text);
    if (!label) continue;
    if (/^(home|menu|read more|learn more|contact us|get started)$/i.test(label)) continue;
    const suffix = /section$/i.test(label) ? '' : ' Section';
    return label + suffix;
  }
  return '';
}

function inferName(node) {
  if (node.type === 'TEXT') {
    const text = (node.characters || '').trim();
    if (!text) return 'Text Content';
    return text.length > 32 ? text.slice(0, 32).trim() + '…' : text;
  }
  if (isLikelyButton(node)) {
    const texts = getVisibleTextCandidates(node, 6);
    const label = texts.length ? prettifySectionLabel(texts[0].text) : '';
    return label ? label + ' Button' : 'Button';
  }
  if (isLikelySection(node) || node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'COMPONENT' || node.type === 'SECTION') {
    const fromContent = inferSectionNameFromContent(node);
    if (fromContent) return fromContent;
    if (isLikelySection(node)) return 'Section';
  }
  if (node.type === 'RECTANGLE' && hasImageFill(node)) return 'Image';
  if (node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION') return 'Icon';
  if (node.type === 'LINE') return 'Divider';
  if (node.type === 'GROUP') return 'Content Group';
  if (node.type === 'FRAME') return 'Content Frame';
  if (node.type === 'COMPONENT') return 'Component Block';
  return node.type.charAt(0) + node.type.slice(1).toLowerCase();
}

function nodePath(node) {
  const parts = [];
  let current = node;
  while (current && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
    parts.unshift(current.name);
    current = current.parent;
  }
  return parts.join(' › ');
}

function hasStyleOrVariableForText(node) {
  if (node.type !== 'TEXT') return true;
  // figma.mixed means each text range has its own style applied — intentionally mixed, not unstyled
  if (node.textStyleId === figma.mixed) return true;
  const hasStyle = !!node.textStyleId;
  const bound = node.boundVariables || {};
  const hasVar = !!bound.fontSize || !!bound.fontFamily || !!bound.fontWeight || !!bound.letterSpacing || !!bound.lineHeight || !!bound.paragraphSpacing || !!bound.fills || !!bound.textRangeFills;
  return hasStyle || hasVar;
}

function paintUsesStyleOrVariable(node) {
  if (!('fills' in node)) return true;
  if (node.fills === figma.mixed) return true;
  if (!Array.isArray(node.fills) || node.fills.length === 0) return true;
  const solidPaints = node.fills.filter(f => f.type === 'SOLID');
  if (solidPaints.length === 0) return true;

  const hasStyle = 'fillStyleId' in node && !!node.fillStyleId && node.fillStyleId !== figma.mixed;
  const nodeBound = node.boundVariables || {};
  const hasNodeVar = !!nodeBound.fills || !!nodeBound.fill || !!nodeBound.color;
  const hasPaintVar = solidPaints.some(p => !!p.boundVariables && (!!p.boundVariables.color || !!p.boundVariables.opacity));
  return hasStyle || hasNodeVar || hasPaintVar;
}

function ancestorTypes(node) {
  const out = [];
  let current = node.parent;
  while (current && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
    out.push(current.type);
    current = current.parent;
  }
  return out;
}

function isEditableNode(node) {
  return !!node && !node.removed;
}

function getBlockedReason(node, action) {
  if (!isEditableNode(node)) return 'Node no longer exists.';
  if (node.locked) return 'Node is locked.';
  const ancestors = ancestorTypes(node);
  if (ancestors.includes('INSTANCE')) return 'Node is inside an instance. Figma blocks this edit unless you detach the instance.';
  if ((action === 'remove-hidden' || action === 'rename-generic' || action === 'convert-buttons' || action === 'add-export-settings' || action === 'section-auto-layout') && node.parent && node.parent.type === 'INSTANCE') {
    return 'Node is inside an instance. Figma blocks this edit unless you detach the instance.';
  }
  if (action === 'convert-buttons' && node.type === 'INSTANCE') return 'This button is an instance. Detach it before converting layout.';
  if (action === 'flatten-vectors' && ancestorTypes(node).includes('INSTANCE')) return 'Vector is inside an instance. Detach the instance before flattening.';
  return null;
}

function shouldIgnoreIssue(nodeId, type) {
  return ignoredIssueKeys.has(`${nodeId}:${type}`);
}

function addIssue(issues, stats, type, severity, message, node, statKey, action = null, extra = {}) {
  if (shouldIgnoreIssue(node.id, type)) return;
  // Nodes inside instances are read-only — silently skip all rules
  if (ancestorTypes(node).includes('INSTANCE')) return;
  const blockedReason = action ? getBlockedReason(node, action) : null;
  const actionable = action ? !blockedReason : false;
  if (statKey) stats[statKey]++;
  if (action && actionable) stats.actionable[statKey] = (stats.actionable[statKey] || 0) + 1;
  const issue = {
    type: type,
    severity: severity,
    message: message,
    nodeId: node.id,
    path: nodePath(node),
    actionable: actionable,
    blockedReason: blockedReason,
    action: action,
    details: ISSUE_DETAILS[type] || null
  };
  for (const k in extra) issue[k] = extra[k];
  issues.push(issue);
}

function isGenericName(node) {
  const raw = (node.name || '').trim();
  const name = normalizeName(raw);
  if (isVectorLikeNode(node)) return false;
  // Components, instances, and any node nested inside an instance are dynamic — skip
  if (node.type === 'INSTANCE' || node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') return false;
  if (ancestorTypes(node).includes('INSTANCE')) return false;
  if (!raw) return true;
  if (/^(frame|group|rectangle|text|component|instance)(\s+\d+)?$/i.test(raw)) return true;
  if (GENERIC_NAMES.has(name) && name !== 'vector' && name !== 'line' && name !== 'ellipse' && name !== 'polygon' && name !== 'star') return true;
  return false;
}

function wrapperLike(node) {
  if (!node) return false;
  const n = normalizeName(node.name);
  if (!(node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'COMPONENT')) return false;
  return isGenericName(node) || n.includes('wrapper') || n.includes('inner') || n.includes('outer');
}

function deepWrapperDepth(entry) {
  let depth = 0;
  let current = entry.node;
  while (current && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
    if (wrapperLike(current)) {
      depth++;
    } else {
      break;
    }
    current = current.parent;
  }
  return depth;
}

function hasFixedHeightSignal(node) {
  return (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'SECTION') && typeof node.height === 'number' && !isAutoLayoutFrame(node) && node.height >= 240;
}

function isExportableLeaf(node) {
  if (!isEditableNode(node)) return false;
  if (node.type === 'INSTANCE') return false;

  const name = normalizeName(node.name);
  const children = hasChildren(node) ? node.children.filter(c => isEditableNode(c)) : [];
  const hasRasterFill = hasImageFill(node);
  const semanticAssetName = /image|photo|hero|banner|thumbnail|logo|icon|illustration|graphic|map|media/.test(name);
  const leafishContainer = ['FRAME', 'COMPONENT', 'GROUP', 'RECTANGLE'].includes(node.type) && (
    children.length === 0 ||
    semanticAssetName ||
    (children.length <= 2 && children.every(c => c.type === 'VECTOR' || c.type === 'TEXT'))
  );
  const likelyLayoutContainer = ['FRAME', 'COMPONENT', 'SECTION'].includes(node.type) && children.length >= 3 && !semanticAssetName && !hasRasterFill;

  if (hasRasterFill && !likelyLayoutContainer && leafishContainer) return true;
  if (['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'ELLIPSE', 'POLYGON', 'LINE'].includes(node.type)) return true;

  if (node.type === 'GROUP' && children.length > 0) {
    const directRaster = children.filter(c => hasImageFill(c));
    const directVectors = children.filter(c => isVectorLikeNode(c));
    if (directRaster.length === 1 && children.length <= 3) return true;
    if (directVectors.length >= 2 && children.length === directVectors.length && (semanticAssetName || (node.width <= 600 && node.height <= 600))) return true;
  }
  return false;
}

function gatherExportCandidates(roots) {
  const entries = getAllNodes(roots);
  const candidates = [];
  const seen = new Set();

  const addCandidate = (node) => {
    if (!node || seen.has(node.id)) return;
    if (node.exportSettings && node.exportSettings.length > 0) return;
    if (isExportableLeaf(node)) {
      candidates.push(node);
      seen.add(node.id);
    }
  };

  for (const root of roots) addCandidate(root);

  for (const { node } of entries) {
    if (!isEditableNode(node) || seen.has(node.id)) continue;
    if (node.exportSettings && node.exportSettings.length > 0) continue;

    if (isExportableLeaf(node)) {
      let hasExportableAncestor = false;
      let current = node.parent;
      while (current && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
        if (seen.has(current.id)) {
          hasExportableAncestor = true;
          break;
        }
        current = current.parent;
      }
      if (!hasExportableAncestor) {
        candidates.push(node);
        seen.add(node.id);
        continue;
      }
    }

    if ((node.type === 'GROUP' || node.type === 'FRAME' || node.type === 'COMPONENT') && hasChildren(node)) {
      const imageChildren = node.children.filter(c => hasImageFill(c) && (!c.exportSettings || c.exportSettings.length === 0));
      if (imageChildren.length === 1 && node.children.length <= 4 && !seen.has(imageChildren[0].id)) {
        candidates.push(imageChildren[0]);
        seen.add(imageChildren[0].id);
      }
    }
  }
  return candidates;
}

function createEmptyStats(checkedNodes = 0) {
  return {
    checkedNodes,
    hiddenLayers: 0,
    genericNames: 0,
    deepNesting: 0,
    missingTextStyles: 0,
    missingColorStyles: 0,
    buttonsWithoutAutoLayout: 0,
    fixedSectionHeights: 0,
    vectorsToFlatten: 0,
    strokesFound: 0,
    lineObjects: 0,
    masksFound: 0,
    missingExportSettings: 0,
    sectionsWithoutAutoLayout: 0,
    backgroundWrappers: 0,
    emptyGroups: 0,
    // v17 new stats
    textOverflow: 0,
    autoLineHeight: 0,

    sectionOverlaps: 0,
    missingFonts: 0,
    noMobileFrame: 0,
    interactivePatterns: 0,
    multipleFonts: 0,
    sectionPaddingIssues: 0,
    imageFitMode: 0,
    actionable: {}
  };
}

function summarizeIssues(issues, checkedNodes, scope) {
  const stats = createEmptyStats(checkedNodes);
  for (const issue of issues) {
    const key = ISSUE_TO_STAT[issue.type];
    if (key) stats[key]++;
    if (issue.actionable && issue.action && key) stats.actionable[key] = (stats.actionable[key] || 0) + 1;
  }
  return { issues, stats, scope };
}

async function collectIssues() {
  const scopeNodes = getScopeNodes();
  const entries = getAllNodes(scopeNodes);
  const issues = [];
  const stats = createEmptyStats(entries.length);
  const batchSize = 120;

  for (let i = 0; i < entries.length; i++) {
    const { node, depth, parent } = entries[i];
    try {
      const name = normalizeName(node.name);

      if (!node.visible) addIssue(issues, stats, 'hidden-layer', 'medium', 'Hidden layer should be removed before handoff.', node, 'hiddenLayers', 'remove-hidden');

      if (isGenericName(node)) addIssue(issues, stats, 'generic-name', 'medium', 'Layer name is generic. Use a clear and descriptive name.', node, 'genericNames', 'rename-generic');

      if (deepWrapperDepth({ node }) >= 3 || (depth >= 5 && wrapperLike(parent))) {
        addIssue(issues, stats, 'deep-nesting', 'medium', 'Hierarchy is deeply nested with wrapper-like containers. Keep nesting only where it is structurally needed.', node, 'deepNesting');
      }

      var _inComponentCtx = node.type === 'INSTANCE' || node.type === 'COMPONENT' || node.type === 'COMPONENT_SET' ||
        ancestorTypes(node).includes('COMPONENT') || ancestorTypes(node).includes('INSTANCE');

      if (node.type === 'TEXT' && !hasStyleOrVariableForText(node) && !_inComponentCtx) {
        addIssue(issues, stats, 'missing-text-style', 'high', 'Text is not linked to a text style or variable.', node, 'missingTextStyles');
      }

      if (('fills' in node) && !paintUsesStyleOrVariable(node) && !_inComponentCtx) {
        addIssue(issues, stats, 'missing-color-style', 'high', 'Solid fill is not linked to a style or variable.', node, 'missingColorStyles');
      }

      if (isLikelyButton(node) && !isAutoLayoutFrame(node)) {
        const hasButtonAncestorWithAutoLayout = ancestorTypes(node).includes('FRAME') && node.parent && isAutoLayoutFrame(node.parent);
        if (!hasButtonAncestorWithAutoLayout) {
          addIssue(issues, stats, 'button-no-auto-layout', 'high', 'Button should be built with an Auto Layout frame.', node, 'buttonsWithoutAutoLayout', 'convert-buttons');
        }
      }

      if (shouldTreatAsSection(node) && (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE' || node.type === 'GROUP')) {
        const hasAutoLayoutChildren = hasChildren(node) && node.children.some(child => 
          (child.type === 'FRAME' || child.type === 'COMPONENT' || child.type === 'INSTANCE') && isAutoLayoutFrame(child)
        );
        if (!isAutoLayoutFrame(node) && !hasAutoLayoutChildren) {
          addIssue(issues, stats, 'section-no-auto-layout', 'high', 'Section should use Auto Layout for stacking and responsive behavior.', node, 'sectionsWithoutAutoLayout', 'section-auto-layout');
        }
        if (hasFixedHeightSignal(node)) {
          addIssue(issues, stats, 'fixed-height-section', 'medium', 'Section appears to rely on a fixed height. Prefer content-driven height with padding.', node, 'fixedSectionHeights');
        }
      }

      if ((node.type === 'GROUP' || node.type === 'FRAME' || node.type === 'COMPONENT') && hasChildren(node)) {
        const directVectorLike = node.children.filter(c => ['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'ELLIPSE', 'POLYGON', 'RECTANGLE'].includes(c.type));
        const isIcon = node.width <= 64 && node.height <= 64;
        const isSmallGraphic = node.width <= 150 && node.height <= 150;
        const hasIconName = node.name.toLowerCase().includes('icon') || node.name.toLowerCase().includes('ico');
        if (directVectorLike.length >= 2 && (isIcon || (isSmallGraphic && hasIconName))) {
          addIssue(issues, stats, 'flatten-vectors', 'low', 'Icon vector group may be flattened to reduce nested structure.', node, 'vectorsToFlatten', 'flatten-vectors');
        }
        if (node.type === 'GROUP' && node.children.length === 0) {
          addIssue(issues, stats, 'empty-group', 'medium', 'Empty group should be removed.', node, 'emptyGroups');
        }
      }

      if (isThinStrokeCandidate(node)) {
        addIssue(issues, stats, 'strokes-found', 'low', 'Thin stroke may be better handled as a fill or dedicated separator asset.', node, 'strokesFound');
      }

      if (node.type === 'LINE') addIssue(issues, stats, 'line-object', 'high', 'Avoid line objects for separators. Use borders on the relevant container instead.', node, 'lineObjects');
      if ('isMask' in node && node.isMask) addIssue(issues, stats, 'mask-found', 'high', 'Avoid masks where Image Fill can be used instead.', node, 'masksFound');

      // ── v17: Text overflow ─────────────────────────────────────────────
      if (node.type === 'TEXT' && node.absoluteBoundingBox && node.parent && node.parent.absoluteBoundingBox && node.parent.type !== 'PAGE') {
        const tb = node.absoluteBoundingBox;
        const pb = node.parent.absoluteBoundingBox;
        const overflowRight  = (tb.x + tb.width)  - (pb.x + pb.width);
        const overflowBottom = (tb.y + tb.height) - (pb.y + pb.height);
        if (overflowRight > 5 || overflowBottom > 5) {
          const px = Math.round(Math.max(overflowRight, overflowBottom));
          addIssue(issues, stats, 'text-overflow', 'high', `Text overflows its container by ${px}px — content will clip at runtime.`, node, 'textOverflow');
        }
      }

      // ── v17: Auto line-height ──────────────────────────────────────────
      if (node.type === 'TEXT' && node.lineHeight !== figma.mixed) {
        const lh = node.lineHeight;
        if (lh && lh.unit === 'AUTO') {
          addIssue(issues, stats, 'auto-line-height', 'medium', 'Text uses AUTO line-height — developers need an explicit value to implement accurately.', node, 'autoLineHeight', null, { fontSize: node.fontSize !== figma.mixed ? node.fontSize : null });
        }
      }


      // ── v17: Image fill not set to Fill (cover) mode ─────────────────
      if ('fills' in node && node.fills !== figma.mixed && Array.isArray(node.fills)) {
        var _hasFitFill  = node.fills.some(function(f) { return f.type === 'IMAGE' && f.scaleMode === 'FIT'; });
        var _hasCropFill = node.fills.some(function(f) { return f.type === 'IMAGE' && f.scaleMode === 'CROP'; });
        if (_hasFitFill) {
          addIssue(issues, stats, 'image-fit-mode', 'medium', '"' + node.name + '" image fill is set to Fit — the image will not cover its frame and will show whitespace (letterboxing). Change the scale mode to Fill (cover).', node, 'imageFitMode');
        } else if (_hasCropFill) {
          addIssue(issues, stats, 'image-fit-mode', 'medium', '"' + node.name + '" image fill is set to Crop — the manual crop/pan is difficult to replicate in CSS and may look different in the built layout. Change to Fill (cover) or export as a pre-cropped image.', node, 'imageFitMode');
        }
      }

      // ── v17: Interactive component without state variants ──────────────
      const INTERACTIVE_RX = [
        { rx: /\b(carousel|slider|swiper|slideshow)\b/i, label: 'carousel' },
        { rx: /\b(accordion|collapse|expander|faq)\b/i,  label: 'accordion' },
        { rx: /\btabs?\b/i,                               label: 'tabs' },
        { rx: /\b(modal|popup|dialog|overlay|lightbox)\b/i, label: 'modal' },
      ];
      const STATE_HINT = /\b(hover|active|pressed|open|closed|focus|disabled|expanded|collapsed)\b/i;
      for (var _rix = 0; _rix < INTERACTIVE_RX.length; _rix++) {
        var _irx = INTERACTIVE_RX[_rix].rx, _ilabel = INTERACTIVE_RX[_rix].label;
        if (!_irx.test(node.name) || !hasChildren(node)) continue;

        // Skip section wrappers: name contains "section", is a top-level page child,
        // or is an oversized non-component frame (layout container, not an interactive element)
        var _isComponentNode = node.type === 'COMPONENT' || node.type === 'COMPONENT_SET' || node.type === 'INSTANCE';
        var _isSectionWrapper =
          /\bsection\b/i.test(node.name) ||
          (node.parent && node.parent.type === 'PAGE') ||
          (!_isComponentNode && typeof node.width === 'number' && node.width > 900) ||
          (!_isComponentNode && typeof node.height === 'number' && node.height > 500);
        // Skip content/child frames: the interactive keyword describes CONTEXT, not the component itself.
        // e.g. "Popup Image Content", "Modal Body", "Accordion Inner Wrapper" are parts, not the control.
        var _isContentFrame = /\b(content|image|img|body|inner|area|wrapper|container|text|heading|title|icon|media|video|bg|background|copy|detail|copy)\b/i.test(node.name);
        if (_isSectionWrapper || _isContentFrame) break;

        var _childNames = node.children.map(function(c) { return c.name; }).join(' ');
        // Also check grandchildren — variant names are often one level deeper
        var _grandChildNames = '';
        for (var _ci = 0; _ci < node.children.length; _ci++) {
          var _ch = node.children[_ci];
          if (hasChildren(_ch)) {
            for (var _gi = 0; _gi < _ch.children.length; _gi++) {
              _grandChildNames += ' ' + _ch.children[_gi].name;
            }
          }
        }
        var _siblingNames = node.parent && node.parent.type === 'COMPONENT_SET'
          ? node.parent.children.map(function(c) { return c.name; }).join(' ')
          : '';
        if (!STATE_HINT.test(_childNames) && !STATE_HINT.test(_grandChildNames) && !STATE_HINT.test(_siblingNames)) {
          addIssue(issues, stats, 'interactive-no-states', 'low', '"' + node.name + '" looks like a ' + _ilabel + ' but has no state variants (hover, open, closed).', node, 'interactivePatterns');
        }
        break;
      }

      if (parent && hasChildren(parent) && (parent.type === 'FRAME' || parent.type === 'GROUP')) {
        const siblings = parent.children;
        const bgRects = siblings.filter(c => c.type === 'RECTANGLE' && !c.isMask && c.width >= parent.width * 0.9 && c.height >= parent.height * 0.9);
        const isImageContainer = node.fills && node.fills !== figma.mixed && node.fills.some(f => f.type === 'IMAGE');
        const isStandaloneImageFrame = isImageContainer && siblings.length === 1;
        if (bgRects.length === 1 && node === bgRects[0] && !isImageContainer && !isStandaloneImageFrame) {
          addIssue(issues, stats, 'background-layer', 'low', 'Background may be better applied directly on the container.', node, 'backgroundWrappers');
        }
      }
    } catch (e) {
      // swallow per-node audit errors for stability on heavy files
    }

    if ((i + 1) % batchSize === 0 || i === entries.length - 1) {
      figma.ui.postMessage({
        type: 'progress',
        stage: 'Auditing file',
        completed: i + 1,
        total: entries.length
      });
      await pause();
    }
  }

  const exportCandidates = gatherExportCandidates(scopeNodes);
  for (const node of exportCandidates) {
    addIssue(issues, stats, 'missing-export', 'medium', 'Asset should be marked exportable.', node, 'missingExportSettings', 'add-export-settings');
  }

  // ── v17: Section overlaps (aggregate, post-loop) ─────────────────────────
  try {
    const topSections = scopeNodes.flatMap(root => {
      if (!hasChildren(root)) return [];
      return root.children.filter(c =>
        c.visible !== false && c.absoluteBoundingBox &&
        ['FRAME', 'COMPONENT', 'GROUP', 'SECTION'].includes(c.type)
      );
    }).sort((a, b) => a.absoluteBoundingBox.y - b.absoluteBoundingBox.y);
    for (let i = 0; i < topSections.length - 1; i++) {
      const curr = topSections[i].absoluteBoundingBox;
      const next = topSections[i + 1].absoluteBoundingBox;
      const overlap = (curr.y + curr.height) - next.y;
      if (overlap > 2) {
        addIssue(issues, stats, 'section-overlap', 'medium', `"${topSections[i].name}" overlaps "${topSections[i + 1].name}" by ${Math.round(overlap)}px.`, topSections[i], 'sectionOverlaps');
      }
    }
  } catch (e) {}

  // ── v17: Section spacing consistency (aggregate, post-loop) ─────────────
  try {
    // Sections are the CHILDREN of the selected frame(s), not the selected frames themselves.
    // getScopeNodes() returns the selected frame (or page top-level frames if nothing selected).
    // Either way, we look one level deeper — into their children — to find content sections.
    var _ssRoots = getScopeNodes();
    var _ssCandidates = [];
    for (var _ssri = 0; _ssri < _ssRoots.length; _ssri++) {
      var _ssRoot = _ssRoots[_ssri];
      if (!hasChildren(_ssRoot)) continue;
      var _ssRootW = typeof _ssRoot.width === 'number' ? _ssRoot.width : 0;
      for (var _ssci = 0; _ssci < _ssRoot.children.length; _ssci++) {
        var _ssc = _ssRoot.children[_ssci];
        if ((_ssc.type !== 'FRAME' && _ssc.type !== 'SECTION' && _ssc.type !== 'COMPONENT') || _ssc.visible === false) continue;
        var _sscW = typeof _ssc.width === 'number' ? _ssc.width : 0;
        // Accept if at least 200px wide, or at least 30% of parent width
        if (_sscW < 200 && (_ssRootW === 0 || _sscW / _ssRootW < 0.3)) continue;
        _ssCandidates.push(_ssc);
      }
    }
    var _ssItems = [];
    for (var _ssi = 0; _ssi < _ssCandidates.length; _ssi++) {
      var _ssn = _ssCandidates[_ssi];
      if (_sectionExcluded(_ssn)) continue;
      var _ssArea = _findContentArea(_ssn);
      var _ssp = _resolveGenPad(_ssArea.measureNode);
      if (!_ssp) continue;
      // Sanity: all sides non-negative, none over 400px
      if (_ssp.top < 0 || _ssp.bottom < 0 || _ssp.left < 0 || _ssp.right < 0) continue;
      if (Math.max(_ssp.top, _ssp.bottom, _ssp.left, _ssp.right) > 400) continue;
      _ssItems.push({ sectionNode: _ssn, flagNode: _ssArea.flagNode, contextLabel: _ssArea.contextLabel, pad: _ssp });
    }

    if (_ssItems.length >= 3) {
      var _ssSides = ['top', 'bottom', 'left', 'right'];
      var _ssDom = {};
      for (var _ssdi = 0; _ssdi < _ssSides.length; _ssdi++) {
        var _ssside = _ssSides[_ssdi];
        var _ssVals = _ssItems.map(function(d) { return Math.round(d.pad[_ssside]); });
        var _ssClusters = _clusterVals(_ssVals, 8);
        _ssDom[_ssside] = _findSpacingPattern(_ssClusters, _ssItems.length);
      }

      var _ssHasPattern = _ssSides.some(function(sd) {
        return _ssDom[sd] && _ssDom[sd].type !== 'none';
      });

      if (!_ssHasPattern) {
        // No dominant system — report once on the first section
        addIssue(issues, stats, 'section-spacing-inconsistency', 'low',
          'No consistent section spacing system detected — content areas use unrelated padding values. Consider establishing a shared spacing scale.',
          _ssItems[0].flagNode, 'sectionPaddingIssues');
      } else {
        for (var _ssfi = 0; _ssfi < _ssItems.length; _ssfi++) {
          var _ssitem = _ssItems[_ssfi];
          var _ssOffParts = [];
          for (var _ssfsi = 0; _ssfsi < _ssSides.length; _ssfsi++) {
            var _sssd = _ssSides[_ssfsi];
            var _ssdom = _ssDom[_sssd];
            if (!_ssdom || _ssdom.type === 'none') continue;
            var _ssVal = Math.round(_ssitem.pad[_sssd]);
            var _ssExp = _ssdom.primary.rep;
            var _ssDev = Math.abs(_ssVal - _ssExp);
            if (_ssDev <= 8) continue;
            // Allow if matches a recognised secondary pattern
            if (_ssdom.type === 'dual' && Math.abs(_ssVal - _ssdom.secondary.rep) <= 8) continue;
            _ssOffParts.push(_sssd + ' ' + _ssVal + 'px (expected ~' + _ssExp + 'px)');
          }
          if (_ssOffParts.length > 0) {
            addIssue(issues, stats, 'section-spacing-inconsistency', 'low',
              _ssitem.contextLabel + ' has inconsistent spacing — ' + _ssOffParts.join(', ') + '.',
              _ssitem.flagNode, 'sectionPaddingIssues');
          }
        }
      }
    }
  } catch (e) {}

  // ── v17: Missing fonts (async, post-loop) ────────────────────────────────
  try {
    const fontKeyMap = new Map();
    for (const { node: n } of entries) {
      if (n.type === 'TEXT' && n.visible !== false && n.fontName !== figma.mixed && n.fontName) {
        const key = `${n.fontName.family}::${n.fontName.style}`;
        if (!fontKeyMap.has(key)) fontKeyMap.set(key, n);
      }
    }
    for (const [key, representativeNode] of fontKeyMap) {
      const [family, style] = key.split('::');
      try {
        await figma.loadFontAsync({ family, style });
      } catch (e) {
        addIssue(issues, stats, 'missing-font', 'high', `Font "${family} ${style}" is not available — text will render with a fallback.`, representativeNode, 'missingFonts');
      }
    }
  } catch (e) {}

  // ── v17: Multiple font families (aggregate, post-loop) ───────────────────
  try {
    const families = new Set();
    for (const { node: n } of entries) {
      if (n.type === 'TEXT' && n.visible !== false && n.fontName !== figma.mixed && n.fontName) {
        families.add(n.fontName.family);
      }
    }
    if (families.size > 2) {
      addIssue(issues, stats, 'multiple-fonts', 'low', `${families.size} distinct font families detected: ${[...families].slice(0, 4).join(', ')}${families.size > 4 ? '…' : ''}.`, figma.currentPage, 'multipleFonts');
    }
  } catch (e) {}

  // ── v17: No mobile frame (page-level) ────────────────────────────────────
  try {
    const pageFrames = figma.currentPage.children.filter(n => n.type === 'FRAME');
    const hasDesktop = pageFrames.some(f => f.width > 1024);
    const hasMobile  = pageFrames.some(f => f.width <= 480);
    if (hasDesktop && !hasMobile) {
      addIssue(issues, stats, 'no-mobile-frame', 'medium', 'No mobile frame found on this page. WordPress themes require responsive design for all breakpoints.', figma.currentPage, 'noMobileFrame');
    }
  } catch (e) {}

  return { issues, stats, scope: figma.currentPage.selection.length ? 'selection' : 'page' };
}

async function renameGenericLayers() {
  let totalChanged = 0;
  let skipped = 0;
  const reasons = [];

  for (var pass = 0; pass < 3; pass++) {
    // Pass 0 uses the audited node list; subsequent passes re-scan to catch stragglers
    // whose inferred name depended on a sibling/parent being renamed first.
    var candidates;
    if (pass === 0) {
      candidates = await getActionNodes(['generic-name']);
    } else {
      candidates = getAllNodes(getScopeNodes()).map(function(x) { return x.node; });
    }

    var passChanged = 0;
    for (var i = 0; i < candidates.length; i++) {
      var node = candidates[i];
      if (!isGenericName(node)) continue;
      var blocked = getBlockedReason(node, 'rename-generic');
      if (blocked) {
        if (pass === 0) {
          skipped++;
          if (reasons.length < 3) reasons.push(blocked);
        }
        continue;
      }
      var nextName = inferName(node);
      if (!nextName || node.name === nextName) continue;
      try {
        node.name = nextName;
        passChanged++;
        totalChanged++;
      } catch (e) {
        if (pass === 0) {
          skipped++;
          if (reasons.length < 3) reasons.push(e && e.message ? e.message : 'Rename failed.');
        }
      }
    }

    if (passChanged === 0) break; // stable — no more renames possible
  }

  return { changed: totalChanged, skipped: skipped, reasons: reasons };
}

async function removeHiddenLayers() {
  const nodes = (await getActionNodes(['hidden-layer']))
    .map(node => ({ node, depth: nodePath(node).split('›').length }))
    .sort((a, b) => b.depth - a.depth)
    .map(x => x.node);
  let changed = 0;
  let skipped = 0;
  const reasons = [];
  for (const node of nodes) {
    if (!node.visible) {
      const blocked = getBlockedReason(node, 'remove-hidden');
      if (blocked) {
        skipped++;
        if (reasons.length < 3) reasons.push(blocked);
        continue;
      }
      try {
        if (node.parent && typeof node.remove === 'function') {
          node.remove();
          changed++;
        }
      } catch (e) {
        skipped++;
        if (reasons.length < 3) reasons.push(e && e.message ? e.message : 'Remove failed.');
      }
    }
  }
  return { changed, skipped, reasons };
}

async function addExportSettings() {
  const roots = getScopeNodes();
  let nodes = [];
  if (lastAuditNodeIds.length) {
    const audited = await getActionNodes(['missing-export']);
    if (audited.length) nodes = audited;
  }
  if (!nodes.length) nodes = gatherExportCandidates(roots);

  let changed = 0;
  let skipped = 0;
  const reasons = [];
  const seen = new Set();
  for (const node of nodes) {
    if (!node || seen.has(node.id)) continue;
    seen.add(node.id);
    if (!isExportableLeaf(node)) continue;
    if (node.exportSettings && node.exportSettings.length > 0) continue;
    const blocked = getBlockedReason(node, 'add-export-settings');
    if (blocked) {
      skipped++;
      if (reasons.length < 3) reasons.push(blocked);
      continue;
    }
    try {
      node.exportSettings = [getExportSpec(node)];
      changed++;
    } catch (e) {
      skipped++;
      if (reasons.length < 3) reasons.push(e && e.message ? e.message : 'Export settings failed.');
    }
  }

  if (!changed && !skipped && figma.currentPage.selection.length) {
    reasons.push('No exportable assets were found in the current selection. Select the image, icon, logo, or the group that directly contains them. Standalone image layers are supported when they use image fills.');
  }
  return { changed, skipped, reasons };
}

function addFlattenBucket(map, parent, nodes) {
  if (!parent || !nodes || nodes.length < 2) return;
  const editable = nodes.filter(n => isEditableNode(n) && !getBlockedReason(n, 'flatten-vectors'));
  if (editable.length < 2) return;
  const key = parent.id;
  if (!map.has(key)) map.set(key, { parent, nodes: [] });
  Array.prototype.push.apply(map.get(key).nodes, editable);
}

function gatherFlattenBucketsFromNode(root, buckets, reasons) {
  if (!root) return;
  const visit = (node) => {
    if (!node) return;
    const blocked = getBlockedReason(node, 'flatten-vectors');
    if (blocked) {
      if (reasons.length < 3 && !reasons.includes(blocked) && ancestorTypes(node).includes('INSTANCE')) reasons.push(blocked);
      return;
    }
    if (isVectorLikeNode(node) && node.parent && hasChildren(node.parent)) {
      const directSiblings = node.parent.children.filter(child => isVectorLikeNode(child));
      if (directSiblings.length >= 2) addFlattenBucket(buckets, node.parent, directSiblings);
    }
    if (hasChildren(node)) {
      const directVectorChildren = node.children.filter(child => isVectorLikeNode(child));
      if (directVectorChildren.length >= 2) addFlattenBucket(buckets, node, directVectorChildren);
      for (const child of node.children) visit(child);
    }
  };
  visit(root);
}

async function flattenSelectedVectorGroups() {
  const explicitSelection = figma.currentPage.selection.length ? figma.currentPage.selection.slice() : [];
  const auditedTargets = explicitSelection.length ? [] : await getActionNodes(['flatten-vectors']);
  const targets = explicitSelection.length ? explicitSelection : auditedTargets;
  let changed = 0;
  let skipped = 0;
  const reasons = [];
  const byParent = new Map();

  for (const node of targets) gatherFlattenBucketsFromNode(node, byParent, reasons);

  if (!byParent.size && explicitSelection.length) {
    for (const node of explicitSelection) {
      const blocked = getBlockedReason(node, 'flatten-vectors');
      if (blocked) {
        skipped++;
        if (reasons.length < 3 && !reasons.includes(blocked)) reasons.push(blocked);
      }
    }
  }

  for (const bucket of byParent.values()) {
    const uniqueMap = new Map();
    for (const n of bucket.nodes) uniqueMap.set(n.id, n);
    const uniqueNodes = Array.from(uniqueMap.values());
    if (uniqueNodes.length < 2) continue;
    try {
      figma.flatten(uniqueNodes, bucket.parent);
      changed += uniqueNodes.length;
    } catch (e) {
      skipped += uniqueNodes.length;
      if (reasons.length < 3) reasons.push(e && e.message ? e.message : 'Flatten failed.');
    }
  }

  if (!changed && !skipped) reasons.push('No flattenable vector groups were found. Select an icon or logo group with multiple direct vector children.');
  return { changed, skipped, reasons };
}

function copyVisualStyle(sourceNode, targetNode) {
  try {
    if ('fills' in sourceNode && 'fills' in targetNode && sourceNode.fills !== figma.mixed) targetNode.fills = JSON.parse(JSON.stringify(sourceNode.fills));
    if ('strokes' in sourceNode && 'strokes' in targetNode && sourceNode.strokes !== figma.mixed) targetNode.strokes = JSON.parse(JSON.stringify(sourceNode.strokes));
    if ('strokeWeight' in sourceNode && 'strokeWeight' in targetNode) targetNode.strokeWeight = sourceNode.strokeWeight;
    if ('cornerRadius' in sourceNode && 'cornerRadius' in targetNode && typeof sourceNode.cornerRadius === 'number') targetNode.cornerRadius = sourceNode.cornerRadius;
    if ('opacity' in sourceNode && 'opacity' in targetNode) targetNode.opacity = sourceNode.opacity;
    if ('effects' in sourceNode && 'effects' in targetNode) targetNode.effects = JSON.parse(JSON.stringify(sourceNode.effects));
  } catch (e) {}
}

async function convertButtonsToAutoLayout() {
  const nodes = await getActionNodes(['button-no-auto-layout']);
  let changed = 0;
  let skipped = 0;
  const reasons = [];
  for (const node of nodes) {
    try {
      if (!isLikelyButton(node)) continue;
      const blocked = getBlockedReason(node, 'convert-buttons');
      if (blocked) {
        skipped++;
        if (reasons.length < 3) reasons.push(blocked);
        continue;
      }

      if ((node.type === 'FRAME' || node.type === 'COMPONENT') && node.layoutMode === 'NONE') {
        node.layoutMode = 'HORIZONTAL';
        node.primaryAxisSizingMode = 'AUTO';
        node.counterAxisSizingMode = 'AUTO';
        node.primaryAxisAlignItems = 'CENTER';
        node.counterAxisAlignItems = 'CENTER';
        node.itemSpacing = Math.max(node.itemSpacing || 8, 8);
        node.paddingLeft = Math.max(node.paddingLeft || 16, 16);
        node.paddingRight = Math.max(node.paddingRight || 16, 16);
        node.paddingTop = Math.max(node.paddingTop || 10, 10);
        node.paddingBottom = Math.max(node.paddingBottom || 10, 10);
        if ('strokesIncludedInLayout' in node) node.strokesIncludedInLayout = true;
        changed++;
        continue;
      }

      if (node.type === 'GROUP' && node.parent) {
        const frame = figma.createFrame();
        frame.name = node.name === 'Group' ? 'Button' : node.name;
        frame.layoutMode = 'HORIZONTAL';
        frame.primaryAxisSizingMode = 'AUTO';
        frame.counterAxisSizingMode = 'AUTO';
        frame.primaryAxisAlignItems = 'CENTER';
        frame.counterAxisAlignItems = 'CENTER';
        frame.itemSpacing = 8;
        frame.paddingLeft = 16;
        frame.paddingRight = 16;
        frame.paddingTop = 10;
        frame.paddingBottom = 10;
        frame.x = node.x;
        frame.y = node.y;
        const bgRect = node.children.find(c => c.type === 'RECTANGLE' && c.width >= node.width * 0.7 && c.height >= node.height * 0.7);
        if (bgRect) copyVisualStyle(bgRect, frame);
        node.parent.insertChild(node.parent.children.indexOf(node), frame);
        const movableChildren = node.children.slice().filter(c => c !== bgRect);
        for (const child of movableChildren) frame.appendChild(child);
        if (bgRect) {
          try { bgRect.remove(); } catch (e) {}
        }
        try { node.remove(); } catch (e) {}
        changed++;
        continue;
      }

      skipped++;
      if (reasons.length < 3) reasons.push('This button structure is not supported for automatic conversion yet.');
    } catch (e) {
      skipped++;
      if (reasons.length < 3) reasons.push(e && e.message ? e.message : 'Button conversion failed.');
    }
  }
  return { changed, skipped, reasons };
}

// Thin separator / decorative strokes — the same layers the audit flags as
// strokes-found. Container borders (cards, inputs) are intentionally excluded.
function isThinStrokeCandidate(node) {
  if (!('strokes' in node) || node.strokes === figma.mixed || !Array.isArray(node.strokes) || node.strokes.length === 0) return false;
  const strokeWeight = ('strokeWeight' in node && typeof node.strokeWeight === 'number') ? node.strokeWeight : 0;
  const isContainerBorder = ['FRAME', 'COMPONENT', 'SECTION'].includes(node.type);
  const isLikelySeparator = node.type === 'LINE' || (strokeWeight <= 1 && Math.min(node.width || 0, node.height || 0) <= 2);
  const isDecorativeVectorStroke = ['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'ELLIPSE', 'POLYGON'].includes(node.type) && strokeWeight <= 1;
  return !isContainerBorder && (isLikelySeparator || isDecorativeVectorStroke);
}

async function outlineStrokesInSelection() {
  // Only outline the thin strokes the audit flagged — never card/input borders.
  let nodes = lastAuditNodeIds.length ? await getActionNodes(['strokes-found']) : [];
  if (!nodes.length) nodes = getAllNodes(getScopeNodes()).map(x => x.node);
  let changed = 0;
  let skipped = 0;
  const reasons = [];
  for (const node of nodes) {
    if (!isThinStrokeCandidate(node)) continue;
    const blocked = getBlockedReason(node, 'outline-strokes');
    if (blocked) {
      skipped++;
      if (reasons.length < 3) reasons.push(blocked);
      continue;
    }
    if (typeof node.outlineStroke !== 'function') {
      skipped++;
      if (reasons.length < 3) reasons.push('Node type does not support outline stroke.');
      continue;
    }
    try {
      node.outlineStroke();
      changed++;
    } catch (e) {
      skipped++;
      if (reasons.length < 3) reasons.push(e && e.message ? e.message : 'Outline stroke failed.');
    }
  }
  return { changed, skipped, reasons };
}

async function makeSectionsAutoLayout() {
  const explicitSelection = figma.currentPage.selection.length ? figma.currentPage.selection.slice() : [];
  let nodes = [];

  const seen = new Set();
  const pushNode = (node) => {
    if (!node || seen.has(node.id)) return;
    seen.add(node.id);
    nodes.push(node);
  };

  if (explicitSelection.length) {
    for (const root of explicitSelection) {
      if (['FRAME', 'GROUP', 'COMPONENT'].includes(root.type)) {
        if (!isAutoLayoutFrame(root) && shouldTreatAsSection(root)) pushNode(root);
      }
      const descendants = getAllNodes([root]).map(x => x.node);
      for (const node of descendants) {
        if (!['FRAME', 'GROUP', 'COMPONENT'].includes(node.type)) continue;
        if (node.id === root.id) continue;
        if (isAutoLayoutFrame(node)) continue;
        if (shouldTreatAsSection(node)) pushNode(node);
      }
    }
  } else {
    nodes = await getActionNodes(['section-no-auto-layout']);
  }

  let changed = 0;
  let skipped = 0;
  const reasons = [];
  const axisSummary = { HORIZONTAL: 0, VERTICAL: 0 };

  for (const node of nodes) {
    const blocked = getBlockedReason(node, 'section-auto-layout');
    if (blocked) {
      skipped++;
      if (reasons.length < 3 && !reasons.includes(blocked)) reasons.push(blocked);
      continue;
    }

    try {
      if ((node.type === 'FRAME' || node.type === 'COMPONENT') && node.layoutMode === 'NONE') {
        const axis = applySmartAutoLayout(node);
        axisSummary[axis] = (axisSummary[axis] || 0) + 1;
        changed++;
        continue;
      }

      if (node.type === 'GROUP' && node.parent) {
        const frame = figma.createFrame();
        frame.name = node.name;
        frame.x = node.x;
        frame.y = node.y;
        frame.resizeWithoutConstraints(node.width, node.height);
        node.parent.insertChild(node.parent.children.indexOf(node), frame);
        const children = node.children.slice();
        for (const child of children) frame.appendChild(child);
        const axis = applySmartAutoLayout(frame);
        axisSummary[axis] = (axisSummary[axis] || 0) + 1;
        try { node.remove(); } catch (e) {}
        changed++;
        continue;
      }

      skipped++;
      if (reasons.length < 3 && !reasons.includes('This selected layer type cannot be converted automatically.')) reasons.push('This selected layer type cannot be converted automatically.');
    } catch (e) {
      skipped++;
      if (reasons.length < 3) reasons.push(e && e.message ? e.message : 'Section auto layout failed.');
    }
  }

  if (!nodes.length) reasons.push('Select a frame/component containing sections, or select the section frames directly, then run Make Auto Layout.');
  if (changed && (axisSummary.HORIZONTAL || axisSummary.VERTICAL)) {
    const parts = [];
    if (axisSummary.VERTICAL) parts.push(axisSummary.VERTICAL + ' vertical');
    if (axisSummary.HORIZONTAL) parts.push(axisSummary.HORIZONTAL + ' horizontal');
    reasons.unshift('Applied smart auto layout: ' + parts.join(', ') + '.');
  }
  return { changed, skipped, reasons };
}

function storeAudit(report) {
  lastAuditNodeIds = [];
  lastAuditIssueTypesByNode = new Map();
  for (const issue of report.issues) {
    if (!issue.nodeId) continue;
    if (!lastAuditIssueTypesByNode.has(issue.nodeId)) lastAuditIssueTypesByNode.set(issue.nodeId, []);
    lastAuditIssueTypesByNode.get(issue.nodeId).push(issue.type);
    lastAuditNodeIds.push(issue.nodeId);
  }
  lastAuditNodeIds = Array.from(new Set(lastAuditNodeIds));
}

function formatActionMessage(label, result) {
  let msg = `${label}: ${result.changed} changed`;
  if (result.skipped) msg += `, ${result.skipped} skipped`;
  if (result.reasons && result.reasons.length) msg += `. ${result.reasons[0]}`;
  return msg;
}

async function createRevisionCopies() {
  const sel = figma.currentPage.selection;
  if (!sel.length) return [];
  const pageChildren = figma.currentPage.children;
  const newFrames = [];
  for (const node of sel) {
    const baseName = node.name.replace(/\s+v\d+$/, '');
    let version = 1;
    while (
      pageChildren.some(n => n.name === `${baseName} v${version}`) ||
      newFrames.some(n => n.name === `${baseName} v${version}`)
    ) { version++; }
    const clone = node.clone();
    clone.name = `${baseName} v${version}`;
    clone.x = node.x + node.width + 80;
    newFrames.push(clone);
  }
  figma.currentPage.selection = newFrames;
  try { figma.viewport.scrollAndZoomIntoView(newFrames); } catch(e) {}
  return newFrames;
}

async function markReportData(extraMessage) {
  if (!figma.currentPage.selection.length) {
    figma.ui.postMessage({ type: 'idle' });
    figma.ui.postMessage({ type: 'no-selection' });
    return;
  }
  const report = await collectIssues();
  const selectedCount = figma.currentPage.selection.length;
  report.scope = 'selection';
  storeAudit(report);
  figma.ui.postMessage({ type: 'report', report, extraMessage });
}

// ── Typography & Colors helpers ──────────────────────────────────────────
function rgbToHexStr(color) {
  const h = v => Math.round(v * 255).toString(16).padStart(2, '0');
  return ('#' + h(color.r) + h(color.g) + h(color.b)).toUpperCase();
}

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), l = (max+min)/2;
  if (max === min) return [0, 0, l*100];
  const d = max - min, s = l > 0.5 ? d/(2-max-min) : d/(max+min);
  let hh;
  switch(max) {
    case r: hh = ((g-b)/d + (g<b?6:0))/6; break;
    case g: hh = ((b-r)/d + 2)/6; break;
    default: hh = ((r-g)/d + 4)/6;
  }
  return [hh*360, s*100, l*100];
}


// ── Section spacing consistency helpers ──────────────────────────────────────

function _medianOf(arr) {
  if (!arr.length) return 0;
  var s = arr.slice().sort(function(a, b) { return a - b; });
  var m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? Math.round((s[m - 1] + s[m]) / 2) : s[m];
}

function _clusterVals(values, tol) {
  tol = tol || 8;
  var sorted = values.slice().sort(function(a, b) { return a - b; });
  var clusters = [];
  var cur = [sorted[0]];
  for (var i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] <= tol) { cur.push(sorted[i]); }
    else { clusters.push(cur); cur = [sorted[i]]; }
  }
  clusters.push(cur);
  return clusters.map(function(c) {
    return { rep: _medianOf(c), count: c.length };
  });
}

function _findSpacingPattern(clusters, total) {
  if (!clusters.length || total < 3) return null;
  var s = clusters.slice().sort(function(a, b) { return b.count - a.count; });
  if (s[0].count / total >= 0.55) return { type: 'single', primary: s[0], secondary: s[1] || null };
  if (s.length >= 2 && s[0].count / total >= 0.25 && s[1].count / total >= 0.25) return { type: 'dual', primary: s[0], secondary: s[1] };
  return { type: 'none' };
}

// Returns true if this section should be skipped entirely
function _sectionExcluded(node) {
  if (/\b(header|hero|footer|banner|cta|call.?to.?action|promo|promotion|navigation|navbar)\b/i.test(node.name)) return true;
  if (typeof node.height === 'number' && node.height <= 120) return true;
  if (!hasChildren(node) || !node.children.length) return true;
  var visC = node.children.filter(function(c) { return c.visible !== false; });
  if (!visC.length) return true;
  // Short CTA: height ≤ 280, ≤ 3 text children, at least 1 button
  if (typeof node.height === 'number' && node.height <= 280) {
    var tn = 0, bn = 0;
    visC.forEach(function(c) { if (c.type === 'TEXT') tn++; if (isLikelyButton(c)) bn++; });
    if (tn <= 3 && bn >= 1) return true;
  }
  return false;
}

// Find the exact container to measure (and flag) for a given section.
// Returns { measureNode, flagNode, contextLabel } where flagNode is the
// specific frame the issue will be attached to in Figma.
function _findContentArea(sectionNode) {
  var self = { measureNode: sectionNode, flagNode: sectionNode, contextLabel: '"' + sectionNode.name + '"' };
  if (!hasChildren(sectionNode)) return self;
  var sW = typeof sectionNode.width  === 'number' ? sectionNode.width  : 0;
  var sH = typeof sectionNode.height === 'number' ? sectionNode.height : 0;
  var visC = sectionNode.children.filter(function(c) { return c.visible !== false; });

  // ── Split layout: image column + content column ──────────────────────────
  // Two direct children each 30–70% wide; one is clearly an image, the other is content
  if (visC.length === 2 && sW > 0) {
    var rA = (visC[0].width || 0) / sW, rB = (visC[1].width || 0) / sW;
    if (rA >= 0.3 && rA <= 0.7 && rB >= 0.3 && rB <= 0.7) {
      var imgCol = null, contentCol = null;
      for (var si = 0; si < visC.length; si++) {
        var sc = visC[si];
        var isImg = hasImageFill(sc) ||
          (!hasChildren(sc)) ||
          (hasChildren(sc) && sc.children.length <= 2 &&
           sc.children.every(function(gc) { return hasImageFill(gc) || gc.type === 'RECTANGLE'; }));
        if (isImg && !imgCol) imgCol = sc;
        else if (!contentCol) contentCol = sc;
      }
      if (imgCol && contentCol) {
        // Only return the content column — image column intentionally touches edges
        return {
          measureNode: contentCol,
          flagNode: contentCol,
          contextLabel: '"' + contentCol.name + '" (content column in "' + sectionNode.name + '")'
        };
      }
    }
  }

  // ── Full-bleed background with overlay content ───────────────────────────
  var bgChild = null, overlayChild = null;
  for (var bi = 0; bi < visC.length; bi++) {
    var bc = visC[bi];
    if (!bc.width || !bc.height || !sW || !sH) continue;
    if ((bc.type === 'RECTANGLE' || hasImageFill(bc)) && bc.width / sW >= 0.9 && bc.height / sH >= 0.9) {
      bgChild = bc;
    } else if (!overlayChild && hasChildren(bc)) {
      overlayChild = bc;
    }
  }
  if (bgChild && overlayChild) {
    return {
      measureNode: overlayChild,
      flagNode: overlayChild,
      contextLabel: '"' + overlayChild.name + '" (overlay in "' + sectionNode.name + '")'
    };
  }

  // ── Section itself has Auto Layout with non-zero padding ─────────────────
  if (sectionNode.layoutMode && sectionNode.layoutMode !== 'NONE') {
    var sp = (sectionNode.paddingTop || 0) + (sectionNode.paddingBottom || 0) +
             (sectionNode.paddingLeft || 0) + (sectionNode.paddingRight || 0);
    if (sp > 0) return self;
  }

  // ── Direct child with Auto Layout padding (the container IS the source) ──
  for (var ai = 0; ai < visC.length; ai++) {
    var ac = visC[ai];
    if (!ac.width || !sW) continue;
    if (ac.layoutMode && ac.layoutMode !== 'NONE') {
      var hasPad = ((ac.paddingTop || 0) + (ac.paddingBottom || 0) +
                    (ac.paddingLeft || 0) + (ac.paddingRight || 0)) > 0;
      if (hasPad && (ac.width / sW) >= 0.3) {
        return {
          measureNode: ac,
          flagNode: ac,
          contextLabel: '"' + ac.name + '" (in "' + sectionNode.name + '")'
        };
      }
    }
  }

  // ── Single dominant non-background content container ─────────────────────
  var cCandidates = visC.filter(function(c) {
    if (!c.width || !c.height || !sW) return false;
    if (hasImageFill(c) && c.width / sW >= 0.85) return false; // skip full-width media
    return (c.width / sW) >= 0.3 && hasChildren(c);
  });
  if (cCandidates.length === 1) {
    var cc = cCandidates[0];
    return {
      measureNode: cc,
      flagNode: cc,
      contextLabel: '"' + cc.name + '" (in "' + sectionNode.name + '")'
    };
  }

  // ── Fallback: section itself ──────────────────────────────────────────────
  return self;
}

// Resolve effective padding for a single node — returns {top,bottom,left,right} or null
// Resolve effective padding using absoluteBoundingBox so spacing defined at any
// nesting depth (Auto Layout, nested containers, groups, instances) is captured.
// Strategy: traverse all descendants, collect the bounding box of actual "content"
// nodes, then measure the gap between the section's own boundary and that content bbox.
// Read the effective layout padding from a node by finding the structural container
// that DECLARES the spacing — not by measuring where content objects end up.
//
// Only traverses FRAME / COMPONENT / INSTANCE / GROUP nodes that have children.
// Completely ignores text, images, shapes, icons, and any decorative content.
//
// Returns {top, bottom, left, right} or null.
function _resolveGenPad(node, depth) {
  depth = depth || 0;
  if (depth > 5) return null;

  var w = typeof node.width  === 'number' ? node.width  : 0;
  var h = typeof node.height === 'number' ? node.height : 0;
  if (!w || !h) return null;

  // ── Priority 1: explicit Auto Layout padding on this node ─────────────────
  if (node.layoutMode && node.layoutMode !== 'NONE') {
    var pt = typeof node.paddingTop    === 'number' ? node.paddingTop    : 0;
    var pb = typeof node.paddingBottom === 'number' ? node.paddingBottom : 0;
    var pl = typeof node.paddingLeft   === 'number' ? node.paddingLeft   : 0;
    var pr = typeof node.paddingRight  === 'number' ? node.paddingRight  : 0;
    if (pt + pb + pl + pr > 0) {
      return { top: pt, bottom: pb, left: pl, right: pr };
    }
    // AL with zero padding — check children for their own containers
  }

  if (!hasChildren(node) || !node.children.length) return null;

  // ── Build list of STRUCTURAL children only ─────────────────────────────────
  // Structural = a frame/component/instance/group that itself contains children.
  // Decorative nodes (text, images, shapes, vectors, leaf frames) are excluded.
  var structural = [];
  for (var ci = 0; ci < node.children.length; ci++) {
    var c = node.children[ci];
    if (c.visible === false) continue;
    var cw = typeof c.width  === 'number' ? c.width  : 0;
    var ch = typeof c.height === 'number' ? c.height : 0;
    if (!cw || !ch) continue;

    // Must be a container type — skip any pure visual/leaf node
    var isContainer = c.type === 'FRAME' || c.type === 'COMPONENT' ||
                      c.type === 'INSTANCE' || c.type === 'GROUP' || c.type === 'SECTION';
    if (!isContainer) continue;

    // Must have children of its own (otherwise it's a leaf placeholder)
    if (!hasChildren(c) || !c.children.length) continue;

    // Skip full-area background containers (image fills covering ≥90% of parent)
    if (hasImageFill(c) && cw / w >= 0.9 && ch / h >= 0.9) continue;

    // Skip containers that are tiny relative to the parent (decorative boxes, icons)
    if (cw < w * 0.15 && ch < h * 0.15) continue;

    structural.push(c);
  }

  if (!structural.length) return null;

  // ── Single structural child → offset + its own padding ───────────────────
  if (structural.length === 1) {
    var sc = structural[0];
    if (typeof sc.x !== 'number' || typeof sc.y !== 'number') return null;

    var offsetTop    = Math.round(sc.y);
    var offsetBottom = Math.round(h - sc.y - sc.height);
    var offsetLeft   = Math.round(sc.x);
    var offsetRight  = Math.round(w - sc.x - sc.width);

    // Recurse into the child to get its own declared padding
    var childPad = _resolveGenPad(sc, depth + 1);
    if (childPad) {
      return {
        top:    offsetTop    + childPad.top,
        bottom: offsetBottom + childPad.bottom,
        left:   offsetLeft   + childPad.left,
        right:  offsetRight  + childPad.right
      };
    }
    // No deeper padding found — if the child is offset, that offset IS the padding
    if (offsetTop + offsetBottom + offsetLeft + offsetRight > 0) {
      return { top: offsetTop, bottom: offsetBottom, left: offsetLeft, right: offsetRight };
    }
    return null;
  }

  // ── Multiple structural children → bounding box of structural children ────
  // (Only structural containers contribute — decorative elements are excluded above)
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (var si = 0; si < structural.length; si++) {
    var ss = structural[si];
    if (typeof ss.x !== 'number' || typeof ss.y !== 'number') continue;
    minX = Math.min(minX, ss.x);
    minY = Math.min(minY, ss.y);
    maxX = Math.max(maxX, ss.x + ss.width);
    maxY = Math.max(maxY, ss.y + ss.height);
  }
  if (!isFinite(minX)) return null;

  return {
    top:    Math.round(minY),
    bottom: Math.round(h - maxY),
    left:   Math.round(minX),
    right:  Math.round(w - maxX)
  };
}


// ── End section spacing helpers ───────────────────────────────────────────────


// ════════════════════════════════════════════════════════════════════════════
// V19: Color & text style management (Colors tab + Typography tab)
// ════════════════════════════════════════════════════════════════════════════

// Last scan per kind, so UI actions can refer to rows by key instead of
// re-sending every layer id. Roots are remembered so an action's re-scan
// covers the same frame even after Focus changed the selection.
let lastColorScan = null;
let lastTextScan = null;
let lastColorRootIds = [];
let lastTextRootIds = [];

function round2(v) {
  return Math.round(v * 100) / 100;
}

function hexToRgb01(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255
  };
}

function opPct(op) {
  return Math.round((typeof op === 'number' ? op : 1) * 100);
}

function colorKey(hex, op) {
  return hex + '|' + opPct(op);
}

// Short "Parent / Layer" label used in the layer lists.
function shortPath(node) {
  const parts = [];
  let current = node;
  while (current && current.type !== 'PAGE' && current.type !== 'DOCUMENT' && parts.length < 2) {
    parts.unshift(current.name);
    current = current.parent;
  }
  return parts.join(' / ');
}

function isInInstance(node) {
  let current = node;
  while (current && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
    if (current.type === 'INSTANCE') return true;
    current = current.parent;
  }
  return false;
}

// Short description of a layer's paints, e.g. "4 fills: image, gradient, 2 colors".
function describePaints(paints, prop) {
  const counts = {};
  for (const p of paints) {
    const t = p.type === 'SOLID' ? 'color' : p.type === 'IMAGE' ? 'image' : p.type === 'VIDEO' ? 'video' : 'gradient';
    counts[t] = (counts[t] || 0) + 1;
  }
  const parts = Object.keys(counts).map(t => counts[t] > 1 ? counts[t] + ' ' + t + 's' : t);
  return paints.length + ' ' + (prop === 'strokes' ? 'strokes' : 'fills') + ': ' + parts.join(', ');
}

function useRef(node, prop, multi, paintInfo, range) {
  const u = { id: node.id, name: node.name, path: shortPath(node), type: node.type, prop: prop, multi: !!multi, inst: isInInstance(node) };
  if (paintInfo) u.paints = paintInfo;
  // A text layer whose characters differ in colour contributes one use per
  // coloured run, each carrying the range it covers.
  if (range) { u.start = range.start; u.end = range.end; u.text = range.text; }
  return u;
}

function isDescendantOrSelf(node, ancestorId) {
  let current = node;
  while (current) {
    if (current.id === ancestorId) return true;
    current = current.parent;
  }
  return false;
}

// Scan the current selection, unless every selected layer lives inside the
// frame that was scanned last (e.g. after Focus) — then re-scan that frame.
async function resolveScanRoots(lastIds) {
  const sel = figma.currentPage.selection.slice();
  const lastRoots = await resolveNodesByIds(lastIds);
  const liveRoots = lastRoots.filter(n => isEditableNode(n) && n.parent);
  if (liveRoots.length) {
    const insideLast = sel.every(n => liveRoots.some(r => isDescendantOrSelf(n, r.id)));
    if (!sel.length || insideLast) return liveRoots;
  }
  return sel;
}

// Hidden layers and component/variant containers are skipped. Layers inside
// instances ARE scanned: styles are applied to them as instance overrides, or
// to the main component when it lives in this file (see styleTargetFor).
function styleScanNodes(roots) {
  const out = [];
  const visit = (node) => {
    if (!node || node.visible === false) return;
    if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET') out.push(node);
    if (hasChildren(node)) {
      for (const child of node.children) visit(child);
    }
  };
  for (const root of roots) visit(root);
  return out;
}

// A text layer can mix fonts, sizes and spacing across its characters. Reading
// node.fontName then returns figma.mixed, which used to make the whole layer
// unscannable. Each styled run is read instead, the same way colour runs are.
//
// Runs that are only whitespace or punctuation (a space set in another font,
// say) are folded into the run before them: they are not a design decision and
// would otherwise litter the results with near-duplicate styles.
async function textTypeRuns(node) {
  var runs = [];
  try {
    var baseFields = ['fontName', 'fontSize', 'lineHeight', 'letterSpacing', 'textCase', 'textDecoration', 'fillStyleId'];
    // Each run's own text style and typography variables, so a run that was
    // styled after the last scan isn't reported as unlinked again.
    var segs;
    try { segs = node.getStyledTextSegments(baseFields.concat(['textStyleId', 'boundVariables'])); }
    catch (e) { segs = node.getStyledTextSegments(baseFields); }
    for (var i = 0; i < segs.length; i++) {
      var seg = segs[i];
      if (!seg.fontName || typeof seg.fontSize !== 'number') continue;
      var chars = typeof seg.characters === 'string' ? seg.characters : '';
      // ES2017: no \p{...} property escapes. A run is "filler" when it holds no
      // letter or digit at all — a space or a stray comma in another font.
      var filler = !/[A-Za-z0-9\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(chars);
      if (filler && runs.length) {
        // extend the previous run over this one
        runs[runs.length - 1].range.end = seg.end;
        continue;
      }
      runs.push({
        spec: {
          family: seg.fontName.family, style: seg.fontName.style, fontSize: seg.fontSize,
          lineHeight: seg.lineHeight || { unit: 'AUTO' },
          letterSpacing: seg.letterSpacing || { unit: 'PERCENT', value: 0 },
          upper: seg.textCase === 'UPPER'
        },
        styleId: typeof seg.textStyleId === 'string' ? seg.textStyleId : '',
        varIds: seg.boundVariables ? boundTextVariableIds(seg) : [],
        range: { start: seg.start, end: seg.end, text: chars.length > 24 ? chars.slice(0, 24) + '…' : chars }
      });
    }
  } catch (e) {}
  // A trailing filler run with nothing before it is dropped entirely.
  return runs;
}

// A text layer can hold several colours at once — different words or
// characters. node.fills is figma.mixed there, so the runs have to be read
// segment by segment. Returns one entry per coloured run.
async function textColorRuns(node) {
  var runs = [];
  try {
    var segs = node.getStyledTextSegments(['fills', 'fillStyleId']);
    for (var i = 0; i < segs.length; i++) {
      var seg = segs[i];
      var fills = seg.fills;
      if (!Array.isArray(fills) || !fills.length) continue;
      var chars = typeof seg.characters === 'string' ? seg.characters : '';
      runs.push({
        fills: fills,
        styleId: typeof seg.fillStyleId === 'string' ? seg.fillStyleId : '',
        range: { start: seg.start, end: seg.end, text: chars.length > 24 ? chars.slice(0, 24) + '…' : chars }
      });
    }
  } catch (e) {}
  return runs;
}

// Color variables copied in from another file show by name in Figma's fill
// panel, but don't exist in this file. Resolves aliases in the default mode.
async function resolveColorVariable(cache, id, depth) {
  depth = depth || 0;
  if (depth > 5) return null;
  if (cache.has(id) && depth === 0) return cache.get(id);
  let out = null;
  try {
    const v = await figma.variables.getVariableByIdAsync(id);
    if (v && v.resolvedType === 'COLOR') {
      let modeId = Object.keys(v.valuesByMode)[0];
      try {
        const col = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
        if (col && v.valuesByMode[col.defaultModeId] !== undefined) modeId = col.defaultModeId;
      } catch (e) {}
      let value = v.valuesByMode[modeId];
      if (value && value.type === 'VARIABLE_ALIAS') {
        const target = await resolveColorVariable(cache, value.id, depth + 1);
        value = target ? target.color : null;
      }
      if (value && typeof value.r === 'number') {
        out = { variable: v, remote: !!v.remote, name: v.name, color: value };
      }
    }
  } catch (e) {}
  if (depth === 0) cache.set(id, out);
  return out;
}

async function getStyleCached(cache, id) {
  if (cache.has(id)) return cache.get(id);
  let style = null;
  try { style = await figma.getStyleByIdAsync(id); } catch (e) {}
  cache.set(id, style);
  return style;
}

function solidOfStyle(style) {
  if (!style || !Array.isArray(style.paints) || style.paints.length !== 1) return null;
  const p = style.paints[0];
  if (p.type !== 'SOLID') return null;
  return { hex: rgbToHexStr(p.color), opacity: typeof p.opacity === 'number' ? p.opacity : 1 };
}

// Colour styles are created individually, never inside groups: Figma turns
// every "/" in a style name into a folder. "Brand / Primary" -> "Primary".
// A last part that is only a number or percentage keeps the part before it,
// so "Blue/500" -> "Blue 500" and "White / 6%" -> "White 6%".
function flatColorStyleName(name) {
  var parts = String(name || '').split('/').map(function (p) { return p.trim(); }).filter(Boolean);
  if (!parts.length) return String(name || '').trim();
  var last = parts[parts.length - 1];
  if (parts.length > 1 && /^[\d.,]+%?$/.test(last)) {
    var prev = parts[parts.length - 2];
    if (parts.length > 2 && /^[\d.,]+%?$/.test(prev)) prev = parts[parts.length - 3] + ' ' + prev;
    return prev + ' ' + last;
  }
  return last;
}

function uniqueName(name, taken) {
  let candidate = name;
  let n = 2;
  while (taken.has(candidate)) {
    candidate = name + ' ' + n;
    n++;
  }
  taken.add(candidate);
  return candidate;
}

// ── Color naming ───────────────────────────────────────────────────────────
const HUE_NAMES = [
  [12, 'Red'], [40, 'Orange'], [65, 'Yellow'], [85, 'Lime'], [150, 'Green'],
  [175, 'Teal'], [195, 'Cyan'], [235, 'Blue'], [255, 'Indigo'], [275, 'Violet'],
  [300, 'Purple'], [340, 'Pink'], [361, 'Red']
];

function colorShade(hex) {
  const hsl = hexToHsl(hex);
  const h = hsl[0], s = hsl[1], l = hsl[2];
  // Low chroma counts as neutral, so tinted grays (e.g. #E5E7EB) stay "Gray".
  const ch = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const chroma = (Math.max.apply(null, ch) - Math.min.apply(null, ch)) / 255;
  if (chroma < 0.1 || s < 12 || l >= 92 || l <= 15) {
    let name = 'Black';
    if (l >= 98) name = 'White';
    else if (l >= 85) name = 'Light Gray';
    else if (l >= 45) name = 'Gray';
    else if (l >= 18) name = 'Dark Gray';
    return { neutral: true, name: name };
  }
  let hue = 'Red';
  for (let i = 0; i < HUE_NAMES.length; i++) {
    if (h < HUE_NAMES[i][0]) { hue = HUE_NAMES[i][1]; break; }
  }
  const prefix = l >= 80 ? 'Light ' : l <= 25 ? 'Dark ' : '';
  return { neutral: false, name: prefix + hue };
}

// "Dark Gray", "Blue", "White 6%" … — one flat name per colour, with no
// group prefix, since colour styles are created individually.
function suggestColorName(hex, opacity, uses, taken) {
  const shade = colorShade(hex);
  const pct = opPct(opacity);
  const base = shade.name + (pct < 100 ? ' ' + pct + '%' : '');
  return uniqueName(base, taken);
}

// ── Color scan ─────────────────────────────────────────────────────────────
async function scanColors(roots) {
  const nodes = styleScanNodes(roots);
  const locals = await figma.getLocalPaintStylesAsync();
  const localIds = new Set(locals.map(s => s.id));
  const localByKey = new Map();
  const localByNameKey = new Map();
  for (const s of locals) {
    const sp = solidOfStyle(s);
    if (!sp) continue;
    const k = colorKey(sp.hex, sp.opacity);
    if (!localByKey.has(k)) localByKey.set(k, s);
    localByNameKey.set(s.name + '||' + k, s);
  }

  const cache = new Map();
  const varCache = new Map();
  // Variables that really exist in this file right now. A variable deleted in
  // Figma can still be returned by id while layers reference it, so a local
  // id missing from this set is treated as deleted.
  const liveLocalVarIds = new Set();
  try {
    (await figma.variables.getLocalVariablesAsync('COLOR')).forEach(v => liveLocalVarIds.add(v.id));
  } catch (e) {}
  const localUse = new Map();   // local styleId -> uses
  const remoteUse = new Map();  // remote styleId -> { style, uses }
  const remoteVarUse = new Map(); // remote variableId -> { name, hex, opacity, uses }
  const localVarUse = new Map();  // local  variableId -> { name, hex, opacity, uses }
  const unlinked = new Map();   // colorKey -> { hex, opacity, uses }

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    // One "source" is a set of paints plus the style that drives them. A
    // normal layer has one per property; a text layer with several colours
    // contributes one per coloured run, each carrying its character range.
    const collectSource = async (prop, paints, sid, range) => {
      if (!Array.isArray(paints) || !paints.length) return;
      if (typeof sid === 'string' && sid) {
        const style = await getStyleCached(cache, sid);
        if (!style) return;
        if (localIds.has(sid) && !style.remote) {
          if (!localUse.has(sid)) localUse.set(sid, []);
          localUse.get(sid).push(useRef(node, prop, false, null, range));
        } else {
          if (!remoteUse.has(sid)) remoteUse.set(sid, { style: style, uses: [] });
          remoteUse.get(sid).uses.push(useRef(node, prop, false, null, range));
        }
        return;
      }
      const solids = paints.filter(p => p.type === 'SOLID' && p.visible !== false);
      // A style replaces every paint, so only single-paint sources can be
      // linked automatically.
      const multi = !(paints.length === 1 && solids.length === 1);
      const paintInfo = multi ? describePaints(paints, prop) : null;
      for (const p of solids) {
        if (p.boundVariables && p.boundVariables.color) {
          const vid = p.boundVariables.color.id;
          const rv = await resolveColorVariable(varCache, vid);
          // Measured in Figma: binding a COLOR variable OVERWRITES paint.opacity
          // with the variable's alpha. The two are therefore always equal, so
          // multiplying them squares the value — a 20% colour would read as 4%.
          const op = rv ? (typeof rv.color.a === 'number' ? rv.color.a : 1) : 1;
          if (rv && rv.remote) {
            // From another file — offer to make a local copy.
            if (!remoteVarUse.has(vid)) remoteVarUse.set(vid, { name: rv.name, hex: rgbToHexStr(rv.color), opacity: op, uses: [] });
            remoteVarUse.get(vid).uses.push(useRef(node, prop, multi, paintInfo, range));
            continue;
          }
          if (rv && liveLocalVarIds.has(vid)) {
            // Defined in this file — already linked, and listed in its own
            // section alongside Color Styles.
            if (!localVarUse.has(vid)) localVarUse.set(vid, { name: rv.name, hex: rgbToHexStr(rv.color), opacity: op, uses: [] });
            localVarUse.get(vid).uses.push(useRef(node, prop, multi, paintInfo, range));
            continue;
          }
          // The variable was deleted (or can't be resolved): the binding is a
          // dangling reference, so the paint's own colour is unlinked.
        }
        const hex = rgbToHexStr(p.color);
        const op = typeof p.opacity === 'number' ? p.opacity : 1;
        const k = colorKey(hex, op);
        if (!unlinked.has(k)) unlinked.set(k, { hex: hex, opacity: op, uses: [] });
        unlinked.get(k).uses.push(useRef(node, prop, multi, paintInfo, range));
      }
    };

    for (const prop of ['fills', 'strokes']) {
      if (!(prop in node)) continue;
      const paints = node[prop];
      const styleProp = prop === 'fills' ? 'fillStyleId' : 'strokeStyleId';
      const sid = styleProp in node ? node[styleProp] : '';

      // Text whose characters differ in colour: scan every run rather than
      // skipping the layer, so none of its colours go unreported.
      if (node.type === 'TEXT' && prop === 'fills' && (paints === figma.mixed || sid === figma.mixed)) {
        const runs = await textColorRuns(node);
        for (const run of runs) await collectSource(prop, run.fills, run.styleId, run.range);
        continue;
      }
      if (paints === figma.mixed || sid === figma.mixed) continue;
      await collectSource(prop, paints, sid, null);
    }
    if ((i + 1) % 300 === 0) {
      figma.ui.postMessage({ type: 'style-progress', scope: 'colors', completed: i + 1, total: nodes.length });
      await pause();
    }
  }

  const taken = new Set(locals.map(s => s.name));
  // Everything this file already defines, by value — styles AND variables.
  const tokenIndex = await buildTokenIndex('paint');

  const matchLocalById = new Map();
  // A matched value may be held by a style, a variable, or both. The row
  // carries whatever was found so the UI can label the action per the dropdown.
  const addLocalMatch = (found, hex, opacity, uses, styleOverride) => {
    const style = styleOverride || found.style;
    const id = style ? style.id : (found.variable ? found.variable.id : hex + '|' + opacity);
    if (!matchLocalById.has(id)) {
      matchLocalById.set(id, {
        key: 'l:' + id,
        styleId: style ? style.id : null,
        styleName: style ? style.name : null,
        variableId: found.variable ? found.variable.id : null,
        variableName: found.variable ? found.variable.name : null,
        state: found.state || (style ? 'style' : 'none'),
        hex: hex, opacity: opacity, uses: []
      });
    }
    Array.prototype.push.apply(matchLocalById.get(id).uses, uses);
  };

  // Styles linked from another file (layers pasted in keep the link).
  const matchRemote = [];
  const remoteByKey = new Map();
  for (const [sid, r] of remoteUse) {
    const sp = solidOfStyle(r.style);
    const k = sp ? colorKey(sp.hex, sp.opacity) : null;
    // Reuse a local style with the same value (same name preferred) instead of
    // creating a duplicate of the other file's style.
    const twin = k ? (localByNameKey.get(r.style.name + '||' + k) || localByKey.get(k)) : null;
    if (twin) {
      addLocalMatch(resolveToken(tokenIndex, k), sp.hex, sp.opacity, r.uses, twin);
      continue;
    }
    const row = {
      key: 'r:' + sid, styleId: sid, name: r.style.name, source: 'style',
      hex: sp ? sp.hex : null, opacity: sp ? sp.opacity : 1, uses: r.uses.slice()
    };
    matchRemote.push(row);
    if (k && !remoteByKey.has(k)) remoteByKey.set(k, row);
  }
  for (const [vid, rv] of remoteVarUse) {
    const k = colorKey(rv.hex, rv.opacity);
    const twin = localByNameKey.get(rv.name + '||' + k) || localByKey.get(k);
    if (twin) { addLocalMatch(resolveToken(tokenIndex, k), rv.hex, rv.opacity, rv.uses, twin); continue; }
    const row = { key: 'v:' + vid, variableId: vid, name: rv.name, source: 'variable', hex: rv.hex, opacity: rv.opacity, uses: rv.uses.slice() };
    matchRemote.push(row);
    if (!remoteByKey.has(k)) remoteByKey.set(k, row);
  }

  const newColors = [];
  for (const [k, e] of unlinked) {
    const found = resolveToken(tokenIndex, k);
    if (found.state !== 'none') { addLocalMatch(found, e.hex, e.opacity, e.uses); continue; }
    const remote = remoteByKey.get(k);
    if (remote) { Array.prototype.push.apply(remote.uses, e.uses); continue; }
    newColors.push({ key: 'n:' + k, hex: e.hex, opacity: e.opacity, uses: e.uses, suggested: '' });
  }
  newColors.sort((a, b) => b.uses.length - a.uses.length);
  for (const row of newColors) row.suggested = suggestColorName(row.hex, row.opacity, row.uses, taken);

  let matchLocal = Array.from(matchLocalById.values());

  // A style replaces every paint on a layer, so layers with several fills
  // (e.g. image + color) can't be linked automatically. They move to a
  // "Needs manual fix" list and rows left with no fixable layers disappear.
  const manual = [];
  const splitManual = (rows, label) => rows.filter(row => {
    const fixable = row.uses.filter(u => !u.multi);
    for (const u of row.uses) {
      if (!u.multi) continue;
      manual.push({ id: u.id, path: u.path, type: u.type, prop: u.prop, inst: u.inst, paints: u.paints || '',
        hex: row.hex, opacity: row.opacity, label: label(row) });
    }
    row.uses = fixable;
    return fixable.length > 0;
  });
  const newColorsFixable = splitManual(newColors, r => 'Unlinked color');
  matchLocal = splitManual(matchLocal, r => 'Matches “' + r.styleName + '”');
  const matchRemoteFixable = splitManual(matchRemote, r => (r.source === 'variable' ? 'Variable' : 'Style') + ' “' + r.name + '” from another file');
  matchLocal.sort((a, b) => b.uses.length - a.uses.length);
  matchRemoteFixable.sort((a, b) => b.uses.length - a.uses.length);

  const colorStyles = [];
  for (const s of locals) {
    const uses = localUse.get(s.id);
    if (!uses) continue;
    const sp = solidOfStyle(s);
    colorStyles.push({ key: 's:' + s.id, styleId: s.id, name: s.name, hex: sp ? sp.hex : null, opacity: sp ? sp.opacity : 1, uses: uses });
  }

  // Colour variables defined in this file and used in the scanned frame —
  // the same shape as colorStyles so the UI renders them with one component.
  const colorVariables = [];
  for (const [vid, v] of localVarUse) {
    colorVariables.push({ key: 'lv:' + vid, variableId: vid, name: v.name, hex: v.hex, opacity: v.opacity, uses: v.uses });
  }
  colorVariables.sort((a, b) => b.uses.length - a.uses.length || a.name.localeCompare(b.name));

  // Near-duplicates across ALL local styles: same opacity and practically the
  // same color (CIE Lab ΔE < 3). Same color at a different opacity is usually
  // a deliberate overlay, so it's only flagged, never offered for merging.
  // Variables take part in near-duplicate detection too, so a style and a
  // variable that are nearly the same colour are caught as well as two styles.
  const pool = [];
  const localVarEntries = await localVariablesWithValues('COLOR');
  const localVarIds = new Set(localVarEntries.map(e => e.variable.id));

  for (const s of locals) {
    const sp = solidOfStyle(s);
    if (!sp) continue;
    // A style bound to a local variable has no value of its own — it IS that
    // variable. Pairing the two would report a duplicate that merging can
    // never clear, because linking them is exactly what merging does.
    const paint = s.paints && s.paints[0];
    const boundId = paint && paint.boundVariables && paint.boundVariables.color
      ? paint.boundVariables.color.id : null;
    if (boundId && localVarIds.has(boundId)) continue;
    pool.push({ id: s.id, name: s.name, kind: 'style', hex: sp.hex, opacity: sp.opacity, lab: hexToLab(sp.hex), uses: (localUse.get(s.id) || []).length });
  }
  for (const entry of localVarEntries) {
    const val = entry.value;
    if (!val || typeof val.r !== 'number') continue;
    const vhex = rgbToHexStr(val);
    const vop = typeof val.a === 'number' ? val.a : 1;
    pool.push({
      id: entry.variable.id, name: entry.variable.name, kind: 'variable',
      hex: vhex, opacity: vop, lab: hexToLab(vhex),
      uses: (localVarUse.get(entry.variable.id) || { uses: [] }).uses.length
    });
  }
  const nearDupes = [];
  const grouped = new Set();
  for (let i = 0; i < pool.length; i++) {
    if (grouped.has(i)) continue;
    const group = [pool[i]];
    for (let j = i + 1; j < pool.length; j++) {
      if (grouped.has(j)) continue;
      if (opPct(pool[i].opacity) === opPct(pool[j].opacity) && labDistance(pool[i].lab, pool[j].lab) < 3) { group.push(pool[j]); grouped.add(j); }
    }
    if (group.length > 1) { grouped.add(i); nearDupes.push(group.map(stripLab)); }
  }
  const byHex = new Map();
  for (const p of pool) {
    if (!byHex.has(p.hex)) byHex.set(p.hex, []);
    byHex.get(p.hex).push(p);
  }
  const opacityVariants = [];
  for (const list of byHex.values()) {
    const pcts = new Set(list.map(p => opPct(p.opacity)));
    if (pcts.size > 1) opacityVariants.push(list.slice().sort((a, b) => b.opacity - a.opacity).map(stripLab));
  }

  const detachedLayers = new Set();
  for (const r of newColorsFixable) for (const u of r.uses) detachedLayers.add(u.id);
  for (const r of matchLocal) for (const u of r.uses) detachedLayers.add(u.id);
  for (const r of matchRemoteFixable) for (const u of r.uses) detachedLayers.add(u.id);
  const manualLayers = new Set(manual.map(m => m.id));
  let instanceLayers = 0;
  for (const list of [newColorsFixable, matchLocal, matchRemoteFixable]) for (const r of list) for (const u of r.uses) if (u.inst) instanceLayers++;

  const styleVarDupes = await findColorStyleVariableDupes(
    new Map(Array.from(localVarUse.entries()).map(e => [e[0], e[1].uses])));

  return {
    colorStyles: colorStyles,
    colorVariables: colorVariables,
    styleVarDupes: styleVarDupes,
    newColors: newColorsFixable,
    matchLocal: matchLocal,
    matchRemote: matchRemoteFixable,
    nearDupes: nearDupes,
    opacityVariants: opacityVariants,
    manual: manual,
    summary: {
      localStyles: colorStyles.length,
      localVariables: colorVariables.length,
      remoteStyles: matchRemoteFixable.length,
      detached: newColorsFixable.length + matchLocal.length + matchRemoteFixable.length,
      detachedLayers: detachedLayers.size,
      manualLayers: manualLayers.size,
      instanceLayers: instanceLayers,
      dupes: nearDupes.length + styleVarDupes.length,
      scannedNodes: nodes.length
    }
  };
}

function stripLab(p) {
  return { id: p.id, name: p.name, kind: p.kind || 'style', hex: p.hex, opacity: p.opacity, uses: p.uses };
}

function hexToLab(hex) {
  const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const R = lin(parseInt(hex.slice(1, 3), 16)), G = lin(parseInt(hex.slice(3, 5), 16)), B = lin(parseInt(hex.slice(5, 7), 16));
  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

function labDistance(a, b) {
  return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2) + Math.pow(a[2] - b[2], 2));
}

// ── Text helpers ───────────────────────────────────────────────────────────
function lhKey(lh) {
  if (!lh || lh.unit === 'AUTO') return 'AUTO';
  return lh.unit + ':' + round2(lh.value);
}

function lsKey(ls) {
  if (!ls || !ls.value) return 'ZERO';
  return ls.unit + ':' + round2(ls.value);
}

function textSpecKey(spec) {
  return spec.family + '|' + spec.style + '|' + round2(spec.fontSize) + '|' + lhKey(spec.lineHeight) + '|' + lsKey(spec.letterSpacing);
}

function textSpecOfStyle(style) {
  return {
    family: style.fontName ? style.fontName.family : '',
    style: style.fontName ? style.fontName.style : '',
    fontSize: style.fontSize || 0,
    lineHeight: style.lineHeight || { unit: 'AUTO' },
    letterSpacing: style.letterSpacing || { unit: 'PERCENT', value: 0 }
  };
}

function textSpecOfNode(node) {
  if (node.fontName === figma.mixed || node.fontSize === figma.mixed || node.lineHeight === figma.mixed || node.letterSpacing === figma.mixed) return null;
  const chars = typeof node.characters === 'string' ? node.characters : '';
  const upper = node.textCase === 'UPPER' || (/[A-Z]/.test(chars) && chars === chars.toUpperCase());
  return {
    family: node.fontName.family,
    style: node.fontName.style,
    fontSize: node.fontSize,
    lineHeight: node.lineHeight,
    letterSpacing: node.letterSpacing,
    upper: upper
  };
}

// The common leading words of a set of variable names, so "Caption Font Size"
// and "Caption Line Height" (or the older "Caption/fontSize") both give
// "Caption". Returns '' when they share nothing.
function sharedTokenPrefix(names) {
  if (!names || !names.length) return '';
  // One variable: its own name, minus the property suffix, is the group name.
  // (The prefix loop below would consume the whole name and keep the suffix.)
  if (names.length === 1) {
    var only = String(names[0]).replace(/\/[^\/]+$/, '');
    for (var key in TEXT_FIELD_LABEL) {
      var suffix = ' ' + TEXT_FIELD_LABEL[key];
      if (only.length > suffix.length && only.slice(-suffix.length) === suffix) {
        return only.slice(0, only.length - suffix.length);
      }
    }
    return only;
  }
  var parts = names.map(function (n) {
    return String(n).replace(/\/[^\/]+$/, '').split(/[\s\/]+/).filter(Boolean);
  });
  var out = [];
  for (var i = 0; i < parts[0].length; i++) {
    var word = parts[0][i], same = true;
    for (var j = 1; j < parts.length; j++) if (parts[j][i] !== word) { same = false; break; }
    if (!same) break;
    out.push(word);
  }
  return out.join(' ').trim();
}

// Flat variable names: "Caption Font Size" rather than "Caption/fontSize",
// which Figma renders as a folder per text style.
var TEXT_FIELD_LABEL = {
  fontFamily: 'Font Family', fontStyle: 'Font Style', fontWeight: 'Font Weight',
  fontSize: 'Font Size', lineHeight: 'Line Height', letterSpacing: 'Letter Spacing'
};
function textVarName(groupName, field) {
  return groupName + ' ' + (TEXT_FIELD_LABEL[field] || field);
}

function boundTextVariableIds(holder) {
  var bound = holder.boundVariables || {};
  var out = [];
  for (var i = 0; i < TEXT_VAR_FIELDS.length; i++) {
    var field = TEXT_VAR_FIELDS[i].field;
    var v = bound[field];
    if (!v) continue;
    if (Array.isArray(v)) {
      for (var j = 0; j < v.length; j++) if (v[j] && v[j].id) out.push({ field: field, id: v[j].id });
    } else if (v.id) {
      out.push({ field: field, id: v.id });
    }
  }
  return out;
}

function hasTextVariableBinding(node) {
  const bound = node.boundVariables || {};
  return !!bound.fontSize || !!bound.fontFamily || !!bound.fontWeight || !!bound.fontStyle || !!bound.letterSpacing || !!bound.lineHeight;
}

// Web-standard names: H1–H6 for clearly larger text; small uppercase text
// becomes Eyebrow; otherwise Body Large / Body / Body Small / Caption relative
// to the most common size in the frame, plus the weight when not Regular
// (e.g. "Body Bold", "Body Small Medium").
const HEADING_STEPS = [[56, 'H1'], [46, 'H2'], [38, 'H3'], [30, 'H4'], [26, 'H5'], [22, 'H6']];

function weightSuffix(style) {
  const s = String(style || '').replace(/\bRegular\b/i, '').replace(/\s+/g, ' ').trim();
  return s ? ' ' + s : '';
}

function suggestTextName(spec, baseSize, taken) {
  let name = null;
  for (const step of HEADING_STEPS) {
    if (spec.fontSize >= step[0]) { name = step[1]; break; }
  }
  if (!name && spec.upper && spec.fontSize <= baseSize + 2) name = 'Eyebrow';
  if (!name) {
    let group = 'Body';
    if (spec.fontSize > baseSize + 1) group = 'Body Large';
    else if (spec.fontSize <= 12) group = 'Caption';
    else if (spec.fontSize < baseSize - 1) group = 'Body Small';
    name = group + weightSuffix(spec.style);
  }
  if (taken.has(name) && /^(H\d|Eyebrow)$/.test(name)) name = name + weightSuffix(spec.style);
  return uniqueName(name, taken);
}

// ── Text scan ──────────────────────────────────────────────────────────────
async function scanText(roots) {
  const nodes = styleScanNodes(roots).filter(n => n.type === 'TEXT');
  const locals = await figma.getLocalTextStylesAsync();
  const localIds = new Set(locals.map(s => s.id));
  const localByKey = new Map();
  const localByNameKey = new Map();
  for (const s of locals) {
    const k = textSpecKey(textSpecOfStyle(s));
    if (!localByKey.has(k)) localByKey.set(k, s);
    localByNameKey.set(s.name + '||' + k, s);
  }

  const cache = new Map();
  const localUse = new Map();
  const remoteUse = new Map();
  const unlinked = new Map();
  const sizeFreq = new Map();
  const famMap = new Map();
  // signature of a layer's bound variables -> { fields, uses, spec }
  const localTextVarUse = new Map();
  const textVarCache = new Map();   // variableId -> resolved record
  // Counting LAYERS, not runs: a layer with three runs in one family uses that
  // family once, which is what the "N layers" label claims.
  const noteFont = (family, style, nodeId) => {
    let e = famMap.get(family);
    if (!e) famMap.set(family, e = { family: family, styles: new Set(), layers: new Set() });
    e.styles.add(style);
    e.layers.add(nodeId);
  };
  let mixedSkipped = 0;

  // A layer (or one run of it) that uses a text style. False when the style
  // can't be read, so the caller can fall back to treating it as unlinked.
  const noteStyleUse = async (sid, use) => {
    const style = await getStyleCached(cache, sid);
    if (!style) return false;
    if (localIds.has(sid) && !style.remote) {
      if (!localUse.has(sid)) localUse.set(sid, []);
      localUse.get(sid).push(use);
    } else {
      if (!remoteUse.has(sid)) remoteUse.set(sid, { style: style, uses: [] });
      remoteUse.get(sid).uses.push(use);
    }
    return true;
  };
  // Resolve each bound variable once, then key the use by the exact
  // combination it has. Every use sharing a combination becomes one text
  // style, which is the thing a conversion can actually create. False when
  // none of the variables is a readable local one.
  const noteVarUse = async (tvars, use, spec) => {
    var fields = [];
    for (var tv = 0; tv < tvars.length; tv++) {
      var tid = tvars[tv].id;
      var rec = textVarCache.get(tid);
      if (rec === undefined) {
        rec = null;
        try {
          var variable = await figma.variables.getVariableByIdAsync(tid);
          if (variable && !variable.remote) {
            rec = { id: tid, name: variable.name, value: await variableValue(variable) };
          }
        } catch (e) {}
        textVarCache.set(tid, rec);
      }
      if (rec) fields.push({ field: tvars[tv].field, id: tid, name: rec.name, value: rec.value });
    }
    if (!fields.length) return false;
    fields.sort(function (a, b) { return a.field < b.field ? -1 : a.field > b.field ? 1 : 0; });
    var sig = fields.map(function (f) { return f.field + '=' + f.id; }).join('|');
    var grp = localTextVarUse.get(sig);
    // Unbound properties keep whatever the layer itself has, so a
    // partially-bound layer still yields a complete style.
    if (!grp) localTextVarUse.set(sig, grp = { fields: fields, uses: [], spec: spec });
    grp.uses.push(use);
    return true;
  };

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.fontSize !== figma.mixed) {
      const sz = Math.round(node.fontSize);
      if (sz > 0) sizeFreq.set(sz, (sizeFreq.get(sz) || 0) + 1);
    }
    if (node.fontName !== figma.mixed) {
      noteFont(node.fontName.family, node.fontName.style, node.id);
    }

    const sid = node.textStyleId;
    // Mixed typography, or mixed text styles, inside one layer: scan run by run
    // rather than skipping it.
    if (sid === figma.mixed || node.fontName === figma.mixed || node.fontSize === figma.mixed ||
        node.lineHeight === figma.mixed || node.letterSpacing === figma.mixed) {
      const runs = await textTypeRuns(node);
      if (!runs.length) { mixedSkipped++; continue; }
      for (const run of runs) {
        // Every run's font belongs in the Fonts summary.
        noteFont(run.spec.family, run.spec.style, node.id);
        const sz = Math.round(run.spec.fontSize);
        if (sz > 0) sizeFreq.set(sz, (sizeFreq.get(sz) || 0) + 1);

        // A run that already has a text style or typography variables applied
        // is linked — it must not come back as an unresolved match.
        const runUse = useRef(node, 'text', false, null, run.range);
        if (run.styleId && await noteStyleUse(run.styleId, runUse)) continue;
        if (run.varIds && run.varIds.length && await noteVarUse(run.varIds, runUse, run.spec)) continue;

        const rk = textSpecKey(run.spec);
        if (!unlinked.has(rk)) unlinked.set(rk, { spec: run.spec, uses: [] });
        unlinked.get(rk).uses.push(runUse);
      }
      continue;
    }
    if (typeof sid === 'string' && sid) {
      await noteStyleUse(sid, useRef(node, 'text'));
      continue;
    }
    var tvars = boundTextVariableIds(node);
    if (tvars.length && await noteVarUse(tvars, useRef(node, 'text'), textSpecOfNode(node))) continue;
    const spec = textSpecOfNode(node);
    if (!spec) { mixedSkipped++; continue; }   // unreadable for another reason
    const k = textSpecKey(spec);
    if (!unlinked.has(k)) unlinked.set(k, { spec: spec, uses: [] });
    unlinked.get(k).uses.push(useRef(node, 'text'));

    if ((i + 1) % 300 === 0) {
      figma.ui.postMessage({ type: 'style-progress', scope: 'text', completed: i + 1, total: nodes.length });
      await pause();
    }
  }

  let baseSize = 16;
  let bestCount = -1;
  for (const [size, count] of sizeFreq) {
    if (count > bestCount) { bestCount = count; baseSize = size; }
  }

  const tokenIndex = await buildTokenIndex('text');

  const matchLocalById = new Map();
  const addLocalMatch = (found, uses, styleOverride, specFallback) => {
    const style = styleOverride || found.style;
    const spec = style ? textSpecOfStyle(style) : specFallback;
    const group = found.variable;
    const id = style ? style.id : (group && group.length ? group[0].variable.id : textSpecKey(spec));
    if (!matchLocalById.has(id)) {
      matchLocalById.set(id, {
        key: 'l:' + id,
        styleId: style ? style.id : null,
        styleName: style ? style.name : null,
        variableName: group && group.length ? group[0].variable.name.replace(/\/[^\/]+$/, '') : null,
        variableFields: group ? group.map(g => g.field) : null,
        state: found.state || (style ? 'style' : 'none'),
        styleSpec: spec, spec: spec, uses: []
      });
    }
    Array.prototype.push.apply(matchLocalById.get(id).uses, uses);
  };

  const matchRemote = [];
  const remoteByKey = new Map();
  for (const [sid, r] of remoteUse) {
    const spec = textSpecOfStyle(r.style);
    const k = textSpecKey(spec);
    const twin = localByNameKey.get(r.style.name + '||' + k) || localByKey.get(k);
    if (twin) { addLocalMatch(resolveToken(tokenIndex, k), r.uses, twin); continue; }
    const row = { key: 'r:' + sid, styleId: sid, name: r.style.name, spec: spec, styleSpec: spec, uses: r.uses.slice() };
    matchRemote.push(row);
    if (!remoteByKey.has(k)) remoteByKey.set(k, row);
  }

  const taken = new Set(locals.map(s => s.name));
  const newText = [];
  for (const [k, e] of unlinked) {
    const found = resolveToken(tokenIndex, k);
    if (found.state !== 'none') { addLocalMatch(found, e.uses, null, e.spec); continue; }
    const remote = remoteByKey.get(k);
    if (remote) { Array.prototype.push.apply(remote.uses, e.uses); continue; }
    newText.push({ key: 'n:' + k, spec: e.spec, uses: e.uses, suggested: '' });
  }
  // Largest first so heading names are handed out top-down.
  newText.sort((a, b) => b.spec.fontSize - a.spec.fontSize || b.uses.length - a.uses.length);
  for (const row of newText) row.suggested = suggestTextName(row.spec, baseSize, taken);

  const matchLocal = Array.from(matchLocalById.values()).sort((a, b) => b.uses.length - a.uses.length);
  matchRemote.sort((a, b) => b.uses.length - a.uses.length);

  const textStyles = [];
  for (const s of locals) {
    const uses = localUse.get(s.id);
    if (!uses) continue;
    textStyles.push({ key: 's:' + s.id, styleId: s.id, name: s.name, spec: textSpecOfStyle(s), uses: uses });
  }

  // Duplicate local text styles: identical font, weight, size and line height.
  const dupMap = new Map();
  for (const s of locals) {
    const spec = textSpecOfStyle(s);
    const k = spec.family + '|' + spec.style + '|' + round2(spec.fontSize) + '|' + lhKey(spec.lineHeight);
    if (!dupMap.has(k)) dupMap.set(k, []);
    dupMap.get(k).push({ id: s.id, name: s.name, spec: spec, uses: (localUse.get(s.id) || []).length });
  }
  const duplicates = Array.from(dupMap.values()).filter(g => g.length > 1);

  const fontFamilies = Array.from(famMap.values())
    .map(f => ({ family: f.family, styles: Array.from(f.styles).sort(), count: f.layers.size }))
    .sort((a, b) => b.count - a.count);
  const typeSizeInfo = Array.from(sizeFreq.entries()).map(e => ({ size: e[0], count: e[1] })).sort((a, b) => b.size - a.size);

  const unlinkedLayers = new Set();
  let instanceLayers = 0;
  for (const list of [newText, matchLocal, matchRemote]) for (const r of list) for (const u of r.uses) if (u.inst) instanceLayers++;
  for (const r of newText) for (const u of r.uses) unlinkedLayers.add(u.id);
  for (const r of matchLocal) for (const u of r.uses) unlinkedLayers.add(u.id);
  for (const r of matchRemote) for (const u of r.uses) unlinkedLayers.add(u.id);

  // Typography variables defined in this file and bound to text in the frame.
  // Figma has no single "text style variable", so each bound property is its
  // own variable and is listed as its own row.
  const textVariables = [];
  localTextVarUse.forEach((grp, sig) => {
    if (!grp.uses.length) return;
    // Name the group after the shared prefix of its variables — "Caption" from
    // "Caption Font Size" / "Caption/fontSize" — else suggest one from the type.
    const groupName = sharedTokenPrefix(grp.fields.map(f => f.name))
      || (grp.spec ? suggestTextName(grp.spec, baseSize, new Set()) : 'Text');
    textVariables.push({
      key: 'tvg:' + sig,
      name: groupName,
      signature: sig,
      spec: grp.spec,
      // Each bound property, for the expanded view.
      fields: grp.fields.map(f => ({
        field: f.field, variableId: f.id, name: f.name,
        value: f.value == null ? '' : String(f.value)
      })),
      uses: grp.uses
    });
  });
  textVariables.sort((a, b) => b.uses.length - a.uses.length || a.name.localeCompare(b.name));

  const styleVarDupes = await findTextStyleVariableDupes(
    Array.from(localTextVarUse.values()).map(g => ({ ids: g.fields.map(f => f.id), uses: g.uses })));

  return {
    textStyles: textStyles,
    textVariables: textVariables,
    styleVarDupes: styleVarDupes,
    newText: newText,
    matchLocal: matchLocal,
    matchRemote: matchRemote,
    duplicates: duplicates,
    fontFamilies: fontFamilies,
    typeSizeInfo: typeSizeInfo,
    summary: {
      localStyles: textStyles.length,
      localVariables: textVariables.length,
      remoteStyles: matchRemote.length,
      unlinked: newText.length + matchLocal.length + matchRemote.length,
      unlinkedLayers: unlinkedLayers.size,
      dupes: duplicates.length + styleVarDupes.length,
      families: fontFamilies.length,
      sizes: typeSizeInfo.length,
      mixedSkipped: mixedSkipped,
      instanceLayers: instanceLayers,
      scannedNodes: nodes.length
    }
  };
}

function indexScanRows(data) {
  const byKey = {};
  const lists = [data.colorStyles || data.textStyles || [], data.newColors || data.newText || [], data.matchLocal || [], data.matchRemote || []];
  for (const list of lists) for (const row of list) byKey[row.key] = row;
  return byKey;
}

// ── Style creation / application ───────────────────────────────────────────
async function findLocalStylesByName(kind) {
  const list = kind === 'paint' ? await figma.getLocalPaintStylesAsync() : await figma.getLocalTextStylesAsync();
  const map = new Map();
  for (const s of list) if (!map.has(s.name)) map.set(s.name, s);
  return map;
}

// Returns the list of names that already exist, or [] when there is no conflict.
async function styleNameConflicts(kind, names) {
  const existing = await findLocalStylesByName(kind);
  const out = [];
  for (let n of names) {
    // Paint styles are created under their flat name, so check that one.
    if (kind === 'paint') n = flatColorStyleName(n);
    if (existing.has(n) && out.indexOf(n) === -1) out.push(n);
  }
  return out;
}

async function createOrUpdatePaintStyle(name, paints, conflict, existing) {
  name = flatColorStyleName(name);
  let style = conflict === 'update' ? existing.get(name) : null;
  if (!style) {
    style = figma.createPaintStyle();
    existing.set(name, style);
  }
  style.name = name;
  style.paints = paints;
  return style;
}

async function loadTextNodeFonts(node) {
  if (node.fontName !== figma.mixed) {
    await figma.loadFontAsync(node.fontName);
    return;
  }
  const fonts = node.getRangeAllFontNames(0, node.characters.length);
  for (const f of fonts) await figma.loadFontAsync(f);
}

async function createOrUpdateTextStyle(name, spec, conflict, existing) {
  const fontName = { family: spec.family, style: spec.style };
  try {
    await figma.loadFontAsync(fontName);
  } catch (e) {
    // Name the font — the raw rejection says nothing useful.
    throw new Error('“' + fontName.family + ' ' + fontName.style + '” isn\'t installed.');
  }
  let style = conflict === 'update' ? existing.get(name) : null;
  if (!style) {
    style = figma.createTextStyle();
    existing.set(name, style);
  }
  style.name = name;
  style.fontName = fontName;
  style.fontSize = spec.fontSize;
  style.lineHeight = spec.lineHeight;
  style.letterSpacing = spec.letterSpacing;
  if (spec.textCase) style.textCase = spec.textCase;
  if (spec.textDecoration) style.textDecoration = spec.textDecoration;
  if (spec.extra) {
    for (const k in spec.extra) {
      try { style[k] = spec.extra[k]; } catch (e) {}
    }
  }
  return style;
}

function pushReason(result, reason) {
  if (reason && result.reasons.length < 3 && result.reasons.indexOf(reason) === -1) result.reasons.push(reason);
}

// Where a style should go for a layer. Inside an instance of a component that
// lives in this file, the matching layer in the main component is styled (so
// every instance updates); inside a component from another file, the layer
// itself is styled as an instance override.
async function styleTargetFor(node) {
  let outer = null;
  let current = node;
  while (current && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
    if (current.type === 'INSTANCE') outer = current;
    current = current.parent;
  }
  if (!outer) return { node: node, via: null };
  let main = null;
  try { main = await outer.getMainComponentAsync(); } catch (e) {}
  if (!main || main.remote) return { node: node, via: 'override' };
  if (node.id === outer.id) return { node: main, via: 'component' };
  const parts = node.id.split(';');
  if (parts.length === 2 && parts[0] === 'I' + outer.id) {
    let source = null;
    try { source = await figma.getNodeByIdAsync(parts[1]); } catch (e) {}
    if (source && isDescendantOrSelf(source, main.id)) return { node: source, via: 'component' };
  }
  return { node: node, via: 'override' };
}

// Style edits are allowed on instance layers (as overrides), so only missing
// or locked layers are blocked here.
function styleBlockedReason(node) {
  if (!isEditableNode(node)) return 'Layer no longer exists.';
  let current = node;
  while (current && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
    if (current.locked) return 'Layer is locked.';
    current = current.parent;
  }
  return null;
}

async function applyStyleToUses(kind, style, uses, result, opts) {
  if (kind === 'text') {
    try { await figma.loadFontAsync(style.fontName); } catch (e) {
      result.skipped += uses.length;
      pushReason(result, '“' + style.fontName.family + ' ' + style.fontName.style + '” isn\'t installed.');
      return;
    }
  }
  for (const u of uses) {
    if (u.multi) {
      result.skipped++;
      pushReason(result, 'Layers with more than one fill/stroke were skipped — a style replaces every paint.');
      continue;
    }
    let found = null;
    try { found = await figma.getNodeByIdAsync(u.id); } catch (e) {}
    if (!found) { result.skipped++; continue; }
    const target = await styleTargetFor(found);
    const node = target.node;
    const blocked = styleBlockedReason(node);
    if (blocked) { result.skipped++; pushReason(result, blocked); continue; }
    const ranged = typeof u.start === 'number' && typeof u.end === 'number' && u.end > u.start;
    const doneKey = node.id + '|' + u.prop + (ranged ? '|' + u.start + '-' + u.end : '');
    if (result.done && result.done.has(doneKey)) { result.applied++; continue; }
    try {
      if (kind === 'text') {
        await loadTextNodeFonts(node);
        if (opts && opts.unbindVars) {
          for (const def of TEXT_VAR_FIELDS) {
            try {
              if (ranged) node.setRangeBoundVariable(u.start, u.end, def.field, null);
              else node.setBoundVariable(def.field, null);
            } catch (e) {}
          }
        }
        if (ranged) await node.setRangeTextStyleIdAsync(u.start, u.end, style.id);
        else await node.setTextStyleIdAsync(style.id);
        // An instance that overrides its typography keeps the override when
        // the main component is styled, so the scanned layer would stay
        // unlinked. Style it directly as well.
        if (target.via === 'component' && found !== node && !found.removed) {
          const now = ranged ? found.getRangeTextStyleId(u.start, u.end) : found.textStyleId;
          if (now !== style.id) {
            try {
              await loadTextNodeFonts(found);
              if (ranged) await found.setRangeTextStyleIdAsync(u.start, u.end, style.id);
              else await found.setTextStyleIdAsync(style.id);
            } catch (e) { pushReason(result, 'An instance override could not be styled.'); }
          }
        }
      } else if (ranged) {
        // Only the characters this colour actually covers.
        await loadTextNodeFonts(node);
        await node.setRangeFillStyleIdAsync(u.start, u.end, style.id);
      } else if (u.prop === 'strokes') {
        await node.setStrokeStyleIdAsync(style.id);
      } else {
        await node.setFillStyleIdAsync(style.id);
      }
      result.applied++;
      if (!result.done) result.done = new Set();
      result.done.add(doneKey);
      if (target.via === 'override') result.overrides = (result.overrides || 0) + 1;
      if (target.via === 'component') result.components = (result.components || 0) + 1;
    } catch (e) {
      result.skipped++;
      pushReason(result, e && e.message ? e.message : 'Apply failed.');
    }
  }
}

// Bind a COLOR variable to every layer a scan row covers — the variables
// counterpart of applyStyleToUses().
async function applyVariableToUses(variable, uses, result) {
  for (var i = 0; i < uses.length; i++) {
    var u = uses[i];
    if (u.multi) {
      result.skipped++;
      pushReason(result, 'Layers with more than one fill/stroke were skipped — a variable binds a single paint.');
      continue;
    }
    var found = null;
    try { found = await figma.getNodeByIdAsync(u.id); } catch (e) {}
    if (!found) { result.skipped++; continue; }
    var target = await styleTargetFor(found);
    var node = target.node;
    var blocked = styleBlockedReason(node);
    if (blocked) { result.skipped++; pushReason(result, blocked); continue; }
    var ranged = typeof u.start === 'number' && typeof u.end === 'number' && u.end > u.start;
    var doneKey = node.id + '|' + u.prop + (ranged ? '|' + u.start + '-' + u.end : '');
    if (result.done && result.done.has(doneKey)) { result.applied++; continue; }
    try {
      var prop = u.prop === 'strokes' ? 'strokes' : 'fills';

      // One coloured run inside a text layer.
      if (ranged) {
        await loadTextNodeFonts(node);
        var runFills = node.getRangeFills(u.start, u.end);
        if (!Array.isArray(runFills) || runFills.length !== 1 || runFills[0].type !== 'SOLID') {
          result.skipped++;
          pushReason(result, 'Only a single solid fill can be bound to a variable.');
          continue;
        }
        try { await node.setRangeFillStyleIdAsync(u.start, u.end, ''); } catch (e) {}
        var runBound = figma.variables.setBoundVariableForPaint(node.getRangeFills(u.start, u.end)[0], 'color', variable);
        node.setRangeFills(u.start, u.end, [runBound]);
        result.applied++;
        if (!result.done) result.done = new Set();
        result.done.add(doneKey);
        if (target.via === 'override') result.overrides = (result.overrides || 0) + 1;
        if (target.via === 'component') result.components = (result.components || 0) + 1;
        continue;
      }

      var paints = node[prop];
      if (!Array.isArray(paints) || paints.length !== 1 || paints[0].type !== 'SOLID') {
        result.skipped++;
        pushReason(result, 'Only a single solid ' + (prop === 'strokes' ? 'stroke' : 'fill') + ' can be bound to a variable.');
        continue;
      }
      // A style and a variable can't both drive the same paint.
      try {
        if (prop === 'strokes') await node.setStrokeStyleIdAsync('');
        else await node.setFillStyleIdAsync('');
      } catch (e) {}
      var bound = figma.variables.setBoundVariableForPaint(node[prop][0], 'color', variable);
      node[prop] = [bound];
      result.applied++;
      if (!result.done) result.done = new Set();
      result.done.add(doneKey);
      if (target.via === 'override') result.overrides = (result.overrides || 0) + 1;
      if (target.via === 'component') result.components = (result.components || 0) + 1;
    } catch (e) {
      result.skipped++;
      pushReason(result, e && e.message ? e.message : 'Could not bind the variable.');
    }
  }
}

// ── Duplicates ACROSS types: the same value held by both a style and a
// variable. Merging binds the style to the variable, so one value drives both
// and every layer keeps working — nothing is deleted.
// The colour variable a paint is bound to, when that variable still exists:
// a local one in this file's variable list, or one from a library. A variable
// deleted in Figma leaves a dangling id behind, which counts as unbound.
async function liveColorBindingId(paint, liveLocalIds) {
  var id = paint && paint.boundVariables && paint.boundVariables.color
    ? paint.boundVariables.color.id : null;
  if (!id) return null;
  if (liveLocalIds.has(id)) return id;
  var v = null;
  try { v = await figma.variables.getVariableByIdAsync(id); } catch (e) {}
  return v && v.remote ? id : null;
}

async function findColorStyleVariableDupes(varUses) {
  var styles = await figma.getLocalPaintStylesAsync();
  var vars = await localVariablesWithValues('COLOR');
  var liveIds = new Set(vars.map(function (e) { return e.variable.id; }));
  var out = [];
  for (var i = 0; i < styles.length; i++) {
    var st = styles[i];
    if (st.remote) continue;
    var sv = solidOfStyle(st);
    if (!sv) continue;
    // Already pointing at a variable? Then it isn't a duplicate.
    if (await liveColorBindingId(st.paints[0], liveIds)) continue;
    var match = findColorVariable(vars, sv.hex, sv.opacity);
    if (!match) continue;
    out.push({
      key: 'sv:' + st.id, styleId: st.id, styleName: st.name,
      variableId: match.id, variableName: match.name,
      hex: sv.hex, opacity: sv.opacity,
      // Layers bound to the variable in this frame — the Styles direction
      // re-points these at the style.
      uses: (varUses && varUses.get(match.id)) ? varUses.get(match.id).slice() : []
    });
  }
  return out;
}

// A text style duplicates a variable group when EVERY property it defines is
// already held by a variable of the right scope and value.
// The variables holding every property a text style defines, or null when any
// property has no matching variable (a partial match isn't a duplicate).
function textStyleVariableMatches(st, floatPool, stringPool) {
  var spec = textSpecOfStyle(st);
  var src = {
    family: spec.family, style: spec.style, size: spec.fontSize,
    lh: lineHeightNumber(spec.lineHeight), ls: letterSpacingNumber(spec.letterSpacing)
  };
  var matches = [], wanted = 0;
  for (var f = 0; f < TEXT_VAR_FIELDS.length; f++) {
    var def = TEXT_VAR_FIELDS[f];
    var value = src[def.prop];
    if (value === null || value === undefined) continue;
    wanted++;
    var pool = def.type === 'STRING' ? stringPool : floatPool;
    var hit = findTextVariable(pool, { type: def.type, value: value, scope: def.scope }, [textVarName(st.name, def.field), st.name + '/' + def.field]);
    if (hit) matches.push({ field: def.field, variable: hit });
  }
  if (!wanted || matches.length !== wanted) return null;
  return { spec: spec, matches: matches };
}

// Plugin data on a text style recording that the user resolved its duplicate
// variable group in favour of the style ("Link to style"): the variable ids,
// sorted, so the record only holds while the same variables still match.
var SV_RESOLVED_KEY = 'svResolvedVars';
function variableIdSignature(matches) {
  return matches.map(function (m) { return m.variable.id; }).sort().join(',');
}

// varGroups: the frame's layers bound to typography variables, as
// [{ ids: [variableId…], uses: [...] }]. A group whose variables all belong to
// a style's matching set is a layer the Styles direction re-points.
async function findTextStyleVariableDupes(varGroups) {
  var styles = await figma.getLocalTextStylesAsync();
  var floatPool = await localVariablesWithValues('FLOAT');
  var stringPool = await localVariablesWithValues('STRING');
  var out = [];
  for (var i = 0; i < styles.length; i++) {
    var st = styles[i];
    if (st.remote) continue;
    var already = boundTextVariableIds(st);
    if (already.length) continue;                 // already linked to variables
    var found = textStyleVariableMatches(st, floatPool, stringPool);
    if (!found) continue;
    var matches = found.matches;
    var idSet = new Set(matches.map(function (m) { return m.variable.id; }));
    var uses = [];
    (varGroups || []).forEach(function (g) {
      if (g.ids.length && g.ids.every(function (id) { return idSet.has(id); })) Array.prototype.push.apply(uses, g.uses);
    });
    // Resolved in favour of the style, and no layer here is bound to those
    // variables any more: not an open duplicate. A layer bound to them again
    // brings the row back.
    var resolved = '';
    try { resolved = st.getPluginData(SV_RESOLVED_KEY); } catch (e) {}
    if (resolved && resolved === variableIdSignature(matches) && !uses.length) continue;
    out.push({
      key: 'sv:' + st.id, styleId: st.id, styleName: st.name,
      variableName: matches[0].variable.name.replace(/\/[^\/]+$/, ''),
      fields: matches.map(function (m) { return m.field; }),
      spec: found.spec,
      uses: uses
    });
  }
  return out;
}

// Link a style to the variable(s) holding its value.
async function mergeStyleIntoVariable(kind, styleId) {
  var result = { created: 0, applied: 0, skipped: 0, merged: 0, reasons: [], unit: 'style' };
  var style = await figma.getStyleByIdAsync(styleId);
  if (!style || style.remote) { result.skipped++; pushReason(result, 'That style is no longer available.'); return result; }

  if (kind === 'paint') {
    var sv = solidOfStyle(style);
    if (!sv) { result.skipped++; pushReason(result, 'Only a single solid paint can be linked to a variable.'); return result; }
    var vars = await localVariablesWithValues('COLOR');
    var match = findColorVariable(vars, sv.hex, sv.opacity);
    if (!match) { result.skipped++; pushReason(result, 'No variable holds that color any more.'); return result; }
    var bound = figma.variables.setBoundVariableForPaint(style.paints[0], 'color', match);
    style.paints = [bound];
    result.merged = 1;
    return result;
  }

  var floatPool = await localVariablesWithValues('FLOAT');
  var stringPool = await localVariablesWithValues('STRING');
  var spec = textSpecOfStyle(style);
  var src = {
    family: spec.family, style: spec.style, size: spec.fontSize,
    lh: lineHeightNumber(spec.lineHeight), ls: letterSpacingNumber(spec.letterSpacing)
  };
  var n = 0;
  for (var f = 0; f < TEXT_VAR_FIELDS.length; f++) {
    var def = TEXT_VAR_FIELDS[f];
    var value = src[def.prop];
    if (value === null || value === undefined) continue;
    var pool = def.type === 'STRING' ? stringPool : floatPool;
    var hit = findTextVariable(pool, { type: def.type, value: value, scope: def.scope }, [textVarName(style.name, def.field), style.name + '/' + def.field]);
    if (!hit) continue;
    try { style.setBoundVariable(def.field, hit); n++; } catch (e) {}
  }
  if (!n) { result.skipped++; pushReason(result, 'Figma rejected the typography bindings on that style.'); return result; }
  result.merged = 1;
  result.bound = n;
  return result;
}

// The other direction: when styles are the source of truth, the layers bound
// to the variable are re-pointed at the style. A Figma variable cannot
// reference a style, so re-pointing the layers is the only way to resolve the
// duplicate in favour of the style.
async function mergeVariableIntoStyle(kind, styleId, uses) {
  var result = { created: 0, applied: 0, skipped: 0, merged: 0, reasons: [], unit: 'style' };
  var style = await figma.getStyleByIdAsync(styleId);
  if (!style || style.remote) { result.skipped++; pushReason(result, 'That style is no longer available.'); return result; }
  if (!uses || !uses.length) {
    pushReason(result, 'No layer in this frame uses that variable, so there was nothing to re-point.');
    result.merged = 1;
    if (kind === 'text') await markTextStyleResolved(style);
    return result;
  }
  // A text layer's bound variables would keep driving its type over the style.
  await applyStyleToUses(kind, style, uses, result, kind === 'text' ? { unbindVars: true } : null);
  if (result.applied) {
    result.merged = 1;
    if (kind === 'text') await markTextStyleResolved(style);
  }
  return result;
}

// Record on a text style that its duplicate variable group was resolved in its
// favour, so the next scan stops listing the pair (see findTextStyleVariableDupes).
async function markTextStyleResolved(style) {
  try {
    var found = textStyleVariableMatches(style,
      await localVariablesWithValues('FLOAT'), await localVariablesWithValues('STRING'));
    if (found) style.setPluginData(SV_RESOLVED_KEY, variableIdSignature(found.matches));
  } catch (e) {}
}

// Bind a group of typography variables to every text layer a scan row covers.
async function applyTextVariablesToUses(vars, uses, result) {
  for (var i = 0; i < uses.length; i++) {
    var u = uses[i];
    var found = null;
    try { found = await figma.getNodeByIdAsync(u.id); } catch (e) {}
    if (!found) { result.skipped++; continue; }
    var target = await styleTargetFor(found);
    var node = target.node;
    var blocked = styleBlockedReason(node);
    if (blocked) { result.skipped++; pushReason(result, blocked); continue; }
    var ranged = typeof u.start === 'number' && typeof u.end === 'number' && u.end > u.start;
    var doneKey = node.id + (ranged ? '|' + u.start + '-' + u.end : '');
    if (result.done && result.done.has(doneKey)) { result.applied++; continue; }
    try {
      // Changing type on a text node needs its fonts loaded first.
      await loadTextNodeFonts(node);
      // A text style and variables can't both drive the same properties.
      try {
        if (ranged) await node.setRangeTextStyleIdAsync(u.start, u.end, '');
        else await node.setTextStyleIdAsync('');
      } catch (e) {}
      var bound = 0;
      for (var v = 0; v < vars.length; v++) {
        try {
          if (ranged) node.setRangeBoundVariable(u.start, u.end, vars[v].field, vars[v].variable);
          else node.setBoundVariable(vars[v].field, vars[v].variable);
          bound++;
        } catch (e) {}
      }
      if (!bound) { result.skipped++; pushReason(result, 'Figma rejected every typography binding on this layer.'); continue; }
      // As in applyStyleToUses(): an instance that overrides its typography
      // keeps the override, so bind the scanned layer directly too.
      if (target.via === 'component' && found !== node && !found.removed && !ranged && !hasTextVariableBinding(found)) {
        try {
          await loadTextNodeFonts(found);
          try { await found.setTextStyleIdAsync(''); } catch (e) {}
          for (var fv = 0; fv < vars.length; fv++) {
            try { found.setBoundVariable(vars[fv].field, vars[fv].variable); } catch (e) {}
          }
        } catch (e) {}
      }
      result.applied++;
      if (!result.done) result.done = new Set();
      result.done.add(doneKey);
      if (target.via === 'override') result.overrides = (result.overrides || 0) + 1;
      if (target.via === 'component') result.components = (result.components || 0) + 1;
    } catch (e) {
      result.skipped++;
      pushReason(result, e && e.message ? e.message : 'Could not bind the variables.');
    }
  }
}

// A row matched an existing VARIABLE — bind the layers to it.
async function bindExistingToUses(kind, found, row, result) {
  if (!found.variable) { result.skipped += row.uses.length; return; }
  if (kind === 'paint') {
    await applyVariableToUses(found.variable, row.uses, result);
  } else {
    await applyTextVariablesToUses(found.variable, row.uses, result);
  }
}

// A row matched only the OTHER kind of token. Create the counterpart from it —
// reusing the existing value and name so the two stay recognisably one token —
// link them, then apply whichever the user asked for.
async function createCounterpartAndApply(kind, found, row, name, msg, result) {
  var toVar = msg.target === 'variables';

  if (kind === 'paint') {
    if (toVar) {
      // Style exists, variable doesn't: make the variable from the style.
      var collection = await getTokenCollection(true, 'paint');
      if (!collection) throw new Error('Could not open a variable collection in this file.');
      var pool = await localVariablesWithValues('COLOR');
      var hex = String(row.hex).toUpperCase();
      var opacity = typeof row.opacity === 'number' ? row.opacity : 1;
      var variable = findColorVariable(pool, hex, opacity);
      if (variable) {
        result.reused = (result.reused || 0) + 1;
      } else {
        var rgba = hexToRgb01(hex);
        rgba.a = opacity;
        variable = figma.variables.createVariable(found.style ? found.style.name : name, collection, 'COLOR');
        await setVarValue(variable, collection, rgba);
        result.created++;
      }
      if (found.style && !found.bound && bindPaintStyleToExactVariable(found.style, variable)) {
        result.linked = (result.linked || 0) + 1;
      }
      await applyVariableToUses(variable, row.uses, result);
      return;
    }
    // Variable exists, style doesn't: make the style and bind it to the variable.
    var existing = await findLocalStylesByName('paint');
    var made = await createOrUpdatePaintStyle(
      found.variable ? found.variable.name : name,
      [{ type: 'SOLID', color: hexToRgb01(String(row.hex).toUpperCase()), opacity: row.opacity }],
      'keep', existing);
    result.created++;
    if (found.variable && bindPaintStyleToExactVariable(made, found.variable)) {
      result.linked = (result.linked || 0) + 1;
    }
    await applyStyleToUses('paint', made, row.uses, result);
    return;
  }

  // Typography
  var spec = row.spec || row.styleSpec;
  if (toVar) {
    var sub = await runTextRowVariableAction(
      { target: 'variables' },
      [{ ref: {}, row: row }],
      [found.style ? found.style.name : name]);
    mergeResults(result, sub);
    return;
  }
  var existingT = await findLocalStylesByName('text');
  var madeT = await createOrUpdateTextStyle(
    found.variable && found.variable.length ? found.variable[0].variable.name.replace(/\/[^\/]+$/, '') : name,
    spec, 'keep', existingT);
  result.created++;
  if (found.variable) {
    var n = 0;
    for (var i = 0; i < found.variable.length; i++) {
      try { madeT.setBoundVariable(found.variable[i].field, found.variable[i].variable); n++; } catch (e) {}
    }
    if (n) result.linked = (result.linked || 0) + 1;
  }
  await applyStyleToUses('text', madeT, row.uses, result);
}

function mergeResults(into, from) {
  if (!from) return;
  var keys = ['created', 'applied', 'skipped', 'reused', 'linked', 'overrides', 'components'];
  for (var i = 0; i < keys.length; i++) if (from[keys[i]]) into[keys[i]] = (into[keys[i]] || 0) + from[keys[i]];
  if (from.reasons) for (var r = 0; r < from.reasons.length; r++) pushReason(into, from.reasons[r]);
}

// Scan rows -> typography variables. One variable per property, grouped under
// the row's name, with the same reuse rule as the Generate flow.
async function runTextRowVariableAction(msg, rows, names) {
  var result = { created: 0, applied: 0, skipped: 0, reused: 0, reasons: [], unit: 'variable' };
  var collection = await getTokenCollection(true, 'text');
  if (!collection) throw new Error('Could not open a variable collection in this file.');
  var floatPool = await localVariablesWithValues('FLOAT');
  var stringPool = await localVariablesWithValues('STRING');

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i].row;
    var spec = row.spec || row.styleSpec;
    if (!spec) { result.skipped += row.uses.length; continue; }
    var src = {
      family: spec.family, style: spec.style, size: spec.fontSize,
      lh: lineHeightNumber(spec.lineHeight), ls: letterSpacingNumber(spec.letterSpacing)
    };
    var made = [];
    try {
      for (var f = 0; f < TEXT_VAR_FIELDS.length; f++) {
        var def = TEXT_VAR_FIELDS[f];
        var value = src[def.prop];
        if (value === null || value === undefined) continue;
        var pool = def.type === 'STRING' ? stringPool : floatPool;
        var flatName = textVarName(names[i], def.field);
        var hit = findTextVariable(pool, { type: def.type, value: value, scope: def.scope }, [flatName, names[i] + '/' + def.field]);
        if (hit) { result.reused++; made.push({ field: def.field, variable: hit }); continue; }
        var nv = figma.variables.createVariable(flatName, collection, def.type);
        try { nv.scopes = [def.scope]; } catch (e) {}
        await setVarValue(nv, collection, value);
        result.created++;
        made.push({ field: def.field, variable: nv });
      }
      if (!made.length) { result.skipped += row.uses.length; continue; }
      await applyTextVariablesToUses(made, row.uses, result);
    } catch (e) {
      result.skipped += row.uses.length;
      pushReason(result, names[i] + ': ' + (e && e.message ? e.message : 'could not create variables'));
    }
  }
  return result;
}

// Scan rows -> colour variables. Same reuse rule as the Generate flow: an
// existing variable of the same value is used rather than a second one made.
async function runRowVariableAction(msg, rows, names) {
  var result = { created: 0, applied: 0, skipped: 0, reused: 0, reasons: [], unit: 'variable' };
  var collection = await getTokenCollection(true, 'paint');
  if (!collection) throw new Error('Could not open a variable collection in this file.');
  var pool = await localVariablesWithValues('COLOR');

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i].row;
    var hex = String(row.hex || '').toUpperCase();
    var opacity = typeof row.opacity === 'number' ? row.opacity : 1;
    if (!hex) { result.skipped += row.uses.length; continue; }
    try {
      var variable = findColorVariable(pool, hex, opacity);
      if (variable) {
        result.reused++;
      } else {
        var rgba = hexToRgb01(hex);
        rgba.a = opacity;
        variable = figma.variables.createVariable(names[i], collection, 'COLOR');
        await setVarValue(variable, collection, rgba);
        pool.push({ variable: variable, value: rgba });
        result.created++;
      }
      await applyVariableToUses(variable, row.uses, result);
    } catch (e) {
      result.skipped += row.uses.length;
      pushReason(result, names[i] + ': ' + (e && e.message ? e.message : 'could not create variable'));
    }
  }
  return result;
}

function cloneJson(v) {
  return JSON.parse(JSON.stringify(v));
}

// Builds the style spec for a scan row (or a remote style copy).
async function rowStyleSource(kind, row) {
  if (kind === 'paint') {
    if (row.key.indexOf('r:') === 0) {
      const remote = await figma.getStyleByIdAsync(row.styleId);
      return remote ? cloneJson(remote.paints) : null;
    }
    return [{ type: 'SOLID', color: hexToRgb01(row.hex), opacity: row.opacity }];
  }
  if (row.key.indexOf('r:') === 0) {
    const remote = await figma.getStyleByIdAsync(row.styleId);
    if (!remote) return null;
    const spec = textSpecOfStyle(remote);
    spec.extra = {};
    for (const k of ['paragraphSpacing', 'paragraphIndent', 'textCase', 'textDecoration']) {
      if (k in remote) spec.extra[k] = remote[k];
    }
    return spec;
  }
  return row.spec;
}

// UI → sandbox: { action: 'apply' | 'create' | 'copy', rows: [{ key, name }] }
async function runRowAction(kind, msg) {
  const scan = kind === 'paint' ? lastColorScan : lastTextScan;
  if (!scan) throw new Error('Run a scan first.');
  const rows = (msg.rows || []).map(r => ({ ref: r, row: scan.byKey[r.key] })).filter(x => x.row);
  const result = { created: 0, applied: 0, skipped: 0, reasons: [] };

  const names = rows.map(x => (x.ref.name || '').trim() || x.row.suggested || x.row.name);

  // The dropdown decides, for every row, whatever it matched. This check used
  // to sit BELOW the apply branch, so "apply" rows always applied a style no
  // matter what the user had selected.
  if (msg.action === 'apply') {
    const index = await buildTokenIndex(kind);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i].row;
      const key = kind === 'paint'
        ? colorKey(String(row.hex).toUpperCase(), row.opacity)
        : textSpecKey(row.spec || row.styleSpec);
      const found = resolveToken(index, key);
      const plan = plannedAction(found.state, msg.target);

      if (plan === 'apply-style') {
        const style = found.style || await figma.getStyleByIdAsync(row.styleId);
        if (!style) { result.skipped += row.uses.length; continue; }
        await applyStyleToUses(kind, style, row.uses, result);
      } else if (plan === 'bind-variable') {
        await bindExistingToUses(kind, found, row, result);
      } else {
        // 'variable-from-style' / 'style-from-variable' / create — the row
        // matched something of the other type, so make the counterpart first.
        await createCounterpartAndApply(kind, found, row, names[i], msg, result);
      }
    }
    return result;
  }

  // "Create & Apply" can produce variables instead of styles. Variables carry
  // no style-name conflict, so that prompt is skipped.
  if (msg.target === 'variables') {
    return kind === 'paint'
      ? await runRowVariableAction(msg, rows, names)
      : await runTextRowVariableAction(msg, rows, names);
  }

  if (msg.conflict !== 'update' && msg.conflict !== 'keep') {
    const conflicts = await styleNameConflicts(kind, names);
    if (conflicts.length) return { conflict: conflicts };
  }
  const existing = await findLocalStylesByName(kind);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i].row;
    const source = await rowStyleSource(kind, row);
    if (!source) { result.skipped += row.uses.length; pushReason(result, 'Source style is no longer available.'); continue; }
    let style;
    try {
      style = kind === 'paint'
        ? await createOrUpdatePaintStyle(names[i], source, msg.conflict, existing)
        : await createOrUpdateTextStyle(names[i], source, msg.conflict, existing);
      result.created++;
    } catch (e) {
      result.skipped += row.uses.length;
      pushReason(result, e && e.message ? e.message : 'Could not create style.');
      continue;
    }
    await applyStyleToUses(kind, style, row.uses, result);
  }
  return result;
}

// Generate items already carry {family, style, fontSize, lineHeight,
// letterSpacing} — exactly the shape textSpecKey() reads.
function specOfItem(item) { return item; }

// Existing local styles indexed by VALUE, so a token that already exists under
// a different name is reused instead of duplicated.
async function stylesByValue(kind) {
  const map = new Map();
  if (kind === 'paint') {
    const list = await figma.getLocalPaintStylesAsync();
    for (const st of list) {
      const sv = solidOfStyle(st);
      if (sv) { const k = colorKey(sv.hex, sv.opacity); if (!map.has(k)) map.set(k, st); }
    }
  } else {
    const list = await figma.getLocalTextStylesAsync();
    for (const st of list) {
      const spec = textSpecOfStyle(st);
      if (spec) { const k = textSpecKey(spec); if (!map.has(k)) map.set(k, st); }
    }
  }
  return map;
}

// Generate flows: create styles from a palette / type scale (no layers).
async function createStylesFromList(kind, msg) {
  const items = msg.items || [];
  const result = { created: 0, applied: 0, skipped: 0, reasons: [] };
  if (msg.conflict !== 'update' && msg.conflict !== 'keep') {
    const conflicts = await styleNameConflicts(kind, items.map(i => i.name));
    if (conflicts.length) return { conflict: conflicts };
  }
  const existing = await findLocalStylesByName(kind);
  const made = [];
  // Reuse pools: an existing style with the same VALUE is the same token under
  // another name, and an existing variable with the same value is what the new
  // style should point at rather than duplicate.
  const sameValueStyles = await stylesByValue(kind);
  const colorVars = kind === 'paint' ? await localVariablesWithValues('COLOR') : [];
  const floatVars = kind === 'text' ? await localVariablesWithValues('FLOAT') : [];
  const stringVars = kind === 'text' ? await localVariablesWithValues('STRING') : [];
  for (const item of items) {
    try {
      const dupe = sameValueStyles.get(kind === 'paint' ? colorKey(String(item.hex).toUpperCase(), item.opacity) : textSpecKey(specOfItem(item)));
      const itemName = kind === 'paint' ? flatColorStyleName(item.name) : item.name;
      if (dupe && dupe.name !== itemName && msg.reuse !== false) {
        made.push(dupe);
        result.reused = (result.reused || 0) + 1;
        continue;
      }
      const style = kind === 'paint'
        ? await createOrUpdatePaintStyle(item.name, [{ type: 'SOLID', color: hexToRgb01(item.hex), opacity: item.opacity }], msg.conflict, existing)
        : await createOrUpdateTextStyle(item.name, item, msg.conflict, existing);
      const bound = kind === 'paint'
        ? await bindPaintStyleToVariable(style, colorVars, String(item.hex).toUpperCase(), item.opacity)
        : await bindTextStyleToVariables(style, floatVars, stringVars, item);
      if (bound) result.bound = (result.bound || 0) + (bound === true ? 1 : bound);
      made.push(style);
      result.created++;
    } catch (e) {
      result.skipped++;
      pushReason(result, item.name + ': ' + (e && e.message ? e.message : 'failed'));
    }
  }
  if (msg.placeOnCanvas && made.length) {
    try {
      await buildStyleGuide(kind, made);
      result.guide = true;
    } catch (e) {
      pushReason(result, 'Styles were created, but the style guide frame failed: ' + (e && e.message ? e.message : 'unknown error'));
    }
  }
  return result;
}


// ── Merging tokens ─────────────────────────────────────────────────────────
// Every paint on a node, as {prop, index, paint, range?}, including the runs of
// a text layer whose characters differ. One shape for all the re-binding below.
function paintSlotsOf(node) {
  var slots = [];
  for (var pi = 0; pi < 2; pi++) {
    var prop = pi === 0 ? 'fills' : 'strokes';
    if (!(prop in node)) continue;
    var paints = node[prop];
    if (node.type === 'TEXT' && prop === 'fills' && paints === figma.mixed) {
      try {
        var segs = node.getStyledTextSegments(['fills']);
        for (var si = 0; si < segs.length; si++) {
          var f = segs[si].fills;
          if (Array.isArray(f)) for (var j = 0; j < f.length; j++) {
            slots.push({ prop: prop, index: j, paint: f[j], range: { start: segs[si].start, end: segs[si].end } });
          }
        }
      } catch (e) {}
      continue;
    }
    if (paints === figma.mixed || !Array.isArray(paints)) continue;
    for (var k = 0; k < paints.length; k++) slots.push({ prop: prop, index: k, paint: paints[k] });
  }
  return slots;
}

function paintBoundTo(paint, variableId) {
  return !!(paint && paint.boundVariables && paint.boundVariables.color && paint.boundVariables.color.id === variableId);
}

// How many layers in the WHOLE file use a token. The merge dialog shows this,
// because deleting is a file-wide act and the frame's count understates it.
async function countTokenUsesInFile(kind, id) {
  await figma.loadAllPagesAsync();
  var n = 0;
  var pages = figma.root.children;
  for (var p = 0; p < pages.length; p++) {
    var nodes = pages[p].findAll(function () { return true; });
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (kind === 'style') {
        if (node.fillStyleId === id || node.strokeStyleId === id || node.textStyleId === id) n++;
        continue;
      }
      var slots = paintSlotsOf(node);
      for (var s2 = 0; s2 < slots.length; s2++) {
        if (paintBoundTo(slots[s2].paint, id)) { n++; break; }
      }
    }
  }
  return n;
}

// Re-bind every paint in the file that points at one of `removeIds` so it
// points at `keep` instead. Returns how many could not be re-bound.
async function rebindVariableEverywhere(keep, removeIds, result) {
  await figma.loadAllPagesAsync();
  var failed = 0;
  var pages = figma.root.children;
  for (var p = 0; p < pages.length; p++) {
    var nodes = pages[p].findAll(function () { return true; });
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var slots = paintSlotsOf(node);
      for (var s2 = 0; s2 < slots.length; s2++) {
        var slot = slots[s2];
        var hit = false;
        for (var r = 0; r < removeIds.length; r++) if (paintBoundTo(slot.paint, removeIds[r])) { hit = true; break; }
        if (!hit) continue;
        try {
          if (slot.range) {
            await loadTextNodeFonts(node);
            var runFills = node.getRangeFills(slot.range.start, slot.range.end).slice();
            runFills[slot.index] = figma.variables.setBoundVariableForPaint(
              Object.assign({}, runFills[slot.index], { opacity: 1 }), 'color', keep);
            node.setRangeFills(slot.range.start, slot.range.end, runFills);
          } else {
            var arr = node[slot.prop].slice();
            arr[slot.index] = figma.variables.setBoundVariableForPaint(
              Object.assign({}, arr[slot.index], { opacity: 1 }), 'color', keep);
            node[slot.prop] = arr;
          }
          result.applied++;
        } catch (e) {
          failed++;
          pushReason(result, 'Could not re-link “' + node.name + '” — it may be inside an instance from another file.');
        }
      }
    }
  }

  // Styles whose paint points at a removed variable follow it to the keeper.
  var styles = await figma.getLocalPaintStylesAsync();
  for (var si = 0; si < styles.length; si++) {
    var st = styles[si];
    if (st.remote || !st.paints.length) continue;
    var bound = false;
    for (var rr = 0; rr < removeIds.length; rr++) if (paintBoundTo(st.paints[0], removeIds[rr])) { bound = true; break; }
    if (bound && bindPaintStyleToExactVariable(st, keep)) result.linked = (result.linked || 0) + 1;
  }

  // And variables that alias a removed one.
  var allVars = await figma.variables.getLocalVariablesAsync('COLOR');
  for (var vi = 0; vi < allVars.length; vi++) {
    var v = allVars[vi];
    if (v.remote || v.id === keep.id) continue;
    var col = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
    var modes = col ? col.modes : [];
    for (var mi = 0; mi < modes.length; mi++) {
      var val = v.valuesByMode[modes[mi].modeId];
      if (val && val.type === 'VARIABLE_ALIAS' && removeIds.indexOf(val.id) !== -1) {
        try { v.setValueForMode(modes[mi].modeId, figma.variables.createVariableAlias(keep)); } catch (e) {}
      }
    }
  }
  return failed;
}

// variable + variable
async function mergeVariables(keepId, removeIds, result) {
  var keep = await figma.variables.getVariableByIdAsync(keepId);
  if (!keep) { pushReason(result, 'The variable to keep no longer exists.'); return; }
  var failed = await rebindVariableEverywhere(keep, removeIds, result);
  for (var i = 0; i < removeIds.length; i++) {
    var v = await figma.variables.getVariableByIdAsync(removeIds[i]);
    if (!v || v.remote) continue;
    if (failed) {
      // Something still points at it — keeping it is safer than orphaning a layer.
      pushReason(result, plural(failed, 'layer') + ' couldn\'t be re-linked — kept “' + v.name + '” instead of deleting it.');
      result.skipped += failed;
      continue;
    }
    try { v.remove(); result.removed = (result.removed || 0) + 1; } catch (e) {
      pushReason(result, 'Could not delete “' + v.name + '”.');
    }
  }
}

// style + variable, routed by the Create dropdown.
async function mergeStyleAndVariable(styleId, variableId, target, removeUnused, result) {
  var style = await figma.getStyleByIdAsync(styleId);
  var variable = await figma.variables.getVariableByIdAsync(variableId);
  if (!style || !variable) { pushReason(result, 'That pair is no longer available.'); return; }

  if (target === 'variables') {
    // Layers on the style move to the variable; the style is linked to it.
    var uses = await layersUsingStyle(styleId);
    var failed = 0;
    for (var i = 0; i < uses.length; i++) {
      var before = result.skipped;
      await applyVariableToUses(variable, [uses[i]], result);
      if (result.skipped > before) failed++;
    }
    if (bindPaintStyleToExactVariable(style, variable)) result.linked = (result.linked || 0) + 1;
    if (removeUnused && !failed) {
      var stillUsed = await styleUsedAnywhere(styleId);
      if (!stillUsed) { try { style.remove(); result.removed = (result.removed || 0) + 1; } catch (e) {} }
      else pushReason(result, '“' + style.name + '” is still used elsewhere, so it was kept and linked.');
    } else if (failed) {
      pushReason(result, plural(failed, 'layer') + ' couldn\'t be re-linked — kept “' + style.name + '” linked instead.');
    }
    return;
  }

  // Styles mode: layers on the variable move to the style, and the style is
  // bound to the variable so the two stay in sync. The variable is never
  // deleted automatically.
  var varUses = await layersUsingVariable(variableId);
  await applyStyleToUses('paint', style, varUses, result);
  if (bindPaintStyleToExactVariable(style, variable)) result.linked = (result.linked || 0) + 1;
}

async function layersUsingStyle(styleId) {
  await figma.loadAllPagesAsync();
  var out = [];
  var pages = figma.root.children;
  for (var p = 0; p < pages.length; p++) {
    var nodes = pages[p].findAll(function (n) { return n.fillStyleId === styleId || n.strokeStyleId === styleId; });
    for (var i = 0; i < nodes.length; i++) {
      out.push(useRef(nodes[i], nodes[i].strokeStyleId === styleId ? 'strokes' : 'fills'));
    }
  }
  return out;
}

async function layersUsingVariable(variableId) {
  await figma.loadAllPagesAsync();
  var out = [];
  var pages = figma.root.children;
  for (var p = 0; p < pages.length; p++) {
    var nodes = pages[p].findAll(function () { return true; });
    for (var i = 0; i < nodes.length; i++) {
      var slots = paintSlotsOf(nodes[i]);
      for (var s2 = 0; s2 < slots.length; s2++) {
        if (!paintBoundTo(slots[s2].paint, variableId)) continue;
        out.push(useRef(nodes[i], slots[s2].prop, false, null, slots[s2].range));
        break;
      }
    }
  }
  return out;
}

// The one entry point: route each group by what it actually contains.
async function mergeTokens(kind, groups, msg) {
  var result = { created: 0, applied: 0, skipped: 0, removed: 0, linked: 0, reasons: [] };
  for (var g = 0; g < groups.length; g++) {
    var grp = groups[g];
    var members = grp.members || [];
    var keepKind = grp.keepKind || 'style';
    var others = members.filter(function (m) { return m.id !== grp.keepId; });

    for (var i = 0; i < others.length; i++) {
      var other = others[i];
      try {
        if (keepKind === 'style' && other.kind === 'style') {
          await mergeStyles(kind, [{ keepId: grp.keepId, keepKind: 'style', members: [other] }], result);
        } else if (keepKind === 'variable' && other.kind === 'variable') {
          await mergeVariables(grp.keepId, [other.id], result);
        } else if (keepKind === 'variable') {
          await mergeStyleAndVariable(other.id, grp.keepId, 'variables', msg.removeUnused === true, result);
        } else {
          await mergeStyleAndVariable(grp.keepId, other.id, 'styles', false, result);
        }
      } catch (e) {
        result.skipped++;
        pushReason(result, e && e.message ? e.message : 'Merge failed.');
      }
    }
  }
  return result;
}

// ── Convert: turn styles into variables, or variables into styles ──────────
// Everything a conversion needs to know before it runs, so the dialog can show
// the user what will happen. Nothing is written during the dry run.
async function planConversion(kind, direction, scopeIds, onlyIds) {
  var roots = (scopeIds && scopeIds.length)
    ? await resolveNodesByIds(scopeIds)
    : [figma.currentPage];
  var data = kind === 'paint' ? await scanColors(roots) : await scanText(roots);
  var rows = direction === 'to-variable'
    ? (kind === 'paint' ? data.colorStyles : data.textStyles)
    : (kind === 'paint' ? (data.colorVariables || []) : (data.textVariables || []));
  if (onlyIds && onlyIds.length) {
    rows = rows.filter(function (r) { return onlyIds.indexOf(r.key) !== -1; });
  }
  return { rows: rows, data: data };
}

// Style -> variable, for one scan row.
async function convertStyleToVariable(row, ctx, result) {
  var hex = String(row.hex).toUpperCase();
  var opacity = typeof row.opacity === 'number' ? row.opacity : 1;
  var style = await figma.getStyleByIdAsync(row.styleId);
  if (!style || style.remote) { result.skipped += row.uses.length; pushReason(result, 'That style is no longer available.'); return; }

  // Prefer a variable of the same value AND name, then any of the same value.
  var variable = null;
  for (var i = 0; i < ctx.pool.length; i++) {
    var e = ctx.pool[i];
    if (!sameColorValue(e.value, hex, opacity)) continue;
    if (e.variable.name === style.name) { variable = e.variable; break; }
    if (!variable) variable = e.variable;
  }
  if (variable) {
    result.reused++;
  } else {
    var rgba = hexToRgb01(hex);
    rgba.a = opacity;
    variable = figma.variables.createVariable(uniqueName(style.name, ctx.taken), ctx.collection, 'COLOR');
    ctx.taken.add(variable.name);
    await setVarValue(variable, ctx.collection, rgba);
    ctx.pool.push({ variable: variable, value: rgba });
    result.created++;
  }

  // Point every layer at the variable instead of the style.
  await applyVariableToUses(variable, row.uses, result);

  if (ctx.removeUnused) {
    var stillUsed = await styleUsedAnywhere(style.id);
    if (!stillUsed) {
      try { style.remove(); result.removed = (result.removed || 0) + 1; return; } catch (e) {}
    } else {
      pushReason(result, '“' + style.name + '” is still used elsewhere in the file, so it was kept and linked.');
    }
  }
  if (bindPaintStyleToExactVariable(style, variable)) result.linked = (result.linked || 0) + 1;
}

// Variable -> style, for one scan row.
async function convertVariableToStyle(row, ctx, result) {
  var hex = String(row.hex).toUpperCase();
  var opacity = typeof row.opacity === 'number' ? row.opacity : 1;
  var variable = await figma.variables.getVariableByIdAsync(row.variableId);
  if (!variable) { result.skipped += row.uses.length; pushReason(result, 'That variable is no longer available.'); return; }

  var style = null;
  var flatName = flatColorStyleName(variable.name);
  for (var i = 0; i < ctx.styles.length; i++) {
    var sv = solidOfStyle(ctx.styles[i]);
    if (!sv || sv.hex !== hex || Math.abs(sv.opacity - opacity) > 0.004) continue;
    if (ctx.styles[i].name === variable.name || ctx.styles[i].name === flatName) { style = ctx.styles[i]; break; }
    if (!style) style = ctx.styles[i];
  }
  if (style) {
    result.reused++;
  } else {
    style = figma.createPaintStyle();
    style.name = uniqueName(flatName, ctx.taken);
    ctx.taken.add(style.name);
    style.paints = [{ type: 'SOLID', color: hexToRgb01(hex), opacity: opacity }];
    ctx.styles.push(style);
    result.created++;
  }
  // The style references the variable — a variable can't point at a style, so
  // this is the only direction a link can run.
  if (bindPaintStyleToExactVariable(style, variable)) result.linked = (result.linked || 0) + 1;
  await applyStyleToUses('paint', style, row.uses, result);
}

// Text styles convert to their 5-variable group, and back.
async function convertTextStyleToVariables(row, ctx, result) {
  var style = await figma.getStyleByIdAsync(row.styleId);
  if (!style || style.remote) { result.skipped += row.uses.length; pushReason(result, 'That text style is no longer available.'); return; }
  var spec = textSpecOfStyle(style);
  var src = {
    family: spec.family, style: spec.style, size: spec.fontSize,
    lh: lineHeightNumber(spec.lineHeight), ls: letterSpacingNumber(spec.letterSpacing)
  };
  var group = [];
  for (var f = 0; f < TEXT_VAR_FIELDS.length; f++) {
    var def = TEXT_VAR_FIELDS[f];
    var value = src[def.prop];
    if (value === null || value === undefined) continue;
    var pool = def.type === 'STRING' ? ctx.stringPool : ctx.floatPool;
    var flatName = textVarName(style.name, def.field);
    var hit = findTextVariable(pool, { type: def.type, value: value, scope: def.scope }, [flatName, style.name + '/' + def.field]);
    if (hit) { result.reused++; group.push({ field: def.field, variable: hit }); continue; }
    var nv = figma.variables.createVariable(flatName, ctx.collection, def.type);
    try { nv.scopes = [def.scope]; } catch (e) {}
    await setVarValue(nv, ctx.collection, value);
    result.created++;
    group.push({ field: def.field, variable: nv });
  }
  if (!group.length) { result.skipped += row.uses.length; return; }
  await applyTextVariablesToUses(group, row.uses, result);

  if (ctx.removeUnused) {
    var stillUsed = await styleUsedAnywhere(style.id);
    if (!stillUsed) { try { style.remove(); result.removed = (result.removed || 0) + 1; return; } catch (e) {} }
    else pushReason(result, '“' + style.name + '” is still used elsewhere in the file, so it was kept and linked.');
  }
  var n = 0;
  for (var g = 0; g < group.length; g++) {
    try { style.setBoundVariable(group[g].field, group[g].variable); n++; } catch (e) {}
  }
  if (n) result.linked = (result.linked || 0) + 1;
}

// A variable group -> one text style. The group's resolved values become the
// style, the style's fields are bound back to the group's variables, and every
// layer in the group is switched to the style.
async function convertTextVariableGroupToStyle(row, ctx, result) {
  var byField = {};
  for (var i = 0; i < (row.fields || []).length; i++) byField[row.fields[i].field] = row.fields[i];

  // Resolved values: a bound variable wins, otherwise the layer's own value.
  var base = row.spec || { family: 'Inter', style: 'Regular', fontSize: 16,
                           lineHeight: { unit: 'AUTO' }, letterSpacing: { unit: 'PERCENT', value: 0 } };
  var family = byField.fontFamily ? String(byField.fontFamily.value) : base.family;
  var fontStyle = byField.fontStyle ? String(byField.fontStyle.value) : base.style;
  var size = byField.fontSize ? Number(byField.fontSize.value) : base.fontSize;
  var lh = byField.lineHeight
    ? { unit: (base.lineHeight && base.lineHeight.unit && base.lineHeight.unit !== 'AUTO') ? base.lineHeight.unit : 'PERCENT',
        value: Number(byField.lineHeight.value) }
    : base.lineHeight;
  var ls = byField.letterSpacing
    ? { unit: (base.letterSpacing && base.letterSpacing.unit) || 'PERCENT', value: Number(byField.letterSpacing.value) }
    : base.letterSpacing;
  var spec = { family: family, style: fontStyle, fontSize: size, lineHeight: lh, letterSpacing: ls };

  // The fonts must be loadable before anything is created or applied.
  try {
    await figma.loadFontAsync({ family: family, style: fontStyle });
  } catch (e) {
    result.skipped += row.uses.length;
    pushReason(result, '“' + family + ' ' + fontStyle + '” isn\'t installed, so “' + row.name + '” was skipped.');
    return;
  }

  // Reuse a style with the same resolved values, preferring the same name.
  var key = textSpecKey(spec);
  var style = null;
  for (var si = 0; si < ctx.styles.length; si++) {
    if (textSpecKey(textSpecOfStyle(ctx.styles[si])) !== key) continue;
    if (ctx.styles[si].name === row.name) { style = ctx.styles[si]; break; }
    if (!style) style = ctx.styles[si];
  }
  if (style) {
    result.reused++;
  } else {
    style = await createOrUpdateTextStyle(uniqueName(row.name, ctx.taken), spec, 'keep', new Map());
    ctx.taken.add(style.name);
    ctx.styles.push(style);
    result.created++;
  }

  // The style points back at the group's variables, so both stay in sync.
  var boundFields = 0;
  for (var f = 0; f < (row.fields || []).length; f++) {
    var fl = row.fields[f];
    try {
      var variable = await figma.variables.getVariableByIdAsync(fl.variableId);
      if (variable) { style.setBoundVariable(fl.field, variable); boundFields++; }
    } catch (e) {}
  }
  if (boundFields) result.linked = (result.linked || 0) + 1;

  // Switch every layer (or styled run) to the style and drop its direct bindings.
  for (var u = 0; u < row.uses.length; u++) {
    var use = row.uses[u];
    var node = null;
    try { node = await figma.getNodeByIdAsync(use.id); } catch (e) {}
    if (!node) { result.skipped++; continue; }
    var target = await styleTargetFor(node);
    var tn = target.node;
    var blocked = styleBlockedReason(tn);
    if (blocked) { result.skipped++; pushReason(result, blocked); continue; }
    try {
      await loadTextNodeFonts(tn);
      var ranged = typeof use.start === 'number' && typeof use.end === 'number' && use.end > use.start;
      // Only the fields this group actually bound, and only where the unbind
      // succeeds. A binding left in place OVERRIDES the text style, so the
      // layer would silently keep its old look — worth reporting, not hiding.
      var unbindFailed = 0;
      for (var uf = 0; uf < (row.fields || []).length; uf++) {
        var field = row.fields[uf].field;
        try {
          if (ranged) tn.setRangeBoundVariable(use.start, use.end, field, null);
          else tn.setBoundVariable(field, null);
        } catch (e) { unbindFailed++; }
      }
      if (ranged) await tn.setRangeTextStyleIdAsync(use.start, use.end, style.id);
      else await tn.setTextStyleIdAsync(style.id);

      if (unbindFailed && boundTextVariableIds(tn).length) {
        // The style was applied but a surviving binding still wins.
        pushReason(result, '“' + (tn.name || 'A layer') + '” kept ' + plural(unbindFailed, 'variable binding') +
          ' that override the new style — unbind them in Figma, or convert that layer on its own.');
      }
      result.applied++;
      if (target.via === 'override') result.overrides = (result.overrides || 0) + 1;
      if (target.via === 'component') result.components = (result.components || 0) + 1;
    } catch (e) {
      result.skipped++;
      pushReason(result, (tn.name || 'A layer') + ': ' + (e && e.message ? e.message : 'could not apply the style.'));
    }
  }
}

// Is a style used by ANY layer in the file? Needed before deleting one.
async function styleUsedAnywhere(styleId) {
  await figma.loadAllPagesAsync();
  var pages = figma.root.children;
  for (var p = 0; p < pages.length; p++) {
    var nodes = pages[p].findAll(function (n) {
      return n.fillStyleId === styleId || n.strokeStyleId === styleId || n.textStyleId === styleId;
    });
    if (nodes.length) return true;
  }
  return false;
}

// The whole conversion, committed as a single undo step by the caller.
async function runConversion(kind, msg) {
  var direction = msg.direction === 'to-style' ? 'to-style' : 'to-variable';
  var result = { created: 0, applied: 0, skipped: 0, reused: 0, linked: 0, removed: 0, reasons: [],
                 unit: direction === 'to-variable' ? 'variable' : 'style' };

  var scopeIds = msg.scope === 'file' ? [] : (kind === 'paint' ? lastColorRootIds : lastTextRootIds);
  var planned = await planConversion(kind, direction, scopeIds, msg.keys);
  var rows = planned.rows;
  if (!rows.length) { pushReason(result, 'Nothing of that kind was found to convert.'); return result; }

  var ctx = { removeUnused: msg.removeUnused === true };
  if (direction === 'to-variable') {
    ctx.collection = await getTokenCollection(true, kind);
    if (!ctx.collection) throw new Error('Could not open a variable collection in this file.');
    if (kind === 'paint') {
      ctx.pool = await localVariablesWithValues('COLOR');
      ctx.taken = new Set(ctx.pool.map(function (e) { return e.variable.name; }));
    } else {
      ctx.floatPool = await localVariablesWithValues('FLOAT');
      ctx.stringPool = await localVariablesWithValues('STRING');
    }
  } else {
    ctx.styles = (await (kind === 'paint' ? figma.getLocalPaintStylesAsync() : figma.getLocalTextStylesAsync()))
      .filter(function (st) { return !st.remote; });
    ctx.taken = new Set(ctx.styles.map(function (st) { return st.name; }));
  }

  for (var i = 0; i < rows.length; i++) {
    try {
      if (kind === 'paint' && direction === 'to-variable') await convertStyleToVariable(rows[i], ctx, result);
      else if (kind === 'paint') await convertVariableToStyle(rows[i], ctx, result);
      else if (direction === 'to-variable') await convertTextStyleToVariables(rows[i], ctx, result);
      else await convertTextVariableGroupToStyle(rows[i], ctx, result);
    } catch (e) {
      result.skipped += rows[i].uses.length;
      pushReason(result, (rows[i].name || 'row') + ': ' + (e && e.message ? e.message : 'conversion failed'));
    }
  }
  return result;
}

// ── The token resolver ──────────────────────────────────────────────────────
// One index of everything this file already defines, keyed by VALUE, so the
// scan, Create & Apply, Generate and Merge all agree on what exists and what
// should happen next. Replaces the style-only lookups the scans used to build.
//
// State is one of:
//   'none'           nothing holds this value
//   'style'          only a style
//   'variable'       only a variable
//   'both-unlinked'  both exist, independently  -> a duplicate, offer Merge
//   'both-linked'    both exist, style bound to the variable
async function buildTokenIndex(kind) {
  var index = new Map();
  var put = function (key, patch) {
    var e = index.get(key);
    if (!e) { e = { style: null, variable: null, bound: false, boundVariableId: null, boundFields: 0 }; index.set(key, e); }
    // Only fill a slot that is still empty, so the first style/variable found
    // for a value wins. `undefined` counts as empty — without it a key the
    // patch introduces for the first time would never be written.
    for (var k in patch) {
      if (e[k] === null || e[k] === false || e[k] === undefined || e[k] === 0) e[k] = patch[k];
    }
    return e;
  };

  if (kind === 'paint') {
    var styles = await figma.getLocalPaintStylesAsync();
    var vars = await localVariablesWithValues('COLOR');
    var liveIds = new Set(vars.map(function (e) { return e.variable.id; }));
    for (var i = 0; i < styles.length; i++) {
      var st = styles[i];
      if (st.remote) continue;
      var sv = solidOfStyle(st);
      if (!sv) continue;
      // A binding to a deleted variable doesn't count as linked.
      var boundId = await liveColorBindingId(st.paints[0], liveIds);
      put(colorKey(sv.hex, sv.opacity), { style: st, boundVariableId: boundId });
    }
    for (var j = 0; j < vars.length; j++) {
      var val = vars[j].value;
      if (!val || typeof val.r !== 'number') continue;
      var a = typeof val.a === 'number' ? val.a : 1;
      put(colorKey(rgbToHexStr(val), a), { variable: vars[j].variable });
    }
  } else {
    var tstyles = await figma.getLocalTextStylesAsync();
    for (var t = 0; t < tstyles.length; t++) {
      var ts = tstyles[t];
      if (ts.remote) continue;
      put(textSpecKey(textSpecOfStyle(ts)), {
        style: ts,
        boundFields: boundTextVariableIds(ts).length
      });
    }
    // A text "variable" is the 5-property group; it exists for a spec when
    // every property that spec defines has a matching variable.
    var floatPool = await localVariablesWithValues('FLOAT');
    var stringPool = await localVariablesWithValues('STRING');
    index.forEach(function (entry, key) {
      if (!entry.style) return;
      var group = matchTextVariableGroup(textSpecOfStyle(entry.style), entry.style.name, floatPool, stringPool);
      if (group) entry.variable = group;
    });
  }

  // Resolve the linked/unlinked distinction.
  index.forEach(function (e) {
    if (kind === 'paint') {
      e.bound = !!(e.boundVariableId && e.variable && e.boundVariableId === e.variable.id);
      if (e.boundVariableId && !e.variable) e.bound = true;   // bound to something we did not index
    } else {
      e.bound = !!(e.boundFields && e.variable);
    }
    e.state = !e.style && !e.variable ? 'none'
            : e.style && !e.variable ? 'style'
            : !e.style && e.variable ? 'variable'
            : e.bound ? 'both-linked' : 'both-unlinked';
  });
  return index;
}

function resolveToken(index, key) {
  return index.get(key) || { style: null, variable: null, bound: false, state: 'none' };
}

// The whole decision table, in one place, so the sandbox's behaviour and the
// UI's button label are computed from the same function and cannot drift.
function plannedAction(state, target) {
  var toVar = target === 'variables';
  switch (state) {
    case 'style':         return toVar ? 'variable-from-style' : 'apply-style';
    case 'variable':      return toVar ? 'bind-variable' : 'style-from-variable';
    case 'both-unlinked': return toVar ? 'bind-variable' : 'apply-style';
    case 'both-linked':   return toVar ? 'bind-variable' : 'apply-style';
    default:              return toVar ? 'create-variable' : 'create-style';
  }
}

// Labels the UI shows; kept beside the table they describe.
var ACTION_LABELS = {
  'create-style': 'Create & Apply',
  'create-variable': 'Create & Apply',
  'apply-style': 'Apply Style',
  'bind-variable': 'Apply Variable',
  'variable-from-style': 'Create Variable from Style',
  'style-from-variable': 'Create Style from Variable'
};

// The 5-property variable group for a text spec, or null when incomplete.
function matchTextVariableGroup(spec, styleName, floatPool, stringPool) {
  var src = {
    family: spec.family, style: spec.style, size: spec.fontSize,
    lh: lineHeightNumber(spec.lineHeight), ls: letterSpacingNumber(spec.letterSpacing)
  };
  var out = [], wanted = 0;
  for (var f = 0; f < TEXT_VAR_FIELDS.length; f++) {
    var def = TEXT_VAR_FIELDS[f];
    var value = src[def.prop];
    if (value === null || value === undefined) continue;
    wanted++;
    var pool = def.type === 'STRING' ? stringPool : floatPool;
    var hit = findTextVariable(pool, { type: def.type, value: value, scope: def.scope }, [textVarName(styleName, def.field), styleName + '/' + def.field]);
    if (hit) out.push({ field: def.field, variable: hit });
  }
  return (wanted && out.length === wanted) ? out : null;
}

// ── Variables: creation and reuse ───────────────────────────────────────────
// Figma has no "text style variable": typography tokens are a GROUP of
// per-property variables (STRING for the font family/style, FLOAT for the
// numbers). A colour token is a single COLOR variable.
var TOKEN_COLLECTION = 'Design Tokens';

var TEXT_VAR_FIELDS = [
  { field: 'fontFamily',    prop: 'family', type: 'STRING', scope: 'FONT_FAMILY' },
  { field: 'fontStyle',     prop: 'style',  type: 'STRING', scope: 'FONT_STYLE' },
  { field: 'fontSize',      prop: 'size',   type: 'FLOAT',  scope: 'FONT_SIZE' },
  { field: 'lineHeight',    prop: 'lh',     type: 'FLOAT',  scope: 'LINE_HEIGHT' },
  { field: 'letterSpacing', prop: 'ls',     type: 'FLOAT',  scope: 'LETTER_SPACING' }
];

// The collection new variables belong in: whichever local collection already
// holds the most variables of this kind, else one named "Design Tokens", else
// a new one. A file with its own colour or type collection keeps using it.
async function getTokenCollection(create, kind) {
  var cols = await figma.variables.getLocalVariableCollectionsAsync();
  if (!cols.length) return create ? figma.variables.createVariableCollection(TOKEN_COLLECTION) : null;

  // The UI Kit's collections are mode-aware; the Colors and Typography tabs
  // write one mode only. Letting those tabs auto-pick a UI Kit collection
  // would quietly produce a token with a Desktop value and three empty
  // breakpoints, so they are never candidates here.
  var uiKitCollectionIds = {};
  for (var u = 0; u < cols.length; u++) {
    if (isUiKitCollectionName(cols[u].name)) uiKitCollectionIds[cols[u].id] = true;
  }

  var wantTypes = kind === 'text' ? ['FLOAT', 'STRING'] : ['COLOR'];
  var scopes = {};
  for (var f = 0; f < TEXT_VAR_FIELDS.length; f++) scopes[TEXT_VAR_FIELDS[f].scope] = true;

  var counts = {};
  for (var t = 0; t < wantTypes.length; t++) {
    var vars = await figma.variables.getLocalVariablesAsync(wantTypes[t]);
    for (var i = 0; i < vars.length; i++) {
      var v = vars[i];
      if (v.remote) continue;
      // For typography only count variables actually scoped to a type property,
      // so a spacing collection full of FLOATs isn't mistaken for a type one.
      if (kind === 'text' && !(v.scopes || []).some(function (sc) { return scopes[sc]; })) continue;
      if (uiKitCollectionIds[v.variableCollectionId]) continue;
      counts[v.variableCollectionId] = (counts[v.variableCollectionId] || 0) + 1;
    }
  }

  var best = null, bestN = 0;
  for (var c = 0; c < cols.length; c++) {
    var n = counts[cols[c].id] || 0;
    if (n > bestN) { bestN = n; best = cols[c]; }
  }
  if (best) return best;

  for (var k = 0; k < cols.length; k++) if (cols[k].name === TOKEN_COLLECTION) return cols[k];
  return create ? figma.variables.createVariableCollection(TOKEN_COLLECTION) : null;
}

// ── UI Kit: collections, breakpoints, config ───────────────────────────────
// Three tiers, each with its OWN mode budget — which is what makes
// breakpoints and theming possible at the same time, whatever the plan's
// per-collection ceiling turns out to be:
//
//   Primitives   1 mode                      raw values
//   Theme        Light / Dark                semantic colour, aliases Primitives
//   Responsive   Desktop / Tablet / Mobile…  semantic size, aliases Primitives
var UIKIT_PRIMITIVES = 'Primitives';
var UIKIT_THEME = 'Theme';
var UIKIT_RESPONSIVE = 'Responsive';
var UIKIT_COLLECTION_NAMES = [UIKIT_PRIMITIVES, UIKIT_THEME, UIKIT_RESPONSIVE];

function isUiKitCollectionName(name) {
  var n = String(name == null ? '' : name).trim().toLowerCase();
  for (var i = 0; i < UIKIT_COLLECTION_NAMES.length; i++) {
    if (n === UIKIT_COLLECTION_NAMES[i].toLowerCase()) return true;
  }
  return false;
}

// Design-canvas widths, widest first. A preset with more entries than the
// file's mode ceiling is not an error here — ensureModes reports the ceiling
// and the UI asks the designer to drop some.
var BREAKPOINT_PRESETS = {
  standard:  [{ name: 'Desktop', width: 1440 }, { name: 'Tablet Landscape', width: 1024 },
              { name: 'Tablet', width: 768 }, { name: 'Mobile', width: 375 }],
  tailwind:  [{ name: '2xl', width: 1536 }, { name: 'xl', width: 1280 },
              { name: 'lg', width: 1024 }, { name: 'md', width: 768 }, { name: 'sm', width: 640 }],
  bootstrap: [{ name: 'xxl', width: 1400 }, { name: 'xl', width: 1200 },
              { name: 'lg', width: 992 }, { name: 'md', width: 768 }, { name: 'sm', width: 576 }],
  material:  [{ name: 'Large', width: 1200 }, { name: 'Expanded', width: 840 },
              { name: 'Medium', width: 600 }, { name: 'Compact', width: 360 }],
  wordpress: [{ name: 'Huge', width: 1440 }, { name: 'Wide', width: 1280 },
              { name: 'Large', width: 960 }, { name: 'Medium', width: 782 },
              { name: 'Small', width: 600 }, { name: 'Mobile', width: 480 }]
};

var THEME_MODES = ['Light', 'Dark'];
var UIKIT_CONFIG_KEY = 'uikit.breakpoints';

// Breakpoint config lives on the document, not in the UI: ui.html has no
// persistence of any kind, and the config must outlive the plugin window.
// Mode ids are deliberately NOT stored — they are resolved by name on every
// run, so deleting and recreating a mode in Figma doesn't strand the config.
function readBreakpointConfig() {
  try {
    var raw = figma.root.getPluginData(UIKIT_CONFIG_KEY);
    if (!raw) return null;
    var cfg = JSON.parse(raw);
    if (!cfg || !cfg.breakpoints || !cfg.breakpoints.length) return null;
    return cfg;
  } catch (e) { return null; }
}

function writeBreakpointConfig(cfg) {
  figma.root.setPluginData(UIKIT_CONFIG_KEY, JSON.stringify(cfg));
}

function breakpointNames(cfg) {
  var out = [];
  if (!cfg || !cfg.breakpoints) return out;
  for (var i = 0; i < cfg.breakpoints.length; i++) out.push(cfg.breakpoints[i].name);
  return out;
}

// Resolve (and optionally create) the three UI Kit collections by name.
// Never renames or repurposes a collection the file already has.
async function getUiKitCollections(create) {
  var cols = await figma.variables.getLocalVariableCollectionsAsync();
  var out = { primitives: null, theme: null, responsive: null, created: [] };
  var want = [['primitives', UIKIT_PRIMITIVES], ['theme', UIKIT_THEME], ['responsive', UIKIT_RESPONSIVE]];

  for (var w = 0; w < want.length; w++) {
    var key = want[w][0], name = want[w][1];
    for (var c = 0; c < cols.length; c++) {
      if (String(cols[c].name).trim().toLowerCase() === name.toLowerCase()) { out[key] = cols[c]; break; }
    }
    if (!out[key] && create) {
      out[key] = figma.variables.createVariableCollection(name);
      out.created.push(name);
    }
  }
  return out;
}

// ── UI Kit: the scale table and what it generates ──────────────────────────
// A table row is one token:
//   { name, tier: 'primitive'|'responsive', scopes: [...], values: { <bpName>: n } }
// A primitive row carries a single value under the key VALUE_KEY, because a
// primitive doesn't vary by breakpoint — that is the whole point of the tier.
var UIKIT_VALUE_KEY = '*';

// Figma rejects a scope string it doesn't know, and the accepted set has
// grown over API versions. Assigning scopes is a nicety, never a reason to
// fail a generate, so every assignment is attempted and shrugged off.
function applyVarScopes(variable, scopes) {
  if (!scopes || !scopes.length) return;
  try { variable.scopes = scopes.slice(); } catch (e) { /* older API, or an unknown scope */ }
}

var SPACING_SCOPES = ['GAP', 'WIDTH_HEIGHT'];
var RADIUS_SCOPES = ['CORNER_RADIUS'];

// Ramps are defined as MULTIPLES of a base, not as fixed pixel values, so
// changing the base retunes the whole scale and keeps it on-grid. A ramp is
// breakpoint-invariant by definition, so it lives in Primitives.
var SPACING_PRESETS = {
  grid4: { label: '4pt grid', base: 4, steps: [['25', 0.5], ['50', 1], ['100', 2], ['150', 3],
            ['200', 4], ['250', 5], ['300', 6], ['400', 8], ['500', 10], ['600', 12],
            ['700', 16], ['800', 20], ['900', 24], ['950', 28]] },
  grid8: { label: '8pt grid', base: 8, steps: [['100', 1], ['200', 2], ['300', 3], ['400', 4],
            ['500', 5], ['600', 6], ['700', 8], ['800', 10], ['900', 12], ['1000', 16]] },
  tailwind: { label: 'Tailwind', base: 4, steps: [['1', 1], ['2', 2], ['3', 3], ['4', 4], ['5', 5],
            ['6', 6], ['8', 8], ['10', 10], ['12', 12], ['16', 16], ['20', 20], ['24', 24]] },
  tshirt: { label: 'T-shirt (xs–3xl)', base: 8, steps: [['xs', 0.5], ['sm', 1], ['md', 2],
            ['lg', 3], ['xl', 4], ['2xl', 6], ['3xl', 8]] }
};

var RADIUS_PRESETS = {
  subtle:  { label: 'Subtle', base: 2, steps: [['none', 0], ['sm', 1], ['md', 2], ['lg', 4], ['full', 499.5]] },
  rounded: { label: 'Rounded', base: 4, steps: [['none', 0], ['sm', 1], ['md', 2], ['lg', 4], ['full', 249.75]] },
  pill:    { label: 'Pill', base: 8, steps: [['none', 0], ['sm', 1], ['md', 2], ['lg', 3], ['full', 124.875]] }
};

function rampRows(prefix, preset, base, scopes) {
  var rows = [];
  if (!preset) return rows;
  var unit = (typeof base === 'number' && isFinite(base) && base > 0) ? base : preset.base;
  for (var i = 0; i < preset.steps.length; i++) {
    var vals = {};
    vals[UIKIT_VALUE_KEY] = Math.round(preset.steps[i][1] * unit * 100) / 100;
    rows.push({ name: prefix + '/' + preset.steps[i][0], tier: 'primitive', scopes: scopes, values: vals });
  }
  return rows;
}

function defaultPrimitiveRamp(opts) {
  opts = opts || {};
  var sp = SPACING_PRESETS[opts.spacing || 'grid4'] || SPACING_PRESETS.grid4;
  var rd = RADIUS_PRESETS[opts.radius || 'rounded'] || RADIUS_PRESETS.rounded;
  return rampRows('space', sp, opts.spacingBase, SPACING_SCOPES)
    .concat(rampRows('radius', rd, opts.radiusBase, RADIUS_SCOPES));
}

// The semantic tokens that genuinely differ per breakpoint. Seeded by
// scaling against the widest breakpoint, which gives a usable starting
// table on any preset — the designer then edits it.
function defaultResponsiveRows(cfg) {
  var bps = (cfg && cfg.breakpoints) ? cfg.breakpoints : [];
  if (!bps.length) return [];
  var widest = bps[0].width || 1440;

  function ramp(base, floor) {
    var out = {};
    for (var i = 0; i < bps.length; i++) {
      var f = (bps[i].width || widest) / widest;
      var v = Math.round((base * f) / 4) * 4;
      out[bps[i].name] = Math.max(floor, v);
    }
    return out;
  }

  var rows = [
    { name: 'space/section/sm', tier: 'responsive', scopes: SPACING_SCOPES, values: ramp(64, 32) },
    { name: 'space/section/md', tier: 'responsive', scopes: SPACING_SCOPES, values: ramp(96, 40) },
    { name: 'space/section/lg', tier: 'responsive', scopes: SPACING_SCOPES, values: ramp(120, 48) },
    { name: 'space/section/xl', tier: 'responsive', scopes: SPACING_SCOPES, values: ramp(180, 80) },
    { name: 'space/section/2xl', tier: 'responsive', scopes: SPACING_SCOPES, values: ramp(240, 96) },
    { name: 'space/gutter', tier: 'responsive', scopes: SPACING_SCOPES, values: ramp(32, 16) }
  ];

  var container = {};
  for (var c = 0; c < bps.length; c++) {
    container[bps[c].name] = Math.max(0, (bps[c].width || widest) - 2 * (ramp(32, 16)[bps[c].name] || 16));
  }
  rows.push({ name: 'container/max', tier: 'responsive', scopes: ['WIDTH_HEIGHT'], values: container });
  return rows;
}

// ── More token families ────────────────────────────────────────────────────
// Everything a layout actually reaches for, not just spacing. Each family is
// a pure function from its settings to table rows, so the wizard can preview
// a step before anything is written.

var TYPE_RATIOS = [
  { value: 1.125, label: '1.125 — Major Second' },
  { value: 1.2,   label: '1.200 — Minor Third' },
  { value: 1.25,  label: '1.250 — Major Third' },
  { value: 1.333, label: '1.333 — Perfect Fourth' },
  { value: 1.414, label: '1.414 — Augmented Fourth' },
  { value: 1.5,   label: '1.500 — Perfect Fifth' },
  { value: 1.618, label: '1.618 — Golden Ratio' }
];

var TYPE_STEPS = [
  ['display', 7], ['h1', 6], ['h2', 5], ['h3', 4], ['h4', 3], ['h5', 2], ['h6', 1],
  ['body-lg', 0.5], ['body', 0], ['body-sm', -0.5], ['caption', -1]
];

// A type scale that holds at every width. The ratio TIGHTENS as the canvas
// narrows — keeping the desktop ratio on a phone gives headings that eat the
// screen — and the base stays put so body copy never shrinks below comfort.
function typeScaleRows(cfg, opts) {
  opts = opts || {};
  var base = (typeof opts.typeBase === 'number' && opts.typeBase > 0) ? opts.typeBase : 16;
  var ratio = (typeof opts.typeRatio === 'number' && opts.typeRatio > 1) ? opts.typeRatio : 1.25;
  var bps = (cfg && cfg.breakpoints) ? cfg.breakpoints : [];
  if (!bps.length) return [];

  var widest = bps[0].width || 1440;
  var narrowest = bps[bps.length - 1].width || widest;
  var tightest = Math.max(1.1, ratio - 0.125);

  var rows = [];
  for (var i = 0; i < TYPE_STEPS.length; i++) {
    var name = TYPE_STEPS[i][0], step = TYPE_STEPS[i][1];
    var values = {};
    for (var b = 0; b < bps.length; b++) {
      var w = bps[b].width || widest;
      var t = (widest === narrowest) ? 0 : (widest - w) / (widest - narrowest);
      var r = ratio + (tightest - ratio) * Math.max(0, Math.min(1, t));
      values[bps[b].name] = Math.round(base * Math.pow(r, step));
    }
    rows.push({ name: 'text/size/' + name, tier: 'responsive', scopes: ['FONT_SIZE'], values: values });
  }
  return rows;
}

function lineHeightRows() {
  var steps = [['tight', 120], ['snug', 135], ['normal', 150], ['relaxed', 165], ['loose', 180]];
  var rows = [];
  for (var i = 0; i < steps.length; i++) {
    var v = {};
    v[UIKIT_VALUE_KEY] = steps[i][1];
    rows.push({ name: 'text/leading/' + steps[i][0], tier: 'primitive', scopes: ['LINE_HEIGHT'], values: v });
  }
  return rows;
}

function borderRows() {
  var steps = [['none', 0], ['thin', 1], ['medium', 2], ['thick', 4]];
  var rows = [];
  for (var i = 0; i < steps.length; i++) {
    var v = {};
    v[UIKIT_VALUE_KEY] = steps[i][1];
    rows.push({ name: 'border/' + steps[i][0], tier: 'primitive', scopes: ['STROKE_FLOAT'], values: v });
  }
  return rows;
}

function iconSizeRows() {
  var steps = [['xs', 12], ['sm', 16], ['md', 20], ['lg', 24], ['xl', 32], ['2xl', 48]];
  var rows = [];
  for (var i = 0; i < steps.length; i++) {
    var v = {};
    v[UIKIT_VALUE_KEY] = steps[i][1];
    rows.push({ name: 'icon/' + steps[i][0], tier: 'primitive', scopes: ['WIDTH_HEIGHT'], values: v });
  }
  return rows;
}

function opacityRows() {
  var steps = [['disabled', 0.4], ['muted', 0.6], ['subtle', 0.8], ['full', 1]];
  var rows = [];
  for (var i = 0; i < steps.length; i++) {
    var v = {};
    v[UIKIT_VALUE_KEY] = steps[i][1];
    rows.push({ name: 'opacity/' + steps[i][0], tier: 'primitive', scopes: ['OPACITY'], values: v });
  }
  return rows;
}

// The breakpoint widths themselves, so a container can be sized from a
// token instead of a number somebody remembered.
function breakpointWidthRows(cfg) {
  var bps = (cfg && cfg.breakpoints) ? cfg.breakpoints : [];
  var rows = [];
  for (var i = 0; i < bps.length; i++) {
    if (!bps[i].width) continue;
    var v = {};
    v[UIKIT_VALUE_KEY] = bps[i].width;
    rows.push({ name: 'breakpoint/' + slugToken(bps[i].name), tier: 'primitive',
                scopes: ['WIDTH_HEIGHT'], values: v });
  }
  return rows;
}

// ── Canvas, columns, gutter, margin ────────────────────────────────────────
// The layout grid is the one part of a design system that Figma stores
// OUTSIDE variables: a grid style has no modes, so a responsive grid is one
// style per breakpoint. The numbers behind it are still tokens, so a
// container can be built from them.

function defaultColumnsFor(width) {
  if (width >= 1200) return 12;
  if (width >= 900) return 12;
  if (width >= 700) return 8;
  if (width >= 480) return 6;
  return 4;
}
function defaultGutterFor(width) { return width >= 900 ? 24 : (width >= 600 ? 20 : 16); }
function defaultMarginFor(width) { return width >= 1200 ? 32 : (width >= 700 ? 24 : 16); }

// Fill in whatever the designer has not overridden.
function resolveGridSpec(cfg, grid) {
  grid = grid || {};
  var bps = (cfg && cfg.breakpoints) ? cfg.breakpoints : [];
  var out = { columns: {}, gutter: {}, margin: {} };
  for (var i = 0; i < bps.length; i++) {
    var n = bps[i].name, w = bps[i].width || 1440;
    out.columns[n] = (grid.columns && typeof grid.columns[n] === 'number') ? grid.columns[n] : defaultColumnsFor(w);
    out.gutter[n] = (grid.gutter && typeof grid.gutter[n] === 'number') ? grid.gutter[n] : defaultGutterFor(w);
    out.margin[n] = (grid.margin && typeof grid.margin[n] === 'number') ? grid.margin[n] : defaultMarginFor(w);
  }
  return out;
}

function gridRows(cfg, opts) {
  opts = opts || {};
  var bps = (cfg && cfg.breakpoints) ? cfg.breakpoints : [];
  if (!bps.length) return [];
  var g = resolveGridSpec(cfg, opts.grid);

  var cols = {}, gut = {}, mar = {}, canvas = {}, content = {};
  for (var i = 0; i < bps.length; i++) {
    var n = bps[i].name, w = bps[i].width || 1440;
    cols[n] = g.columns[n];
    gut[n] = g.gutter[n];
    mar[n] = g.margin[n];
    canvas[n] = w;
    content[n] = Math.max(0, w - 2 * g.margin[n]);
  }
  return [
    { name: 'grid/columns', tier: 'responsive', scopes: [], values: cols },
    { name: 'grid/gutter', tier: 'responsive', scopes: ['GAP'], values: gut },
    { name: 'grid/margin', tier: 'responsive', scopes: ['GAP'], values: mar },
    { name: 'canvas/width', tier: 'responsive', scopes: ['WIDTH_HEIGHT'], values: canvas },
    { name: 'canvas/content', tier: 'responsive', scopes: ['WIDTH_HEIGHT'], values: content }
  ];
}

// One grid style per breakpoint, because a grid style cannot carry modes.
async function createGridStyles(cfg, opts) {
  opts = opts || {};
  var out = { created: 0, reused: 0, reasons: [] };
  var bps = (cfg && cfg.breakpoints) ? cfg.breakpoints : [];
  if (!bps.length) return out;
  var g = resolveGridSpec(cfg, opts.grid);

  var existing = {};
  try {
    var all = await figma.getLocalGridStylesAsync();
    for (var i = 0; i < all.length; i++) existing[all[i].name] = all[i];
  } catch (e) {
    out.reasons.push('This Figma build does not expose grid styles, so the grid was written as tokens only.');
    return out;
  }

  for (var b = 0; b < bps.length; b++) {
    var name = 'Grid / ' + bps[b].name;
    var style = existing[name];
    if (style) { out.reused++; } else {
      try { style = figma.createGridStyle(); style.name = name; out.created++; }
      catch (e2) { out.reasons.push('Could not create "' + name + '".'); continue; }
    }
    try {
      style.layoutGrids = [{
        pattern: 'COLUMNS', alignment: 'STRETCH', visible: true,
        count: g.columns[bps[b].name],
        gutterSize: g.gutter[bps[b].name],
        offset: g.margin[bps[b].name],
        color: { r: 1, g: 0, b: 0, a: 0.08 }
      }];
    } catch (e3) { out.reasons.push('"' + name + '" was created but Figma refused the column settings.'); }
  }
  return out;
}

// ── Colour, as a tier rather than a list ───────────────────────────────────
// Primitives hold the ramps. Theme holds the names a designer actually
// reaches for, each ALIASING a ramp step — and aliasing differently per
// mode, which is what makes a dark theme one edit instead of a repaint.

function mixTo(rgb, target, t) {
  return {
    r: rgb.r + (target - rgb.r) * t,
    g: rgb.g + (target - rgb.g) * t,
    b: rgb.b + (target - rgb.b) * t
  };
}

var COLOR_RAMP_STEPS = [
  [50, 0.95], [100, 0.88], [200, 0.74], [300, 0.56], [400, 0.3],
  [500, 0], [600, -0.14], [700, -0.3], [800, -0.46], [900, -0.62]
];

function colorRampRows(prefix, hex) {
  var base = hexToRgb01(hex);
  if (!base) return [];
  var rows = [];
  for (var i = 0; i < COLOR_RAMP_STEPS.length; i++) {
    var step = COLOR_RAMP_STEPS[i][0], t = COLOR_RAMP_STEPS[i][1];
    var rgb = t >= 0 ? mixTo(base, 1, t) : mixTo(base, 0, -t);
    var v = {};
    v[UIKIT_VALUE_KEY] = { r: rgb.r, g: rgb.g, b: rgb.b, a: 1 };
    rows.push({ name: prefix + '/' + step, tier: 'primitive', type: 'COLOR', scopes: [], values: v });
  }
  return rows;
}

// Semantic names, aliased per theme mode.
var THEME_SEMANTICS = [
  ['color/bg/canvas',      'neutral/50',  'neutral/900'],
  ['color/bg/surface',     'neutral/50',  'neutral/800'],
  ['color/bg/raised',      'neutral/100', 'neutral/700'],
  ['color/bg/brand',       'brand/500',   'brand/400'],
  ['color/bg/brand-subtle','brand/50',    'brand/900'],
  ['color/border/default', 'neutral/200', 'neutral/700'],
  ['color/border/strong',  'neutral/300', 'neutral/600'],
  ['color/text/primary',   'neutral/900', 'neutral/50'],
  ['color/text/secondary', 'neutral/600', 'neutral/300'],
  ['color/text/disabled',  'neutral/400', 'neutral/500'],
  ['color/text/inverse',   'neutral/50',  'neutral/900'],
  ['color/text/brand',     'brand/600',   'brand/300'],
  ['color/feedback/success', 'success/600', 'success/400'],
  ['color/feedback/warning', 'warning/600', 'warning/400'],
  ['color/feedback/danger',  'danger/600',  'danger/400']
];

function colorSystemRows(opts) {
  opts = opts || {};
  var brand = opts.brandHex || '#2563EB';
  var neutral = opts.neutralHex || '#6B7280';
  var rows = colorRampRows('brand', brand)
    .concat(colorRampRows('neutral', neutral))
    .concat(colorRampRows('success', opts.successHex || '#16A34A'))
    .concat(colorRampRows('warning', opts.warningHex || '#D97706'))
    .concat(colorRampRows('danger', opts.dangerHex || '#DC2626'));

  if (opts.theme === false) return rows;
  for (var i = 0; i < THEME_SEMANTICS.length; i++) {
    var sem = THEME_SEMANTICS[i];
    rows.push({ name: sem[0], tier: 'theme', type: 'COLOR', scopes: [],
                refs: { Light: sem[1], Dark: sem[2] } });
  }
  return rows;
}

function defaultScaleTable(cfg, opts) {
  opts = opts || {};
  var rows = defaultPrimitiveRamp(opts).concat(defaultResponsiveRows(cfg));
  if (opts.typography !== false) rows = rows.concat(typeScaleRows(cfg, opts)).concat(lineHeightRows());
  if (opts.borders !== false) rows = rows.concat(borderRows());
  if (opts.icons !== false) rows = rows.concat(iconSizeRows());
  if (opts.opacity !== false) rows = rows.concat(opacityRows());
  if (opts.breakpointWidths !== false) rows = rows.concat(breakpointWidthRows(cfg));
  if (opts.colors !== false) rows = rows.concat(colorSystemRows(opts));
  if (opts.grid !== false) rows = rows.concat(gridRows(cfg, opts));
  return rows;
}

// Index local variables of a collection by name, so a re-run reuses rather
// than duplicating. Matching is by exact name: that is the contract the
// Colors and Typography tabs already use for idempotency.
async function variablesByNameIn(collection) {
  var map = {};
  if (!collection) return map;
  var vars = await figma.variables.getLocalVariablesAsync();
  for (var i = 0; i < vars.length; i++) {
    if (vars[i].remote) continue;
    if (vars[i].variableCollectionId !== collection.id) continue;
    if (!map[vars[i].name]) map[vars[i].name] = vars[i];
  }
  return map;
}

// Generate the table into the two collections.
//
// Responsive values alias a Primitive whenever one holds exactly that
// number — that is what makes the tiers worth having, because retuning the
// ramp then moves every semantic token with it. Where no primitive matches,
// the raw number is written and the row is reported under `raw`.
async function generateScaleVariables(cfg, table) {
  var result = { created: 0, reused: 0, aliased: 0, raw: 0, skipped: 0, reasons: [], modes: null, unit: 'token' };
  var names = breakpointNames(cfg);
  if (!names.length) { result.reasons.push('No breakpoints are configured.'); return result; }
  if (!table || !table.length) { result.reasons.push('The scale table is empty.'); return result; }

  var cols = await getUiKitCollections(true);
  var modes = await ensureModes(cols.responsive, names);
  result.modes = modes;

  var wantsTheme = false;
  for (var w = 0; w < table.length; w++) if (table[w].tier === 'theme') { wantsTheme = true; break; }
  var themeModes = wantsTheme ? await ensureModes(cols.theme, THEME_MODES) : null;
  result.themeModes = themeModes;
  if (themeModes && themeModes.capHit) {
    result.reasons.push('This file will not take two modes on the Theme collection, so the light/dark names were skipped. Everything else was written.');
  }

  if (modes.capHit) {
    result.reasons.push('This file allows ' + modes.cap + ' modes per collection, but ' + names.length +
      ' breakpoints were asked for. Nothing was changed. Remove ' + (names.length - modes.cap) + ' breakpoint(s) and run again.');
    return result;
  }

  var primMap = await variablesByNameIn(cols.primitives);
  var respMap = await variablesByNameIn(cols.responsive);
  var primValue = {};   // number -> primitive variable, for aliasing

  // Primitives first, so the responsive pass can alias them.
  for (var i = 0; i < table.length; i++) {
    var row = table[i];
    if (row.tier !== 'primitive') continue;
    var n = row.values ? row.values[UIKIT_VALUE_KEY] : null;
    // A colour primitive holds an RGBA object, not a number, so validate by
    // the row's type rather than assuming everything on this tier is FLOAT.
    var isColorRow = (row.type || 'FLOAT') === 'COLOR';
    var usable = isColorRow ? !!(n && typeof n.r === 'number') : (typeof n === 'number' && isFinite(n));
    if (!usable) { result.skipped++; result.reasons.push(row.name + ': no value.'); continue; }
    var pv = primMap[row.name];
    if (pv) { result.reused++; } else {
      pv = figma.variables.createVariable(row.name, cols.primitives, row.type || 'FLOAT');
      primMap[row.name] = pv;
      result.created++;
    }
    applyVarScopes(pv, row.scopes);
    await setVarValue(pv, cols.primitives, n);
    if (typeof n === 'number' && primValue[n] === undefined) primValue[n] = pv;
  }

  // Theme tier: semantic names that alias a primitive, differently per mode.
  if (themeModes && !themeModes.capHit) {
    var themeMap = await variablesByNameIn(cols.theme);
    for (var t2 = 0; t2 < table.length; t2++) {
      var trow = table[t2];
      if (trow.tier !== 'theme') continue;
      var tv = themeMap[trow.name];
      if (tv) { result.reused++; } else {
        tv = figma.variables.createVariable(trow.name, cols.theme, trow.type || 'COLOR');
        themeMap[trow.name] = tv;
        result.created++;
      }
      applyVarScopes(tv, trow.scopes);
      var wroteTheme = 0;
      for (var tm = 0; tm < THEME_MODES.length; tm++) {
        var modeName = THEME_MODES[tm];
        var refName = trow.refs ? trow.refs[modeName] : null;
        var modeId2 = themeModes.nameToModeId[modeName];
        if (!refName || !modeId2) continue;
        var target2 = primMap[refName];
        if (!target2) { result.reasons.push(trow.name + ': no primitive named "' + refName + '" to point at.'); continue; }
        await setVarValue(tv, cols.theme, figma.variables.createVariableAlias(target2), modeId2);
        result.aliased++;
        wroteTheme++;
      }
      if (!wroteTheme) { result.skipped++; result.reasons.push(trow.name + ': nothing to alias.'); }
    }
  }

  // Responsive last.
  for (var r = 0; r < table.length; r++) {
    var rrow = table[r];
    if (rrow.tier === 'primitive' || rrow.tier === 'theme') continue;
    var rv = respMap[rrow.name];
    if (rv) { result.reused++; } else {
      rv = figma.variables.createVariable(rrow.name, cols.responsive, rrow.type || 'FLOAT');
      respMap[rrow.name] = rv;
      result.created++;
    }
    applyVarScopes(rv, rrow.scopes);

    var wrote = 0;
    for (var m = 0; m < names.length; m++) {
      var bp = names[m];
      var val = rrow.values ? rrow.values[bp] : null;
      if (typeof val !== 'number' || !isFinite(val)) continue;
      var modeId = modes.nameToModeId[bp];
      if (!modeId) continue;
      var target = primValue[val];
      if (target && target.id !== rv.id) {
        await setVarValue(rv, cols.responsive, figma.variables.createVariableAlias(target), modeId);
        result.aliased++;
      } else {
        await setVarValue(rv, cols.responsive, val, modeId);
        result.raw++;
      }
      wrote++;
    }
    if (!wrote) { result.skipped++; result.reasons.push(rrow.name + ': no value at any breakpoint.'); }
  }

  return result;
}

// ── UI Kit: binding layers to the scale ────────────────────────────────────
// Only these fields. layoutMode, layoutSizingHorizontal, layoutWrap and
// visible are enums and booleans — Figma cannot bind a variable to any of
// them, which is exactly why responsive LAYOUT needs a rule engine and
// cannot come from tokens.
var BINDABLE_SPACING = [
  { field: 'paddingLeft', scope: 'GAP' },
  { field: 'paddingRight', scope: 'GAP' },
  { field: 'paddingTop', scope: 'GAP' },
  { field: 'paddingBottom', scope: 'GAP' },
  { field: 'itemSpacing', scope: 'GAP' },
  { field: 'counterAxisSpacing', scope: 'GAP' },
  { field: 'cornerRadius', scope: 'CORNER_RADIUS' }
];

// Which mode of a collection this node currently renders in: an explicit
// override if it has one, otherwise whatever it inherits, otherwise the
// collection default. resolvedVariableModes is the real API's answer and is
// preferred when present.
function nodeModeFor(node, collection) {
  if (!node || !collection) return null;
  try {
    var resolved = node.resolvedVariableModes;
    if (resolved && resolved[collection.id]) return resolved[collection.id];
  } catch (e) { /* not every node type exposes it */ }
  if (node.explicitModes && node.explicitModes[collection.id]) return node.explicitModes[collection.id];
  return modeOf(collection);
}

// Candidate tokens for binding, semantic tier first.
//
// Order matters: a value of 64 may exist as both space/700 (a primitive)
// and space/section/sm (semantic). Binding to the semantic one is the
// whole point — it is the token that changes per breakpoint, and the one a
// designer is meant to reason about.
async function spacingCandidates(cols) {
  var all = await localVariablesAllModes('FLOAT');
  var responsive = [], primitives = [];
  for (var i = 0; i < all.length; i++) {
    var e = all[i];
    if (cols.responsive && e.variable.variableCollectionId === cols.responsive.id) responsive.push(e);
    else if (cols.primitives && e.variable.variableCollectionId === cols.primitives.id) primitives.push(e);
  }
  return responsive.concat(primitives);
}

async function bindScaleToSelection(opts) {
  opts = opts || {};
  var result = { bound: 0, layers: 0, skipped: 0, alreadyBound: 0, reasons: [], unit: 'binding' };
  var sel = figma.currentPage.selection;
  if (!sel || !sel.length) { result.reasons.push('Select a frame first.'); return result; }

  var cols = await getUiKitCollections(false);
  if (!cols.responsive && !cols.primitives) {
    result.reasons.push('No UI Kit collections yet — generate the scale first.');
    return result;
  }
  var candidates = await spacingCandidates(cols);
  if (!candidates.length) { result.reasons.push('No scale tokens to bind to.'); return result; }

  var nodes = styleScanNodes(sel);
  var seenReason = {};
  function note(msg) { if (!seenReason[msg]) { seenReason[msg] = true; result.reasons.push(msg); } }

  for (var n = 0; n < nodes.length; n++) {
    var node = nodes[n];
    if (!isAutoLayoutFrame(node)) continue;

    var blocked = styleBlockedReason(node);
    if (blocked) { result.skipped++; note(blocked); continue; }

    result.layers++;
    for (var f = 0; f < BINDABLE_SPACING.length; f++) {
      var field = BINDABLE_SPACING[f].field, scope = BINDABLE_SPACING[f].scope;
      var cur = node[field];
      if (typeof cur !== 'number' || !isFinite(cur)) continue;   // figma.mixed, or absent
      if (node.boundVariables && node.boundVariables[field]) { result.alreadyBound++; continue; }

      var match = null;
      for (var c = 0; c < candidates.length; c++) {
        var cand = candidates[c];
        if (!hasScope(cand.variable, scope)) continue;
        var col = cand.collection;
        var modeId = nodeModeFor(node, col);
        var val = (modeId && cand.resolved[modeId] !== undefined) ? cand.resolved[modeId] : null;
        if (typeof val === 'number' && val === cur) { match = cand.variable; break; }
      }
      if (!match) continue;

      try {
        node.setBoundVariable(field, match);
        result.bound++;
      } catch (e) {
        result.skipped++;
        note('Figma refused to bind ' + field + ' on "' + node.name + '".');
      }
    }
  }

  if (!result.layers) note('Nothing in the selection uses auto layout, so there is no padding or gap to bind.');
  return result;
}

// Render the selection at a breakpoint by overriding its mode. Everything
// bound to a Responsive token moves at once; everything else does not,
// which is itself the most useful thing this shows.
async function previewBreakpoint(bpName) {
  var result = { applied: 0, reasons: [], unit: 'frame' };
  var sel = figma.currentPage.selection;
  if (!sel || !sel.length) { result.reasons.push('Select a frame first.'); return result; }

  var cols = await getUiKitCollections(false);
  if (!cols.responsive) { result.reasons.push('No Responsive collection yet — generate the scale first.'); return result; }

  var modeId = null;
  var modes = cols.responsive.modes || [];
  for (var i = 0; i < modes.length; i++) {
    if (normModeName(modes[i].name) === normModeName(bpName)) { modeId = modes[i].modeId; break; }
  }
  if (!modeId) { result.reasons.push('"' + bpName + '" is not a mode on the Responsive collection.'); return result; }

  for (var s2 = 0; s2 < sel.length; s2++) {
    try {
      sel[s2].setExplicitVariableModeForCollection(cols.responsive, modeId);
      result.applied++;
    } catch (e) {
      result.reasons.push('"' + sel[s2].name + '" cannot carry a mode override.');
    }
  }
  return result;
}

// ── UI Kit: the elements ───────────────────────────────────────────────────
// Real components, with real variant properties, built from the tokens —
// not pictures of components. Everything here is created through the same
// token layer the rest of the tab writes, so the kit is on-system the
// moment it exists rather than needing a later clean-up pass.

var KIT_COLORS = [
  ['color/brand/default',   { r: 0.145, g: 0.388, b: 0.922 }],
  ['color/brand/hover',     { r: 0.114, g: 0.306, b: 0.847 }],
  ['color/brand/subtle',    { r: 0.937, g: 0.965, b: 1.000 }],
  ['color/surface',         { r: 1.000, g: 1.000, b: 1.000 }],
  ['color/surface/raised',  { r: 0.976, g: 0.980, b: 0.984 }],
  ['color/surface/sunken',  { r: 0.953, g: 0.957, b: 0.965 }],
  ['color/border',          { r: 0.898, g: 0.906, b: 0.922 }],
  ['color/border/strong',   { r: 0.820, g: 0.835, b: 0.859 }],
  ['color/text/primary',    { r: 0.067, g: 0.094, b: 0.153 }],
  ['color/text/secondary',  { r: 0.420, g: 0.447, b: 0.502 }],
  ['color/text/disabled',   { r: 0.612, g: 0.639, b: 0.686 }],
  ['color/text/inverse',    { r: 1.000, g: 1.000, b: 1.000 }],
  ['color/success',         { r: 0.086, g: 0.639, b: 0.290 }],
  ['color/warning',         { r: 0.851, g: 0.467, b: 0.024 }],
  ['color/danger',          { r: 0.863, g: 0.149, b: 0.149 }]
];

// Inter is Figma's default, but it is not guaranteed to be installed — and
// a missing font is a hard failure on every text node, so fall back to
// whatever the machine actually has rather than throwing.
async function resolveKitFonts() {
  var tryFamily = async function (family, styles) {
    var out = {};
    for (var k in styles) {
      await figma.loadFontAsync({ family: family, style: styles[k] });
      out[k] = { family: family, style: styles[k] };
    }
    return out;
  };
  try {
    return await tryFamily('Inter', { regular: 'Regular', medium: 'Medium', bold: 'Semi Bold' });
  } catch (e) { /* not installed, or no such weight */ }
  try {
    return await tryFamily('Inter', { regular: 'Regular', medium: 'Regular', bold: 'Bold' });
  } catch (e) { /* still no */ }

  var all = await figma.listAvailableFontsAsync();
  var byFamily = {};
  for (var i = 0; i < all.length; i++) {
    var f = all[i].fontName;
    if (!byFamily[f.family]) byFamily[f.family] = [];
    byFamily[f.family].push(f.style);
  }
  for (var fam in byFamily) {
    if (byFamily[fam].indexOf('Regular') === -1) continue;
    var bold = byFamily[fam].indexOf('Bold') !== -1 ? 'Bold' : 'Regular';
    var med = byFamily[fam].indexOf('Medium') !== -1 ? 'Medium' : 'Regular';
    try { return await tryFamily(fam, { regular: 'Regular', medium: med, bold: bold }); }
    catch (e) { /* try the next family */ }
  }
  throw new Error('No usable font is installed, so the elements cannot be drawn.');
}

function kitSolid(rgb) {
  return { type: 'SOLID', color: { r: rgb.r, g: rgb.g, b: rgb.b }, opacity: 1 };
}

// Create the kit's colour tokens in Primitives, reusing by name.
async function ensureKitColorVariables(cols) {
  var map = {};
  if (!cols.primitives) return map;
  var existing = await variablesByNameIn(cols.primitives);
  for (var i = 0; i < KIT_COLORS.length; i++) {
    var name = KIT_COLORS[i][0], rgb = KIT_COLORS[i][1];
    var v = existing[name];
    if (!v) {
      v = figma.variables.createVariable(name, cols.primitives, 'COLOR');
      // The variable carries the alpha; Figma overwrites a bound paint's
      // opacity with it, so never multiply the two.
      await setVarValue(v, cols.primitives, { r: rgb.r, g: rgb.g, b: rgb.b, a: 1 });
    }
    map[name] = v;
  }
  return map;
}

function paintFor(colorMap, name, rgb) {
  var paint = kitSolid(rgb);
  var v = colorMap[name];
  if (v) {
    try { paint = figma.variables.setBoundVariableForPaint(paint, 'color', v); }
    catch (e) { /* unbound paint still renders correctly */ }
  }
  return paint;
}

function rgbNamed(name) {
  for (var i = 0; i < KIT_COLORS.length; i++) if (KIT_COLORS[i][0] === name) return KIT_COLORS[i][1];
  return { r: 0, g: 0, b: 0 };
}

function kitFill(node, colorMap, name) {
  try { node.fills = [paintFor(colorMap, name, rgbNamed(name))]; } catch (e) { /* no fills */ }
}
function kitStroke(node, colorMap, name, weight) {
  try {
    node.strokes = [paintFor(colorMap, name, rgbNamed(name))];
    node.strokeWeight = weight || 1;
  } catch (e) { /* no strokes */ }
}

function kitRow(name, o) {
  o = o || {};
  var f = figma.createFrame();
  f.name = name;
  f.layoutMode = o.vertical ? 'VERTICAL' : 'HORIZONTAL';
  f.primaryAxisSizingMode = 'AUTO';
  f.counterAxisSizingMode = 'AUTO';
  f.counterAxisAlignItems = o.align || 'CENTER';
  f.itemSpacing = o.gap === undefined ? 8 : o.gap;
  f.paddingLeft = o.px === undefined ? 0 : o.px;
  f.paddingRight = o.px === undefined ? 0 : o.px;
  f.paddingTop = o.py === undefined ? 0 : o.py;
  f.paddingBottom = o.py === undefined ? 0 : o.py;
  if (o.radius !== undefined) f.cornerRadius = o.radius;
  f.fills = [];
  return f;
}

function kitText(chars, font, size, colorMap, colorName) {
  var t = figma.createText();
  t.fontName = font;
  t.fontSize = size;
  t.characters = chars;
  t.textAutoResize = 'WIDTH_AND_HEIGHT';
  kitFill(t, colorMap, colorName);
  return t;
}

// Bind a numeric field to a token when one holds exactly that value, so the
// kit is wired to the scale from birth instead of needing a Bind pass.
function bindNumber(node, field, tokenIndex, value) {
  var v = tokenIndex[value];
  if (!v) return false;
  try { node.setBoundVariable(field, v); return true; } catch (e) { return false; }
}

async function numericTokenIndex(cols) {
  var index = {};
  var all = await localVariablesAllModes('FLOAT');
  for (var i = 0; i < all.length; i++) {
    var e = all[i];
    var inKit = (cols.primitives && e.variable.variableCollectionId === cols.primitives.id);
    if (!inKit) continue;
    var val = e.resolved[modeOf(e.collection)];
    if (typeof val === 'number' && index[val] === undefined) index[val] = e.variable;
  }
  return index;
}

// ── The elements themselves ────────────────────────────────────────────────

function makeButton(ctx, variant, state) {
  var bg = variant === 'Primary' ? 'color/brand/default'
         : variant === 'Secondary' ? 'color/surface' : 'color/surface';
  var fg = variant === 'Primary' ? 'color/text/inverse' : 'color/text/primary';
  if (state === 'Hover' && variant === 'Primary') bg = 'color/brand/hover';
  if (state === 'Hover' && variant !== 'Primary') bg = 'color/surface/raised';
  if (state === 'Disabled') { bg = 'color/surface/sunken'; fg = 'color/text/disabled'; }

  var c = figma.createComponent();
  c.name = 'Variant=' + variant + ', State=' + state;
  c.layoutMode = 'HORIZONTAL';
  c.primaryAxisSizingMode = 'AUTO';
  c.counterAxisSizingMode = 'AUTO';
  c.counterAxisAlignItems = 'CENTER';
  c.itemSpacing = 8;
  c.paddingLeft = 24; c.paddingRight = 24; c.paddingTop = 12; c.paddingBottom = 12;
  c.cornerRadius = 8;
  kitFill(c, ctx.colors, bg);
  if (variant !== 'Primary') kitStroke(c, ctx.colors, state === 'Disabled' ? 'color/border' : 'color/border/strong', 1);
  if (variant === 'Tertiary') { c.fills = []; c.strokes = []; }

  bindNumber(c, 'paddingLeft', ctx.nums, 24);
  bindNumber(c, 'paddingRight', ctx.nums, 24);
  bindNumber(c, 'paddingTop', ctx.nums, 12);
  bindNumber(c, 'paddingBottom', ctx.nums, 12);
  bindNumber(c, 'itemSpacing', ctx.nums, 8);
  bindNumber(c, 'cornerRadius', ctx.nums, 8);

  c.appendChild(kitText('Button', ctx.fonts.medium, 14, ctx.colors, fg));
  return c;
}

function makeInput(ctx, state) {
  var border = state === 'Focus' ? 'color/brand/default'
             : state === 'Error' ? 'color/danger' : 'color/border/strong';
  var fg = state === 'Filled' ? 'color/text/primary' : 'color/text/secondary';
  var bg = state === 'Disabled' ? 'color/surface/sunken' : 'color/surface';

  var c = figma.createComponent();
  c.name = 'State=' + state;
  c.layoutMode = 'HORIZONTAL';
  c.primaryAxisSizingMode = 'FIXED';
  c.counterAxisSizingMode = 'AUTO';
  c.counterAxisAlignItems = 'CENTER';
  c.resize(280, 40);
  c.paddingLeft = 12; c.paddingRight = 12; c.paddingTop = 12; c.paddingBottom = 12;
  c.cornerRadius = 8;
  kitFill(c, ctx.colors, bg);
  kitStroke(c, ctx.colors, border, state === 'Focus' ? 2 : 1);
  bindNumber(c, 'paddingLeft', ctx.nums, 12);
  bindNumber(c, 'paddingRight', ctx.nums, 12);
  bindNumber(c, 'cornerRadius', ctx.nums, 8);
  c.appendChild(kitText(state === 'Filled' ? 'hello@example.com' : 'Placeholder', ctx.fonts.regular, 14, ctx.colors, fg));
  return c;
}

function makeToggleish(ctx, kind, state) {
  var c = figma.createComponent();
  c.name = 'State=' + state;
  c.layoutMode = 'HORIZONTAL';
  c.primaryAxisSizingMode = 'AUTO';
  c.counterAxisSizingMode = 'AUTO';
  c.counterAxisAlignItems = 'CENTER';
  c.itemSpacing = 8;
  c.fills = [];
  bindNumber(c, 'itemSpacing', ctx.nums, 8);

  var box = figma.createFrame();
  box.name = 'Box';
  box.resize(kind === 'Switch' ? 36 : 18, kind === 'Switch' ? 20 : 18);
  box.cornerRadius = kind === 'Radio' ? 9 : (kind === 'Switch' ? 10 : 4);
  var on = state === 'Checked' || state === 'On';
  kitFill(box, ctx.colors, on ? 'color/brand/default' : 'color/surface');
  if (!on) kitStroke(box, ctx.colors, 'color/border/strong', 1);
  c.appendChild(box);
  c.appendChild(kitText(kind, ctx.fonts.regular, 14, ctx.colors, 'color/text/primary'));
  return c;
}

function makeBadge(ctx, tone) {
  var map = { Neutral: 'color/text/secondary', Brand: 'color/brand/default',
              Success: 'color/success', Warning: 'color/warning', Danger: 'color/danger' };
  var c = figma.createComponent();
  c.name = 'Tone=' + tone;
  c.layoutMode = 'HORIZONTAL';
  c.primaryAxisSizingMode = 'AUTO';
  c.counterAxisSizingMode = 'AUTO';
  c.counterAxisAlignItems = 'CENTER';
  c.paddingLeft = 8; c.paddingRight = 8; c.paddingTop = 4; c.paddingBottom = 4;
  c.cornerRadius = 999;
  kitFill(c, ctx.colors, 'color/surface/raised');
  kitStroke(c, ctx.colors, 'color/border', 1);
  bindNumber(c, 'paddingLeft', ctx.nums, 8);
  bindNumber(c, 'paddingRight', ctx.nums, 8);
  bindNumber(c, 'paddingTop', ctx.nums, 4);
  bindNumber(c, 'paddingBottom', ctx.nums, 4);
  c.appendChild(kitText(tone, ctx.fonts.medium, 12, ctx.colors, map[tone] || 'color/text/secondary'));
  return c;
}

function makeCard(ctx) {
  var c = figma.createComponent();
  c.name = 'Card';
  c.layoutMode = 'VERTICAL';
  c.primaryAxisSizingMode = 'AUTO';
  c.counterAxisSizingMode = 'FIXED';
  c.resize(320, 200);
  c.itemSpacing = 12;
  c.paddingLeft = 24; c.paddingRight = 24; c.paddingTop = 24; c.paddingBottom = 24;
  c.cornerRadius = 16;
  kitFill(c, ctx.colors, 'color/surface');
  kitStroke(c, ctx.colors, 'color/border', 1);
  bindNumber(c, 'paddingLeft', ctx.nums, 24);
  bindNumber(c, 'paddingRight', ctx.nums, 24);
  bindNumber(c, 'paddingTop', ctx.nums, 24);
  bindNumber(c, 'paddingBottom', ctx.nums, 24);
  bindNumber(c, 'itemSpacing', ctx.nums, 12);
  bindNumber(c, 'cornerRadius', ctx.nums, 16);
  c.appendChild(kitText('Card title', ctx.fonts.bold, 18, ctx.colors, 'color/text/primary'));
  c.appendChild(kitText('Supporting copy that explains what this card is for.',
    ctx.fonts.regular, 14, ctx.colors, 'color/text/secondary'));
  return c;
}

function makeAlert(ctx, tone) {
  var accent = tone === 'Success' ? 'color/success' : tone === 'Warning' ? 'color/warning'
             : tone === 'Danger' ? 'color/danger' : 'color/brand/default';
  var c = figma.createComponent();
  c.name = 'Tone=' + tone;
  c.layoutMode = 'HORIZONTAL';
  c.primaryAxisSizingMode = 'FIXED';
  c.counterAxisSizingMode = 'AUTO';
  c.counterAxisAlignItems = 'MIN';
  c.resize(420, 56);
  c.itemSpacing = 12;
  c.paddingLeft = 16; c.paddingRight = 16; c.paddingTop = 12; c.paddingBottom = 12;
  c.cornerRadius = 8;
  kitFill(c, ctx.colors, 'color/surface/raised');
  kitStroke(c, ctx.colors, accent, 1);
  bindNumber(c, 'paddingLeft', ctx.nums, 16);
  bindNumber(c, 'itemSpacing', ctx.nums, 12);
  bindNumber(c, 'cornerRadius', ctx.nums, 8);
  var dot = figma.createFrame();
  dot.name = 'Icon'; dot.resize(16, 16); dot.cornerRadius = 8;
  kitFill(dot, ctx.colors, accent);
  c.appendChild(dot);
  c.appendChild(kitText(tone + ' message', ctx.fonts.medium, 14, ctx.colors, 'color/text/primary'));
  return c;
}

function makeAvatar(ctx, size) {
  var c = figma.createComponent();
  c.name = 'Size=' + size;
  var px = size === 'sm' ? 24 : size === 'md' ? 32 : 48;
  c.layoutMode = 'HORIZONTAL';
  c.primaryAxisSizingMode = 'FIXED';
  c.counterAxisSizingMode = 'FIXED';
  c.primaryAxisAlignItems = 'CENTER';
  c.counterAxisAlignItems = 'CENTER';
  c.resize(px, px);
  c.cornerRadius = px / 2;
  kitFill(c, ctx.colors, 'color/brand/subtle');
  c.appendChild(kitText('AB', ctx.fonts.medium, px / 2.6, ctx.colors, 'color/brand/default'));
  return c;
}

function makeNavLink(ctx, state) {
  var c = figma.createComponent();
  c.name = 'State=' + state;
  c.layoutMode = 'HORIZONTAL';
  c.primaryAxisSizingMode = 'AUTO';
  c.counterAxisSizingMode = 'AUTO';
  c.counterAxisAlignItems = 'CENTER';
  c.paddingLeft = 12; c.paddingRight = 12; c.paddingTop = 8; c.paddingBottom = 8;
  c.cornerRadius = 8;
  if (state === 'Active') kitFill(c, ctx.colors, 'color/brand/subtle'); else c.fills = [];
  bindNumber(c, 'paddingLeft', ctx.nums, 12);
  bindNumber(c, 'paddingTop', ctx.nums, 8);
  c.appendChild(kitText('Nav link', ctx.fonts.medium, 14, ctx.colors,
    state === 'Active' ? 'color/brand/default' : 'color/text/secondary'));
  return c;
}

var KIT_ELEMENTS = [
  { key: 'button', label: 'Button', variants: [['Primary', 'Secondary', 'Tertiary'], ['Default', 'Hover', 'Disabled']] },
  { key: 'input', label: 'Input', states: ['Default', 'Filled', 'Focus', 'Error', 'Disabled'] },
  { key: 'checkbox', label: 'Checkbox', states: ['Unchecked', 'Checked'] },
  { key: 'radio', label: 'Radio', states: ['Unchecked', 'Checked'] },
  { key: 'switch', label: 'Switch', states: ['Off', 'On'] },
  { key: 'badge', label: 'Badge', states: ['Neutral', 'Brand', 'Success', 'Warning', 'Danger'] },
  { key: 'alert', label: 'Alert', states: ['Info', 'Success', 'Warning', 'Danger'] },
  { key: 'avatar', label: 'Avatar', states: ['sm', 'md', 'lg'] },
  { key: 'navlink', label: 'Nav link', states: ['Default', 'Active'] },
  { key: 'card', label: 'Card', states: null }
];

function buildElement(ctx, key, state) {
  if (key === 'input') return makeInput(ctx, state);
  if (key === 'checkbox') return makeToggleish(ctx, 'Checkbox', state);
  if (key === 'radio') return makeToggleish(ctx, 'Radio', state);
  if (key === 'switch') return makeToggleish(ctx, 'Switch', state);
  if (key === 'badge') return makeBadge(ctx, state);
  if (key === 'alert') return makeAlert(ctx, state);
  if (key === 'avatar') return makeAvatar(ctx, state);
  if (key === 'navlink') return makeNavLink(ctx, state);
  if (key === 'card') return makeCard(ctx);
  return null;
}

// Build the kit. Each element is a component set with real variant
// properties — one Button with a Variant and a State, not nine Buttons.
async function generateKitElements(cfg, opts) {
  opts = opts || {};
  var want = opts.elements && opts.elements.length ? opts.elements : null;
  var result = { created: 0, skipped: 0, bound: 0, reasons: [], sets: [], unit: 'element' };

  var fonts;
  try { fonts = await resolveKitFonts(); }
  catch (e) { result.reasons.push(e.message); return result; }

  var cols = await getUiKitCollections(true);
  var colors = await ensureKitColorVariables(cols);
  var nums = await numericTokenIndex(cols);
  var ctx = { fonts: fonts, colors: colors, nums: nums };

  var page = figma.createFrame();
  page.name = 'UI Kit — Elements';
  page.layoutMode = 'VERTICAL';
  page.primaryAxisSizingMode = 'AUTO';
  page.counterAxisSizingMode = 'AUTO';
  page.itemSpacing = 48;
  page.paddingLeft = 48; page.paddingRight = 48; page.paddingTop = 48; page.paddingBottom = 48;
  kitFill(page, colors, 'color/surface');

  for (var e = 0; e < KIT_ELEMENTS.length; e++) {
    var def = KIT_ELEMENTS[e];
    if (want && want.indexOf(def.key) === -1) continue;

    var section = kitRow(def.label, { vertical: true, gap: 16, align: 'MIN' });
    section.appendChild(kitText(def.label, fonts.bold, 16, colors, 'color/text/primary'));

    var made = [];
    try {
      if (def.variants) {
        for (var a = 0; a < def.variants[0].length; a++) {
          for (var b = 0; b < def.variants[1].length; b++) {
            made.push(makeButton(ctx, def.variants[0][a], def.variants[1][b]));
          }
        }
      } else if (def.states) {
        for (var s2 = 0; s2 < def.states.length; s2++) made.push(buildElement(ctx, def.key, def.states[s2]));
      } else {
        made.push(buildElement(ctx, def.key, null));
      }
    } catch (err) {
      result.skipped++;
      result.reasons.push(def.label + ': ' + ((err && err.message) ? err.message : String(err)));
      continue;
    }

    var holder = null;
    if (made.length > 1) {
      try {
        holder = figma.combineAsVariants(made, section);
        holder.name = def.label;
        holder.layoutMode = 'HORIZONTAL';
        holder.itemSpacing = 16;
        holder.paddingLeft = 16; holder.paddingRight = 16; holder.paddingTop = 16; holder.paddingBottom = 16;
      } catch (err2) {
        // Without a variant set the components are still usable, just loose.
        result.reasons.push(def.label + ': variants could not be combined, so they were left as separate components.');
        for (var m = 0; m < made.length; m++) section.appendChild(made[m]);
      }
    } else {
      section.appendChild(made[0]);
    }

    result.created++;
    result.sets.push({ key: def.key, label: def.label, count: made.length });
    page.appendChild(section);
  }

  if (!result.created) { try { page.remove(); } catch (e3) { /* nothing to clean */ } return result; }

  // Place it clear of everything already on the page.
  var maxX = 0, minY = 0, kids = figma.currentPage.children;
  for (var k = 0; k < kids.length; k++) {
    if (typeof kids[k].x === 'number') maxX = Math.max(maxX, kids[k].x + (kids[k].width || 0));
    if (typeof kids[k].y === 'number') minY = Math.min(minY, kids[k].y);
  }
  page.x = maxX + 160;
  page.y = minY;
  figma.currentPage.appendChild(page);
  try { figma.currentPage.selection = [page]; figma.viewport.scrollAndZoomIntoView([page]); } catch (e4) { /* headless */ }

  result.frameId = page.id;
  return result;
}

// ── UI Kit: responsive rules ───────────────────────────────────────────────
// Values reflow from variable modes. LAYOUT cannot: layoutMode,
// layoutSizingHorizontal, layoutWrap and visible are enums and booleans, and
// no variable can bind to any of them. So layout needs rules, and the
// vocabulary is kept deliberately small so the result stays predictable.
var UIKIT_RULES_KEY = 'uikit.rules';
var UIKIT_FROM_KEY = 'uikit.generatedFrom';
var UIKIT_BP_KEY = 'uikit.breakpoint';
var UIKIT_HASH_KEY = 'uikit.hash';

function readRules(node) {
  try {
    var raw = node.getPluginData(UIKIT_RULES_KEY);
    if (!raw) return null;
    var o = JSON.parse(raw);
    return (o && typeof o === 'object') ? o : null;
  } catch (e) { return null; }
}

function writeRules(node, rules) {
  try {
    if (!rules || !Object.keys(rules).length) node.setPluginData(UIKIT_RULES_KEY, '');
    else node.setPluginData(UIKIT_RULES_KEY, JSON.stringify(rules));
    return true;
  } catch (e) { return false; }
}

function fnv1a(str) {
  var h = 0x811c9dc5;
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16);
}

// A fingerprint of what a PERSON would change, used to tell a generated
// frame that is still untouched from one somebody has since edited.
//
// Width and height are deliberately excluded: auto layout and the active
// mode compute them, so including them would make a frame look edited
// merely because Figma re-settled it.
function structureHash(node) {
  var parts = [];
  function walk(n, depth) {
    if (!n) return;
    var pads = [n.paddingLeft, n.paddingTop, n.paddingRight, n.paddingBottom, n.itemSpacing, n.counterAxisSpacing]
      .map(function (v) { return (v === null || v === undefined) ? '' : Math.round(v); }).join(',');
    parts.push(depth + ':' + n.type + ':' + String(n.name || '') + ':' + (n.visible === false ? 0 : 1) +
      ':' + (n.layoutMode || '') + ':' + (n.layoutWrap || '') + ':' + pads +
      (n.type === 'TEXT' ? (':' + String(n.characters == null ? '' : n.characters).slice(0, 120)) : ''));
    if (n.children) for (var i = 0; i < n.children.length; i++) walk(n.children[i], depth + 1);
  }
  walk(node, 0);
  return fnv1a(parts.join('|'));
}

function childWidths(node) {
  var out = [];
  if (!node.children) return out;
  for (var i = 0; i < node.children.length; i++) {
    var c = node.children[i];
    if (c.visible === false) continue;
    out.push({ node: c, width: typeof c.width === 'number' ? c.width : 0 });
  }
  return out;
}

function looksLikeNav(name) {
  return /^(nav|navigation|menu|main\s*nav|nav\s*links?)$/i.test(String(name || '').trim());
}

// Are these siblings a grid — several children of roughly equal width?
function equalWidthRow(kids) {
  if (kids.length < 3) return false;
  var w = kids[0].width;
  if (!w) return false;
  for (var i = 1; i < kids.length; i++) {
    if (Math.abs(kids[i].width - w) > w * 0.12) return false;
  }
  return true;
}

// Propose rules for every breakpoint narrower than the widest one.
//
// Proposals only. Nothing is written and nothing is generated until the
// designer has looked at the list, because an inferred layout decision is a
// guess and a guess applied silently is worse than no feature.
function inferResponsiveRules(root, cfg) {
  var out = { proposals: [], byNode: {} };
  var bps = (cfg && cfg.breakpoints) ? cfg.breakpoints : [];
  if (bps.length < 2 || !root) return out;
  var widest = bps[0].width || (root.width || 1440);

  function add(node, bpName, rule, value, reason) {
    if (!out.byNode[node.id]) out.byNode[node.id] = { name: node.name, rules: {} };
    var slot = out.byNode[node.id].rules;
    if (!slot[bpName]) slot[bpName] = {};
    slot[bpName][rule] = value;
    out.proposals.push({
      nodeId: node.id, name: String(node.name || ''), breakpoint: bpName,
      rule: rule, value: value, reason: reason
    });
  }

  for (var b = 1; b < bps.length; b++) {
    var bp = bps[b];
    var targetW = bp.width || widest;

    (function descend(node, avail) {
      if (!node || node.visible === false) return;
      var padX = (node.paddingLeft || 0) + (node.paddingRight || 0);
      var inner = Math.max(0, avail - padX);
      var kids = childWidths(node);

      if (looksLikeNav(node.name) && kids.length >= 3 && inner < 700) {
        add(node, bp.name, 'hide', true,
          'A nav with ' + kids.length + ' links will not fit ' + Math.round(inner) + 'px.');
      }

      if (isAutoLayoutFrame(node) && node.layoutMode === 'HORIZONTAL' && kids.length > 1) {
        var gaps = (node.itemSpacing || 0) * (kids.length - 1);
        var needed = gaps;
        for (var i = 0; i < kids.length; i++) needed += kids[i].width;

        if (needed > inner) {
          if (equalWidthRow(kids)) {
            var cw = kids[0].width;
            var gap = node.itemSpacing || 0;
            var fit = Math.max(1, Math.floor((inner + gap) / (cw + gap)));
            if (fit < kids.length) {
              add(node, bp.name, 'cols', fit,
                kids.length + ' equal columns need ' + Math.round(needed) + 'px; ' +
                Math.round(inner) + 'px fits ' + fit + '.');
            }
          } else {
            add(node, bp.name, 'stack', true,
              'Its children need ' + Math.round(needed) + 'px side by side; only ' +
              Math.round(inner) + 'px is available.');
          }
        }
      }

      for (var k = 0; k < kids.length; k++) {
        var child = kids[k].node;
        if (kids[k].width > inner && kids[k].width > 0) {
          add(child, bp.name, 'fill', true,
            'It is ' + Math.round(kids[k].width) + 'px wide inside ' + Math.round(inner) + 'px.');
        }
        descend(child, node.layoutMode === 'HORIZONTAL' && kids.length > 1 ? kids[k].width : inner);
      }
    })(root, targetW);
  }

  return out;
}

// Save a proposal set onto the source layers, so a later re-generate
// replays the designer's decisions instead of re-deriving them.
async function saveResponsiveRules(byNode, accepted) {
  var saved = 0;
  for (var nodeId in byNode) {
    var node = await figma.getNodeByIdAsync(nodeId);
    if (!node) continue;
    var keep = {};
    var rules = byNode[nodeId].rules;
    for (var bp in rules) {
      for (var rule in rules[bp]) {
        var key = nodeId + '|' + bp + '|' + rule;
        if (accepted && accepted[key] === false) continue;
        if (!keep[bp]) keep[bp] = {};
        keep[bp][rule] = rules[bp][rule];
      }
    }
    var existing = readRules(node) || {};
    for (var ebp in keep) existing[ebp] = Object.assign(existing[ebp] || {}, keep[ebp]);
    if (writeRules(node, existing)) saved++;
  }
  return saved;
}

function setSizing(node, axis, mode) {
  try { node[axis] = mode; return true; } catch (e) { return false; }
}

// Apply one node's rules for one breakpoint. Everything is attempted
// independently — a layer Figma refuses is counted, never fatal.
function applyRulesTo(node, bpName, counts) {
  var rules = readRules(node);
  if (!rules || !rules[bpName]) return;
  var r = rules[bpName];

  if (r.hide === true) { try { node.visible = false; counts.applied++; } catch (e) { counts.failed++; } }
  if (r.show === true) { try { node.visible = true; counts.applied++; } catch (e) { counts.failed++; } }

  if (r.stack === true) {
    try {
      node.layoutMode = 'VERTICAL';
      // Children sized for a row will not fill a column on their own.
      if (node.children) {
        for (var i = 0; i < node.children.length; i++) setSizing(node.children[i], 'layoutSizingHorizontal', 'FILL');
      }
      counts.applied++;
    } catch (e) { counts.failed++; }
  }

  if (typeof r.cols === 'number' && r.cols > 0 && node.children) {
    try {
      node.layoutWrap = 'WRAP';
      var gap = node.itemSpacing || 0;
      var inner = Math.max(0, (node.width || 0) - (node.paddingLeft || 0) - (node.paddingRight || 0));
      var each = r.cols > 0 ? (inner - gap * (r.cols - 1)) / r.cols : inner;
      for (var c = 0; c < node.children.length; c++) {
        var kid = node.children[c];
        setSizing(kid, 'layoutSizingHorizontal', 'FIXED');
        if (typeof kid.resize === 'function' && each > 0) kid.resize(each, kid.height || 1);
      }
      counts.applied++;
    } catch (e) { counts.failed++; }
  }

  if (r.fill === true) {
    if (setSizing(node, 'layoutSizingHorizontal', 'FILL')) counts.applied++; else counts.failed++;
  }

  if (r.order && r.order.length && node.children) {
    try {
      for (var o = 0; o < r.order.length; o++) {
        var target = null;
        for (var k = 0; k < node.children.length; k++) if (node.children[k].name === r.order[o]) { target = node.children[k]; break; }
        if (target) node.insertChild(o, target);
      }
      counts.applied++;
    } catch (e) { counts.failed++; }
  }

  if (r.swap) counts.unsupported.push('"' + node.name + '": component swap is not generated yet.');
}

function walkApply(node, bpName, counts) {
  applyRulesTo(node, bpName, counts);
  if (node.children) {
    // Copy the list: a rule may reorder children mid-walk.
    var kids = node.children.slice();
    for (var i = 0; i < kids.length; i++) walkApply(kids[i], bpName, counts);
  }
}

function findGeneratedFrame(sourceId, bpName) {
  var kids = figma.currentPage.children || [];
  for (var i = 0; i < kids.length; i++) {
    var n = kids[i];
    try {
      if (n.getPluginData(UIKIT_FROM_KEY) === sourceId && n.getPluginData(UIKIT_BP_KEY) === bpName) return n;
    } catch (e) { /* not every node carries plugin data */ }
  }
  return null;
}

// Generate one frame per breakpoint from the selected frame.
//
// A frame that someone has edited since it was generated is REPORTED AND
// SKIPPED, never overwritten. Silently destroying hand-made changes is the
// single fastest way to make a generator untrustworthy.
async function generateResponsiveFrames(cfg, opts) {
  opts = opts || {};
  var result = { created: 0, replaced: 0, skipped: 0, applied: 0, failed: 0,
                 reasons: [], unsupported: [], frames: [], unit: 'frame' };
  var bps = (cfg && cfg.breakpoints) ? cfg.breakpoints : [];
  if (bps.length < 2) { result.reasons.push('At least two breakpoints are needed.'); return result; }

  var sel = figma.currentPage.selection;
  if (!sel || sel.length !== 1) { result.reasons.push('Select exactly one frame to generate from.'); return result; }
  var source = sel[0];
  if (!hasChildren(source)) { result.reasons.push('"' + source.name + '" has no children to lay out.'); return result; }
  if (source.getPluginData(UIKIT_FROM_KEY)) {
    result.reasons.push('"' + source.name + '" was itself generated. Select the original instead.');
    return result;
  }

  var cols = await getUiKitCollections(false);
  var modeByName = {};
  if (cols.responsive) {
    var ms = cols.responsive.modes || [];
    for (var m = 0; m < ms.length; m++) modeByName[normModeName(ms[m].name)] = ms[m].modeId;
  }

  var x = source.x + (source.width || 0) + 120;
  var counts = { applied: 0, failed: 0, unsupported: [] };

  for (var b = 1; b < bps.length; b++) {
    var bp = bps[b];

    var existing = findGeneratedFrame(source.id, bp.name);
    if (existing) {
      var storedHash = existing.getPluginData(UIKIT_HASH_KEY);
      var liveHash = structureHash(existing);
      if (storedHash && storedHash !== liveHash) {
        result.skipped++;
        result.reasons.push('"' + existing.name + '" has been edited since it was generated, so it was left alone.');
        x = existing.x + (existing.width || 0) + 120;
        continue;
      }
      x = existing.x;
      try { existing.remove(); result.replaced++; } catch (e) { /* keep going */ }
    }

    var clone = source.clone();
    clone.name = source.name + ' — ' + bp.name;

    if (cols.responsive && modeByName[normModeName(bp.name)]) {
      try { clone.setExplicitVariableModeForCollection(cols.responsive, modeByName[normModeName(bp.name)]); }
      catch (e) { result.reasons.push('"' + clone.name + '" could not take the ' + bp.name + ' mode.'); }
    }

    setSizing(clone, 'layoutSizingHorizontal', 'FIXED');
    if (bp.width && typeof clone.resize === 'function') {
      try { clone.resize(bp.width, clone.height || 1); } catch (e) { /* non-resizable */ }
    }

    walkApply(clone, bp.name, counts);

    clone.setPluginData(UIKIT_FROM_KEY, source.id);
    clone.setPluginData(UIKIT_BP_KEY, bp.name);
    clone.setPluginData(UIKIT_HASH_KEY, structureHash(clone));

    clone.x = x;
    clone.y = source.y;
    figma.currentPage.appendChild(clone);
    x += (clone.width || bp.width || 0) + 120;

    if (!existing) result.created++;
    result.frames.push({ id: clone.id, name: clone.name, breakpoint: bp.name });
  }

  result.applied = counts.applied;
  result.failed = counts.failed;
  result.unsupported = counts.unsupported;
  return result;
}

// ── UI Kit: reading a scale off the canvas ─────────────────────────────────
// A documented scale is just labelled text, so this is pattern matching and
// it will not be right every time. That is why it only ever PROPOSES a
// table: the grid in the UI is the source of truth, and anything this
// misreads is a visible wrong number rather than a silent one.

// "Frame 98", "Group 1", "Rectangle 143" carry no meaning.
function isGenericLayerName(name) {
  return /^(frame|group|rectangle|ellipse|vector|line|slice|component)\s*\d*$/i.test(String(name || '').trim());
}

function slugToken(text) {
  var t = String(text == null ? '' : text).toLowerCase().trim();
  t = t.replace(/[\s_]+/g, '-');
  t = t.replace(/[^a-z0-9/\-.]/g, '');
  t = t.replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
  return t;
}

function matchBreakpoint(text, names) {
  var t = String(text || '').toLowerCase();
  if (!t) return null;
  for (var i = 0; i < names.length; i++) {
    if (t.indexOf(String(names[i]).toLowerCase()) !== -1) return names[i];
  }
  return null;
}

function stripBreakpoint(text, bpName) {
  var cleaned = String(text || '');
  if (bpName) cleaned = cleaned.replace(new RegExp(bpName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '');
  return cleaned.replace(/[\/\-–—]+\s*$/, '').replace(/^\s*[\/\-–—]+/, '');
}

// Where a value sits: which breakpoint, and which group of tokens.
//
// Both can come from two places, and real files use both. "Component
// Padding - Desktop" puts them in a FRAME NAME; "Spacing/ Desktop" is a
// heading TEXT sitting beside the rows it introduces. Walking outward and
// checking each ancestor's own name AND its direct text children covers
// both, and nearest-wins keeps an outer container from swallowing an inner
// section.
function uiKitContext(node, names) {
  var cur = node.parent;
  var bp = matchBreakpoint(node.name, names);
  var group = '';

  while (cur && cur.type !== 'PAGE' && cur.type !== 'DOCUMENT') {
    var ownName = String(cur.name || '').trim();

    if (!bp) bp = matchBreakpoint(ownName, names);
    if (!bp && cur.children) {
      for (var c = 0; c < cur.children.length; c++) {
        var ch = cur.children[c];
        if (ch.type !== 'TEXT') continue;
        var hit = matchBreakpoint(ch.characters, names);
        if (hit) { bp = hit; if (!group) group = slugToken(stripBreakpoint(ch.characters, hit)); break; }
      }
    }

    if (!group && ownName && !isGenericLayerName(ownName)) {
      group = slugToken(stripBreakpoint(ownName, bp));
    }

    if (bp && group) break;
    cur = cur.parent;
  }
  return { bp: bp || null, group: group || '' };
}

var PX_ONLY = /^(-?\d+(?:\.\d+)?)\s*px$/i;
var LABEL_PX = /^(.*?)[\s]*[-–—][\s]*(-?\d+(?:\.\d+)?)\s*px$/i;

// Read a scale from frames on the canvas.
async function scanUiKit(roots, cfg) {
  var names = breakpointNames(cfg);
  var out = { rows: [], parsed: 0, unparsed: [] };
  if (!roots || !roots.length) return out;

  var nodes = styleScanNodes(roots);
  var byName = {};   // token name -> row

  function addValue(tokenName, bpName, value) {
    var key = tokenName;
    if (!byName[key]) {
      byName[key] = {
        name: tokenName,
        tier: bpName ? 'responsive' : 'primitive',
        scopes: tokenName.indexOf('radius') === 0 ? RADIUS_SCOPES : SPACING_SCOPES,
        values: {}
      };
    }
    var row = byName[key];
    // A token seen under any breakpoint is responsive, even if it was first
    // met outside one.
    if (bpName && row.tier !== 'responsive') { row.tier = 'responsive'; row.values = {}; }
    row.values[bpName || UIKIT_VALUE_KEY] = value;
    out.parsed++;
  }

  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    if (node.type !== 'TEXT') continue;
    var text = String(node.characters == null ? '' : node.characters).trim();
    if (!text) continue;

    var ctx = uiKitContext(node, names);
    var bp = ctx.bp;

    // Case 1: "Component Padding - lg - 120px" — label and value in one run.
    var m = LABEL_PX.exec(text);
    if (m && slugToken(m[1])) {
      var group1 = ctx.group;
      var label1 = slugToken(m[1]);
      if (group1 && label1.indexOf(group1 + '-') === 0) label1 = label1.slice(group1.length + 1);
      addValue(group1 ? (group1 + '/' + label1) : label1, bp, Number(m[2]));
      continue;
    }

    // Case 2: a bare "2px" whose sibling text is its name — the two-column
    // way a spacing ramp is normally documented.
    var only = PX_ONLY.exec(text);
    if (only) {
      var parent = node.parent;
      var label2 = null;
      if (parent && parent.children) {
        for (var c = 0; c < parent.children.length; c++) {
          var sib = parent.children[c];
          if (sib === node || sib.type !== 'TEXT') continue;
          var st = String(sib.characters == null ? '' : sib.characters).trim();
          if (!st || PX_ONLY.test(st)) continue;
          label2 = st;
          break;
        }
      }
      if (label2 === null) { out.unparsed.push(text); continue; }
      var group2 = ctx.group;
      var slug2 = slugToken(label2);
      if (group2 && slug2.indexOf(group2 + '-') === 0) slug2 = slug2.slice(group2.length + 1);
      addValue(group2 ? (group2 + '/' + slug2) : slug2, bp, Number(only[1]));
      continue;
    }

    if (/\d\s*px/i.test(text)) out.unparsed.push(text);
  }

  for (var k in byName) out.rows.push(byName[k]);
  out.rows.sort(function (a, b) { return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0); });
  return out;
}

// ── Build the whole system in one go ───────────────────────────────────────
// The wizard asks one question at a time and writes NOTHING until the end.
// Everything then lands inside a single undo group, so a system you don't
// like is one Cmd-Z away rather than a dozen.
function buildOptionsFrom(spec) {
  spec = spec || {};
  var ramp = spec.ramp || {};
  var type = spec.type || {};
  var colors = spec.colors || {};
  var fams = spec.families || {};
  return {
    spacing: ramp.spacing, spacingBase: ramp.spacingBase,
    radius: ramp.radius, radiusBase: ramp.radiusBase,
    typeBase: type.base, typeRatio: type.ratio,
    brandHex: colors.brandHex, neutralHex: colors.neutralHex,
    successHex: colors.successHex, warningHex: colors.warningHex, dangerHex: colors.dangerHex,
    theme: colors.theme !== false,
    typography: fams.typography !== false,
    borders: fams.borders !== false,
    icons: fams.icons !== false,
    opacity: fams.opacity !== false,
    breakpointWidths: fams.breakpointWidths !== false,
    colors: fams.colors !== false,
    grid: fams.grid === false ? false : (spec.grid || {})
  };
}

function previewTable(spec) {
  var cfg = { preset: (spec && spec.preset) || 'custom', breakpoints: (spec && spec.breakpoints) || [] };
  if (!cfg.breakpoints.length) return [];
  return defaultScaleTable(cfg, buildOptionsFrom(spec));
}

async function buildDesignSystem(spec) {
  spec = spec || {};
  var result = { tokens: null, elements: null, reasons: [], created: 0, unit: 'token' };
  var cfg = { preset: spec.preset || 'custom', breakpoints: spec.breakpoints || [] };
  if (!cfg.breakpoints.length) { result.reasons.push('No breakpoints were chosen.'); return result; }

  var cols = await getUiKitCollections(true);
  var modes = await ensureModes(cols.responsive, breakpointNames(cfg));
  if (modes.capHit) {
    result.reasons.push('This file allows ' + modes.cap + ' modes per collection, but ' +
      cfg.breakpoints.length + ' breakpoints were chosen. Nothing was changed — go back and remove ' +
      (cfg.breakpoints.length - modes.cap) + '.');
    return result;
  }
  writeBreakpointConfig(cfg);

  var table = (spec.table && spec.table.length) ? spec.table : previewTable(spec);
  result.tokens = await generateScaleVariables(cfg, table);
  result.created += result.tokens.created;
  Array.prototype.push.apply(result.reasons, result.tokens.reasons);

  var fams = spec.families || {};
  if (fams.grid !== false) {
    result.grids = await createGridStyles(cfg, { grid: spec.grid });
    Array.prototype.push.apply(result.reasons, result.grids.reasons);
  }

  if (spec.elements && spec.elements.length) {
    result.elements = await generateKitElements(cfg, { elements: spec.elements });
    Array.prototype.push.apply(result.reasons, result.elements.reasons);
  }
  return result;
}

// ── UI Kit: state and the message handler ──────────────────────────────────

// Read the scale back out of the file, so re-opening the tab shows what is
// actually there rather than the seed table again.
async function readScaleTable(cfg) {
  var cols = await getUiKitCollections(false);
  if (!cols.primitives && !cols.responsive) return null;
  var names = breakpointNames(cfg);
  var all = await localVariablesAllModes('FLOAT');
  var rows = [];

  for (var i = 0; i < all.length; i++) {
    var e = all[i], vals = {}, tier = null;
    if (cols.primitives && e.variable.variableCollectionId === cols.primitives.id) {
      tier = 'primitive';
      vals[UIKIT_VALUE_KEY] = e.resolved[modeOf(cols.primitives)];
    } else if (cols.responsive && e.variable.variableCollectionId === cols.responsive.id) {
      tier = 'responsive';
      for (var m = 0; m < names.length; m++) {
        for (var k = 0; k < e.modes.length; k++) {
          if (normModeName(e.modes[k].name) === normModeName(names[m])) {
            vals[names[m]] = e.resolved[e.modes[k].modeId];
          }
        }
      }
    }
    if (!tier) continue;
    rows.push({ name: e.variable.name, tier: tier, scopes: (e.variable.scopes || []).slice(), values: vals });
  }
  rows.sort(function (a, b) { return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0); });
  return rows.length ? rows : null;
}

async function uiKitState() {
  var cfg = readBreakpointConfig();
  var cols = await getUiKitCollections(false);
  var presetNames = [];
  for (var k in BREAKPOINT_PRESETS) presetNames.push(k);

  var responsiveModes = [];
  if (cols.responsive) {
    var ms = cols.responsive.modes || [];
    for (var i = 0; i < ms.length; i++) responsiveModes.push(ms[i].name);
  }

  var table = cfg ? (await readScaleTable(cfg)) : null;
  var fromFile = !!table;
  if (!table && cfg) table = defaultScaleTable(cfg);

  var sel = figma.currentPage.selection || [];
  return {
    type: 'uikit-state',
    config: cfg,
    presets: BREAKPOINT_PRESETS,
    presetNames: presetNames,
    spacingPresets: SPACING_PRESETS,
    radiusPresets: RADIUS_PRESETS,
    elements: KIT_ELEMENTS.map(function (d) { return { key: d.key, label: d.label }; }),
    typeRatios: TYPE_RATIOS,
    themeModes: THEME_MODES,
    valueKey: UIKIT_VALUE_KEY,
    collections: {
      primitives: !!cols.primitives,
      theme: !!cols.theme,
      responsive: !!cols.responsive,
      responsiveModes: responsiveModes
    },
    table: table,
    tableFromFile: fromFile,
    selectionCount: sel.length,
    selectionName: sel.length === 1 ? sel[0].name : ''
  };
}

function uiKitSummary(kind, r) {
  if (kind === 'generate') {
    if (r.modes && r.modes.capHit) return r.reasons[0];
    var parts = [];
    if (r.created) parts.push(r.created + ' created');
    if (r.reused) parts.push(r.reused + ' reused');
    if (r.aliased) parts.push(r.aliased + ' aliased to a primitive');
    if (r.raw) parts.push(r.raw + ' raw');
    if (r.skipped) parts.push(r.skipped + ' skipped');
    return parts.length ? ('Scale generated — ' + parts.join(', ') + '.') : 'Nothing to generate.';
  }
  if (kind === 'bind') {
    if (!r.bound && !r.alreadyBound) return r.reasons.length ? r.reasons[0] : 'Nothing to bind.';
    var b = [];
    if (r.bound) b.push(r.bound + ' bound');
    if (r.alreadyBound) b.push(r.alreadyBound + ' already bound');
    if (r.skipped) b.push(r.skipped + ' skipped');
    return b.join(', ') + ' across ' + r.layers + ' layer' + (r.layers === 1 ? '' : 's') + '.';
  }
  if (kind === 'preview') {
    if (!r.applied) return r.reasons.length ? r.reasons[0] : 'Nothing to preview.';
    return 'Previewing ' + r.applied + ' frame' + (r.applied === 1 ? '' : 's') + '.';
  }
  return '';
}

async function handleUiKitMessage(msg) {
  // Scanning changes nothing, so it stays outside the undo boundary.
  if (msg.type === 'uikit-scan') {
    figma.ui.postMessage(await uiKitState());
    return;
  }

  // Close the undo group that is currently open BEFORE starting, so one
  // Cmd-Z undoes exactly this action and not whatever the user did on the
  // canvas beforehand. Same reasoning as handleStyleMessage.
  figma.commitUndo();
  try {
    var r = null, summary = '', tone = 'success';

    if (msg.type === 'uikit-save-breakpoints') {
      var cfg = { preset: msg.preset || 'custom', breakpoints: msg.breakpoints || [] };
      if (!cfg.breakpoints.length) throw new Error('Pick at least one breakpoint.');
      var cols = await getUiKitCollections(true);
      var modes = await ensureModes(cols.responsive, breakpointNames(cfg));
      if (modes.capHit) {
        tone = 'warning';
        summary = 'This file allows ' + modes.cap + ' modes per collection, but ' +
          cfg.breakpoints.length + ' breakpoints were asked for. Nothing was changed.';
      } else {
        writeBreakpointConfig(cfg);
        summary = cfg.breakpoints.length + ' breakpoints set up.';
      }
      r = { modes: modes };
    } else if (msg.type === 'uikit-generate') {
      var gcfg = readBreakpointConfig();
      if (!gcfg) throw new Error('Set up breakpoints first.');
      r = await generateScaleVariables(gcfg, msg.table);
      summary = uiKitSummary('generate', r);
      if (r.modes && r.modes.capHit) tone = 'warning';
      else if (!r.created && !r.reused) tone = 'warning';
    } else if (msg.type === 'uikit-parse') {
      var pcfg = readBreakpointConfig();
      if (!pcfg) throw new Error('Set up breakpoints first.');
      var roots = (figma.currentPage.selection && figma.currentPage.selection.length)
        ? figma.currentPage.selection
        : figma.currentPage.children;
      r = await scanUiKit(roots, pcfg);
      if (!r.rows.length) {
        tone = 'warning';
        summary = 'Found no "<label> 24px" pairs to read. Select the frames that document the scale and try again.';
      } else {
        summary = 'Read ' + r.rows.length + ' token' + (r.rows.length === 1 ? '' : 's') +
          ' from ' + r.parsed + ' labelled value' + (r.parsed === 1 ? '' : 's') +
          (r.unparsed.length ? ('; ' + r.unparsed.length + ' label(s) could not be read.') : '.') +
          ' Check the table before generating.';
        if (r.unparsed.length) tone = 'warning';
      }
    } else if (msg.type === 'uikit-reseed') {
      var rcfg = readBreakpointConfig();
      if (!rcfg) throw new Error('Set up breakpoints first.');
      r = { rows: defaultScaleTable(rcfg, msg.options || {}) };
      summary = 'Scale rebuilt from the preset — ' + r.rows.length + ' tokens. Nothing is written until you Generate.';
    } else if (msg.type === 'uikit-infer') {
      var icfg = readBreakpointConfig();
      if (!icfg) throw new Error('Set up breakpoints first.');
      var isel = figma.currentPage.selection;
      if (!isel || isel.length !== 1) throw new Error('Select exactly one frame to analyse.');
      r = inferResponsiveRules(isel[0], icfg);
      summary = r.proposals.length
        ? ('Proposed ' + r.proposals.length + ' layout change' + (r.proposals.length === 1 ? '' : 's') + '. Review them, then generate.')
        : 'No layout changes needed — every row already fits the narrower breakpoints.';
      if (!r.proposals.length) tone = 'warning';
    } else if (msg.type === 'uikit-responsive') {
      var vcfg = readBreakpointConfig();
      if (!vcfg) throw new Error('Set up breakpoints first.');
      if (msg.byNode) await saveResponsiveRules(msg.byNode, msg.accepted);
      r = await generateResponsiveFrames(vcfg, msg);
      if (r.frames.length) {
        summary = r.created + ' created' + (r.replaced ? (', ' + r.replaced + ' replaced') : '') +
          (r.skipped ? (', ' + r.skipped + ' left alone') : '') + '.';
      } else {
        summary = r.reasons.length ? r.reasons[0] : 'Nothing generated.';
        tone = 'warning';
      }
      if (r.skipped) tone = 'warning';
    } else if (msg.type === 'uikit-preview-table') {
      r = { rows: previewTable(msg.spec || {}) };
      summary = '';
    } else if (msg.type === 'uikit-build') {
      r = await buildDesignSystem(msg.spec || {});
      if (!r.tokens || !r.tokens.created && !r.tokens.reused) {
        summary = r.reasons.length ? r.reasons[0] : 'Nothing was built.';
        tone = 'warning';
      } else {
        var bits = [r.tokens.created + ' tokens'];
        if (r.tokens.aliased) bits.push(r.tokens.aliased + ' aliased');
        if (r.grids && r.grids.created) bits.push(r.grids.created + ' grid styles');
        if (r.elements && r.elements.created) bits.push(r.elements.created + ' elements');
        summary = 'Design system built — ' + bits.join(', ') + '. One undo reverses all of it.';
      }
    } else if (msg.type === 'uikit-elements') {
      var ecfg = readBreakpointConfig();
      r = await generateKitElements(ecfg, msg);
      if (r.created) {
        summary = r.created + ' element' + (r.created === 1 ? '' : 's') + ' created, bound to the tokens.';
        if (r.skipped) tone = 'warning';
      } else {
        summary = r.reasons.length ? r.reasons[0] : 'Nothing to create.';
        tone = 'warning';
      }
    } else if (msg.type === 'uikit-bind') {
      r = await bindScaleToSelection(msg);
      summary = uiKitSummary('bind', r);
      if (!r.bound) tone = 'warning';
    } else if (msg.type === 'uikit-preview') {
      r = await previewBreakpoint(msg.breakpoint);
      summary = uiKitSummary('preview', r);
      if (!r.applied) tone = 'warning';
    } else {
      return;
    }

    figma.commitUndo();
    var state = await uiKitState();
    // A parse PROPOSES a table and writes nothing, so the state must carry
    // the proposal rather than what is currently in the file — otherwise
    // the reply would immediately overwrite what was just read.
    if ((msg.type === 'uikit-parse' || msg.type === 'uikit-reseed' ||
         msg.type === 'uikit-preview-table') && r && r.rows && r.rows.length) {
      state.table = r.rows;
      state.tableFromFile = false;
    }
    figma.ui.postMessage({
      type: 'uikit-done', requestId: msg.requestId, tone: tone,
      message: summary, result: r, state: state,
      // Tells the UI the wizard is finished and it can show the system.
      builtSystem: msg.type === 'uikit-build' && !!(r && r.tokens && (r.tokens.created || r.tokens.reused))
    });
    if (summary) figma.notify(summary, { timeout: 3000 });
  } catch (e) {
    try { figma.commitUndo(); } catch (e2) { /* nothing to close */ }
    figma.ui.postMessage({
      type: 'uikit-error', requestId: msg.requestId,
      message: (e && e.message) ? e.message : String(e)
    });
  }
}

function modeOf(collection) {
  if (!collection) return null;
  if (collection.defaultModeId) return collection.defaultModeId;
  return collection.modes && collection.modes.length ? collection.modes[0].modeId : null;
}

function normModeName(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

// Give a collection exactly these modes, by name.
//
// How many modes a collection may hold depends on the team's Figma plan, and
// the published figures disagree with each other. So don't predict it: ask
// the file. addMode() throws once the ceiling is reached, and that throw is
// the only trustworthy source.
//
// On hitting the ceiling every mode created in THIS call is rolled back, so
// the collection is never left half-configured. Modes that already existed
// are never touched, never renamed away from a name we were asked for, and
// never removed — they may hold values we know nothing about.
async function ensureModes(collection, names) {
  var out = { nameToModeId: {}, created: [], renamed: [], capHit: false, cap: 0 };
  if (!collection) return out;

  var existing = collection.modes || [];
  var byName = {};
  for (var i = 0; i < existing.length; i++) byName[normModeName(existing[i].name)] = existing[i].modeId;

  // A fresh collection arrives with one placeholder mode ("Mode 1"). If the
  // first name we want isn't present, rename the placeholder rather than
  // adding beside it — otherwise "Mode 1" lingers forever.
  var wantFirst = names.length ? normModeName(names[0]) : null;
  if (existing.length === 1 && wantFirst && !byName[wantFirst]) {
    try {
      collection.renameMode(existing[0].modeId, names[0]);
      out.renamed.push(names[0]);
      delete byName[normModeName(existing[0].name)];
      byName[wantFirst] = existing[0].modeId;
    } catch (e) { /* not renameable; fall through and add instead */ }
  }

  for (var n = 0; n < names.length; n++) {
    var key = normModeName(names[n]);
    if (byName[key]) { out.nameToModeId[names[n]] = byName[key]; continue; }
    var id = null;
    try {
      id = collection.addMode(names[n]);
    } catch (e) {
      out.capHit = true;
      out.cap = (collection.modes || []).length;
      break;
    }
    byName[key] = id;
    out.created.push(id);
    out.nameToModeId[names[n]] = id;
  }

  if (out.capHit) {
    // Roll back only what this call added. Those modes are new and empty, so
    // removing them cannot destroy a value anyone set.
    for (var r = out.created.length - 1; r >= 0; r--) {
      try { collection.removeMode(out.created[r]); } catch (e) { /* leave it */ }
    }
    out.created = [];
    out.nameToModeId = {};
  }
  return out;
}

// Resolved value of a variable, following one level of alias.
// wantModeId is optional: omitted (every pre-UI-Kit caller) it reads the
// collection's default mode, which is what the Colors and Typography tabs
// have always done. An alias is followed in the SAME mode only when the
// target shares the collection; across collections the target has its own
// mode set, so its default is the only sane answer.
async function variableValue(v, wantModeId) {
  try {
    var col = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
    var modeId = (wantModeId && v.valuesByMode[wantModeId] !== undefined) ? wantModeId : modeOf(col);
    var val = (modeId && v.valuesByMode[modeId] !== undefined)
      ? v.valuesByMode[modeId]
      : v.valuesByMode[Object.keys(v.valuesByMode)[0]];
    if (val && val.type === 'VARIABLE_ALIAS') {
      var target = await figma.variables.getVariableByIdAsync(val.id);
      if (!target) return null;
      var sameCollection = target.variableCollectionId === v.variableCollectionId;
      return await variableValue(target, sameCollection ? modeId : null);
    }
    return val;
  } catch (e) { return null; }
}

// Local variables of a type, each with its resolved value. Remote (library)
// variables can't be edited, so they're read-only matches.
async function localVariablesWithValues(type) {
  var list = [];
  var vars = await figma.variables.getLocalVariablesAsync(type);
  for (var i = 0; i < vars.length; i++) {
    if (vars[i].remote) continue;
    var val = await variableValue(vars[i]);
    if (val !== null && val !== undefined) list.push({ variable: vars[i], value: val });
  }
  return list;
}

// Every local variable of a type, resolved in EVERY mode of its collection.
//
// Deliberately a sibling of localVariablesWithValues rather than a change to
// it: that one has ~25 callers across Colors and Typography, all of which
// mean "the default mode", and all of which must keep meaning that.
async function localVariablesAllModes(type) {
  var list = [];
  var vars = await figma.variables.getLocalVariablesAsync(type);
  var colCache = {};
  for (var i = 0; i < vars.length; i++) {
    var v = vars[i];
    if (v.remote) continue;
    var col = colCache[v.variableCollectionId];
    if (col === undefined) {
      col = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
      colCache[v.variableCollectionId] = col;
    }
    if (!col) continue;
    var modes = col.modes || [];
    var resolved = {};
    for (var m = 0; m < modes.length; m++) {
      var rv = await variableValue(v, modes[m].modeId);
      if (rv !== null && rv !== undefined) resolved[modes[m].modeId] = rv;
    }
    list.push({ variable: v, collection: col, modes: modes, resolved: resolved, raw: v.valuesByMode });
  }
  return list;
}

function sameColorValue(val, hex, opacity) {
  if (!val || typeof val.r !== 'number') return false;
  if (rgbToHexStr(val) !== String(hex).toUpperCase()) return false;
  var a = typeof val.a === 'number' ? val.a : 1;
  return Math.abs(a - (typeof opacity === 'number' ? opacity : 1)) < 0.004;
}

function hasScope(v, scope) {
  var sc = v.scopes || [];
  return sc.length === 0 || sc.indexOf('ALL_SCOPES') !== -1 || sc.indexOf(scope) !== -1;
}

async function setVarValue(variable, collection, value, modeId) {
  var id = modeId || modeOf(collection);
  if (!id) throw new Error('That variable collection has no mode to write to.');
  variable.setValueForMode(id, value);
}

// Find a local COLOR variable already holding this value.
function findColorVariable(pool, hex, opacity) {
  for (var i = 0; i < pool.length; i++) if (sameColorValue(pool[i].value, hex, opacity)) return pool[i].variable;
  return null;
}

// A variable this plugin created as part of some style's group, e.g.
// "H1/fontSize". Those belong to that style and must not be handed to a
// different style just because the value happens to match.
function isGroupMemberName(name) {
  var n = String(name);
  // Flat naming: "Caption Font Size".
  for (var key in TEXT_FIELD_LABEL) {
    var suffix = ' ' + TEXT_FIELD_LABEL[key];
    if (n.length > suffix.length && n.slice(-suffix.length) === suffix) return true;
  }
  // Older folder naming: "Caption/fontSize".
  var slash = n.lastIndexOf('/');
  if (slash === -1) return false;
  var tail = n.slice(slash + 1);
  for (var i = 0; i < TEXT_VAR_FIELDS.length; i++) if (TEXT_VAR_FIELDS[i].field === tail) return true;
  return false;
}

// Matching order:
//   1. the exact name this style would use — makes re-running idempotent;
//   2. a free-standing variable of the same value and scope (the designer's
//      own token, e.g. "Brand/Heading Size"), so existing work is reused.
// Another style's group member is never matched by value, so each text style
// stays independently editable.
// `wantName` may be a list: new variables use the flat "Caption Font Size"
// naming, but files made earlier hold "Caption/fontSize", and both must match.
function findTextVariable(pool, spec, wantName) {
  var wanted = Array.isArray(wantName) ? wantName : [wantName];
  var exact = null, byValue = null;
  for (var i = 0; i < pool.length; i++) {
    var v = pool[i].variable, val = pool[i].value;
    if (wanted.indexOf(v.name) !== -1) exact = v;
    if (byValue || isGroupMemberName(v.name)) continue;
    var same = spec.type === 'STRING'
      ? String(val) === String(spec.value)
      : (typeof val === 'number' && Math.abs(val - spec.value) < 0.01);
    if (same && hasScope(v, spec.scope)) byValue = v;
  }
  return exact || byValue;
}


// Create (or reuse) VARIABLES for a palette / type scale.
// Reuse order: an existing variable of the same value wins; failing that, an
// existing STYLE of the same value supplies the value so nothing is invented.
async function createVariablesFromList(kind, msg) {
  var items = msg.items || [];
  var result = { created: 0, applied: 0, skipped: 0, reused: 0, fromStyles: 0, reasons: [], unit: 'variable' };
  var collection = await getTokenCollection(true, kind);
  if (!collection) throw new Error('Could not open a variable collection in this file.');

  if (kind === 'paint') {
    var pool = await localVariablesWithValues('COLOR');
    var styles = await figma.getLocalPaintStylesAsync();
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      try {
        var rgba = hexToRgb01(item.hex);
        rgba.a = typeof item.opacity === 'number' ? item.opacity : 1;

        var found = findColorVariable(pool, item.hex, rgba.a);
        if (found) { result.reused++; continue; }

        // A local style already carries this value — reuse its name so the
        // variable and the style stay recognisably the same token.
        var name = item.name;
        var sourceStyle = null;
        for (var si = 0; si < styles.length; si++) {
          var sv = solidOfStyle(styles[si]);
          if (sv && sv.hex === String(item.hex).toUpperCase() && Math.abs(sv.opacity - rgba.a) < 0.004) {
            name = styles[si].name; sourceStyle = styles[si]; result.fromStyles++; break;
          }
        }

        var v = figma.variables.createVariable(name, collection, 'COLOR');
        await setVarValue(v, collection, rgba);
        pool.push({ variable: v, value: rgba });
        result.created++;
        // The style this value came from must point at the new variable,
        // otherwise we have just created the duplicate we set out to avoid.
        if (sourceStyle && bindPaintStyleToExactVariable(sourceStyle, v)) {
          result.linked = (result.linked || 0) + 1;
        }
      } catch (e) {
        result.skipped++;
        pushReason(result, item.name + ': ' + (e && e.message ? e.message : 'could not create variable'));
      }
    }
    return result;
  }

  // Typography: one variable per property, grouped under the style's name.
  var floatPool = await localVariablesWithValues('FLOAT');
  var stringPool = await localVariablesWithValues('STRING');
  var textStyles = await figma.getLocalTextStylesAsync();
  for (var t = 0; t < items.length; t++) {
    var it = items[t];
    try {
      // If a text style of this name already exists, its values are the truth.
      var src = { family: it.family, style: it.style, size: it.fontSize,
                  lh: lineHeightNumber(it.lineHeight), ls: letterSpacingNumber(it.letterSpacing) };
      for (var ti = 0; ti < textStyles.length; ti++) {
        if (textStyles[ti].name !== it.name) continue;
        var ts = textStyles[ti];
        src = { family: ts.fontName.family, style: ts.fontName.style, size: ts.fontSize,
                lh: lineHeightNumber(ts.lineHeight), ls: letterSpacingNumber(ts.letterSpacing) };
        result.fromStyles++;
        break;
      }

      for (var f = 0; f < TEXT_VAR_FIELDS.length; f++) {
        var def = TEXT_VAR_FIELDS[f];
        var value = src[def.prop];
        if (value === null || value === undefined) continue;
        var pool2 = def.type === 'STRING' ? stringPool : floatPool;
        var flatName = textVarName(it.name, def.field);
        var hit = findTextVariable(pool2, { type: def.type, value: value, scope: def.scope }, [flatName, it.name + '/' + def.field]);
        if (hit) { result.reused++; continue; }
        var nv = figma.variables.createVariable(flatName, collection, def.type);
        try { nv.scopes = [def.scope]; } catch (e) {}
        await setVarValue(nv, collection, value);
        // Deliberately NOT added to the pool: every text style keeps its own
        // group, so changing H1's font can't silently move Body too. Only
        // variables that existed before this run are reused by value — and a
        // re-run matches on the name, so it stays idempotent.
        result.created++;
      }
    } catch (e) {
      result.skipped++;
      pushReason(result, it.name + ': ' + (e && e.message ? e.message : 'could not create variables'));
    }
  }
  return result;
}

// AUTO line height has no number to store; percent/pixel values keep their number.
function lineHeightNumber(lh) {
  if (!lh || lh.unit === 'AUTO' || typeof lh.value !== 'number') return null;
  return lh.value;
}
function letterSpacingNumber(ls) {
  if (!ls || typeof ls.value !== 'number') return null;
  return ls.value;
}

// When creating STYLES, bind them to variables that already hold the same
// values, so the style becomes a reference rather than a second copy.
// Every binding is best-effort: Figma rejects some fields on some versions,
// and a style that isn't bound is still a correct style.
async function bindPaintStyleToVariable(style, pool, hex, opacity) {
  var v = findColorVariable(pool, hex, opacity);
  if (!v) return false;
  return bindPaintStyleToExactVariable(style, v);
}

// Figma overwrites paint.opacity with the variable's alpha on write, so the
// variable owns the opacity and the paint becomes a pure reference. Setting
// opacity to 1 here only keeps our in-memory paint honest.
function bindPaintStyleToExactVariable(style, variable) {
  try {
    var base = Object.assign({}, style.paints[0], { opacity: 1 });
    var bound = figma.variables.setBoundVariableForPaint(base, 'color', variable);
    style.paints = [bound];
    return true;
  } catch (e) { return false; }
}

async function bindTextStyleToVariables(style, floatPool, stringPool, spec) {
  var n = 0;
  var src = { family: spec.family, style: spec.style, size: spec.fontSize,
              lh: lineHeightNumber(spec.lineHeight), ls: letterSpacingNumber(spec.letterSpacing) };
  for (var f = 0; f < TEXT_VAR_FIELDS.length; f++) {
    var def = TEXT_VAR_FIELDS[f];
    var value = src[def.prop];
    if (value === null || value === undefined) continue;
    var pool = def.type === 'STRING' ? stringPool : floatPool;
    var hit = findTextVariable(pool, { type: def.type, value: value, scope: def.scope }, [textVarName(spec.name, def.field), spec.name + '/' + def.field]);
    if (!hit) continue;
    try { style.setBoundVariable(def.field, hit); n++; } catch (e) {}
  }
  return n;
}

// ── Style guide frame (placed on the canvas after Generate) ─────────────────
const GUIDE_INK = { r: 0.067, g: 0.094, b: 0.153 };    // #111827
const GUIDE_MUTED = { r: 0.42, g: 0.447, b: 0.502 };   // #6B7280
const GUIDE_LINE = { r: 0.898, g: 0.906, b: 0.922 };   // #E5E7EB
const GUIDE_FONT = { family: 'Inter', style: 'Regular' };
const GUIDE_FONT_BOLD = { family: 'Inter', style: 'Semi Bold' };
const GUIDE_SAMPLE = 'Pack my box with five-dozen liquor jugs.';

function guideFrame(name, direction, gap, padding) {
  const f = figma.createFrame();
  f.name = name;
  f.layoutMode = direction;
  f.primaryAxisSizingMode = 'AUTO';
  f.counterAxisSizingMode = 'AUTO';
  f.itemSpacing = gap;
  f.paddingTop = padding; f.paddingBottom = padding; f.paddingLeft = padding; f.paddingRight = padding;
  f.fills = [];
  return f;
}

function guideLabel(text, size, bold, color, width) {
  const t = figma.createText();
  t.fontName = bold ? GUIDE_FONT_BOLD : GUIDE_FONT;
  t.characters = text;
  t.fontSize = size;
  t.fills = [{ type: 'SOLID', color: color || GUIDE_INK }];
  if (width) {
    t.textAutoResize = 'HEIGHT';
    t.resize(width, t.height);
  }
  return t;
}

function lineHeightLabel(lh) {
  if (!lh || lh.unit === 'AUTO') return 'Auto';
  return round2(lh.value) + (lh.unit === 'PIXELS' ? 'px' : '%');
}

// Places the guide to the right of everything on the page, selects it and zooms to it.
async function buildStyleGuide(kind, styles) {
  await figma.loadFontAsync(GUIDE_FONT);
  await figma.loadFontAsync(GUIDE_FONT_BOLD);
  const isPaint = kind === 'paint';
  const root = guideFrame(isPaint ? 'Style Guide / Colors' : 'Style Guide / Typography', 'VERTICAL', 28, 48);
  root.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  root.cornerRadius = 16;

  const head = guideFrame('Header', 'VERTICAL', 6, 0);
  head.appendChild(guideLabel(isPaint ? 'Color Styles' : 'Text Styles', 28, true));
  head.appendChild(guideLabel(styles.length + ' style' + (styles.length !== 1 ? 's' : '') + ' · generated by Figma WordPress Optimizer', 13, false, GUIDE_MUTED));
  root.appendChild(head);

  if (isPaint) {
    const CARD = 168, GAP = 20, PER_ROW = 4;
    const grid = guideFrame('Swatches', 'HORIZONTAL', GAP, 0);
    grid.layoutWrap = 'WRAP';
    grid.counterAxisSpacing = 24;
    grid.primaryAxisSizingMode = 'FIXED';
    grid.resize(CARD * PER_ROW + GAP * (PER_ROW - 1), 100);
    grid.counterAxisSizingMode = 'AUTO';
    for (const style of styles) {
      const card = guideFrame(style.name, 'VERTICAL', 8, 0);
      const swatch = figma.createRectangle();
      swatch.name = 'Swatch';
      swatch.resize(CARD, 104);
      swatch.cornerRadius = 10;
      swatch.strokes = [{ type: 'SOLID', color: GUIDE_LINE }];
      swatch.strokeWeight = 1;
      await swatch.setFillStyleIdAsync(style.id);
      card.appendChild(swatch);
      card.appendChild(guideLabel(style.name, 13, true, GUIDE_INK, CARD));
      const sp = solidOfStyle(style);
      card.appendChild(guideLabel(sp ? sp.hex + ' · ' + opPct(sp.opacity) + '%' : 'Gradient', 12, false, GUIDE_MUTED, CARD));
      grid.appendChild(card);
    }
    root.appendChild(grid);
  } else {
    const list = guideFrame('Styles', 'VERTICAL', 24, 0);
    for (const style of styles) {
      const row = guideFrame(style.name, 'VERTICAL', 6, 0);
      const meta = style.name + '  —  ' + style.fontName.family + ' ' + style.fontName.style + ' · ' + round2(style.fontSize) + 'px · LH ' + lineHeightLabel(style.lineHeight);
      row.appendChild(guideLabel(meta, 12, false, GUIDE_MUTED));
      const sample = figma.createText();
      sample.fontName = GUIDE_FONT;
      sample.characters = GUIDE_SAMPLE;
      await figma.loadFontAsync(style.fontName);
      await sample.setTextStyleIdAsync(style.id);
      sample.fills = [{ type: 'SOLID', color: GUIDE_INK }];
      row.appendChild(sample);
      list.appendChild(row);
    }
    root.appendChild(list);
  }

  // Right of the existing content, top-aligned with it.
  let maxRight = 0, minTop = null;
  for (const n of figma.currentPage.children) {
    if (n.id === root.id || typeof n.x !== 'number') continue;
    maxRight = Math.max(maxRight, n.x + n.width);
    minTop = minTop === null ? n.y : Math.min(minTop, n.y);
  }
  root.x = Math.round(maxRight + 200);
  root.y = Math.round(minTop === null ? 0 : minTop);
  figma.currentPage.selection = [root];
  figma.viewport.scrollAndZoomIntoView([root]);
  return root;
}

// Merge and delete touch every page — styles are shared by the whole file.
async function relinkStylesInFile(kind, keepId, removeIds, result) {
  const remove = new Set(removeIds);
  for (const page of figma.root.children) {
    const nodes = page.findAll(() => true);
    for (const node of nodes) {
      try {
        if (kind === 'text') {
          if (node.type !== 'TEXT') continue;
          if (node.textStyleId === figma.mixed) {
            const segs = node.getStyledTextSegments(['textStyleId']);
            const hits = segs.filter(s => remove.has(s.textStyleId));
            if (!hits.length) continue;
            await loadTextNodeFonts(node);
            for (const s of hits) await node.setRangeTextStyleIdAsync(s.start, s.end, keepId);
            result.applied++;
          } else if (remove.has(node.textStyleId)) {
            await loadTextNodeFonts(node);
            await node.setTextStyleIdAsync(keepId);
            result.applied++;
          }
          continue;
        }
        if ('fillStyleId' in node) {
          if (node.fillStyleId === figma.mixed && node.type === 'TEXT') {
            const segs = node.getStyledTextSegments(['fillStyleId']);
            const hits = segs.filter(s => remove.has(s.fillStyleId));
            if (hits.length) {
              await loadTextNodeFonts(node);
              for (const s of hits) await node.setRangeFillStyleIdAsync(s.start, s.end, keepId);
              result.applied++;
            }
          } else if (remove.has(node.fillStyleId)) {
            await node.setFillStyleIdAsync(keepId);
            result.applied++;
          }
        }
        if ('strokeStyleId' in node && remove.has(node.strokeStyleId)) {
          await node.setStrokeStyleIdAsync(keepId);
          result.applied++;
        }
      } catch (e) {
        // Layers inside instances follow their main component.
        result.skipped++;
      }
    }
  }
}

// Near-duplicate groups can now contain variables as well as styles, so a
// member's kind decides what merging it means:
//   style  into style     relink every layer in the file, then delete it
//   style  into variable  bind the style to the variable (nothing deleted)
//   variable into either  left alone — deleting a variable that other files or
//                         pages may use is not what a near-duplicate merge is
async function mergeStyles(kind, groups, into) {
  const result = into || { created: 0, applied: 0, skipped: 0, reasons: [], removed: 0 };
  await figma.loadAllPagesAsync();
  for (const g of groups) {
    const members = g.members || (g.removeIds || []).map(id => ({ id: id, kind: 'style' }));
    const keepKind = g.keepKind || 'style';

    if (keepKind === 'variable') {
      const variable = await figma.variables.getVariableByIdAsync(g.keepId);
      if (!variable) { pushReason(result, 'The variable to keep no longer exists.'); continue; }
      for (const m of members) {
        if (m.kind !== 'style') { result.skipped++; pushReason(result, 'Variables are not deleted by merge — remove them in Figma\'s variable panel.'); continue; }
        const st = await figma.getStyleByIdAsync(m.id);
        if (!st || st.remote) { result.skipped++; continue; }
        if (bindPaintStyleToExactVariable(st, variable)) result.linked = (result.linked || 0) + 1;
        else { result.skipped++; pushReason(result, 'Figma rejected binding “' + st.name + '” to the variable.'); }
      }
      continue;
    }

    const keep = await figma.getStyleByIdAsync(g.keepId);
    if (!keep) { pushReason(result, 'Style to keep no longer exists.'); continue; }
    const styleIds = members.filter(m => m.kind === 'style').map(m => m.id);
    const variableCount = members.length - styleIds.length;
    if (variableCount) {
      result.skipped += variableCount;
      pushReason(result, 'Variables are not deleted by merge — remove them in Figma\'s variable panel.');
    }
    await relinkStylesInFile(kind, g.keepId, styleIds, result);
    for (const id of styleIds) {
      const s = await figma.getStyleByIdAsync(id);
      if (s && !s.remote) {
        try { s.remove(); result.removed++; } catch (e) { pushReason(result, e && e.message ? e.message : 'Remove failed.'); }
      }
    }
  }
  return result;
}

function describeResult(label, r) {
  const parts = [];
  const noun = r.unit || 'style';
  if (r.created) parts.push(r.created + ' ' + noun + (r.created !== 1 ? 's' : '') + ' created');
  if (r.reused) parts.push(r.reused + ' reused');
  if (r.fromStyles) parts.push(r.fromStyles + ' taken from existing styles');
  if (r.bound) parts.push(r.bound + ' bound to variables');
  if (r.removed) parts.push(r.removed + ' ' + noun + (r.removed !== 1 ? 's' : '') + ' removed');
  if (r.merged) parts.push(r.merged + ' style' + (r.merged !== 1 ? 's' : '') + ' now linked to its variable');
  if (r.linked) parts.push(r.linked + ' style' + (r.linked !== 1 ? 's' : '') + ' linked');
  if (r.applied) parts.push(r.applied + ' layer' + (r.applied !== 1 ? 's' : '') + ' updated');
  if (r.skipped) parts.push(r.skipped + ' skipped');
  if (r.overrides) parts.push(r.overrides + ' as instance override' + (r.overrides !== 1 ? 's' : ''));
  if (r.components) parts.push(r.components + ' via main component');
  if (r.guide) parts.push('style guide added to the canvas');
  let msg = label + ': ' + (parts.length ? parts.join(', ') : 'nothing changed');
  if (r.reasons && r.reasons.length) msg += '. ' + r.reasons[0];
  return msg;
}

async function postStyleScan(kind) {
  const isPaint = kind === 'paint';
  const roots = await resolveScanRoots(isPaint ? lastColorRootIds : lastTextRootIds);
  if (!roots.length) {
    figma.ui.postMessage({ type: 'style-error', scope: isPaint ? 'colors' : 'text', message: 'No frame selected — select a frame on the canvas first.' });
    return;
  }
  const rootIds = roots.map(n => n.id);
  const data = isPaint ? await scanColors(roots) : await scanText(roots);
  data.rootName = roots.length === 1 ? roots[0].name : roots.length + ' layers';
  const record = { data: data, byKey: indexScanRows(data) };
  if (isPaint) { lastColorScan = record; lastColorRootIds = rootIds; }
  else { lastTextScan = record; lastTextRootIds = rootIds; }
  figma.ui.postMessage({ type: isPaint ? 'color-scan-result' : 'text-scan-result', data: data });
}

// Single entry point for every Colors / Typography tab message.
async function handleStyleMessage(msg) {
  const kind = msg.kind === 'text' ? 'text' : 'paint';
  const scope = kind === 'paint' ? 'colors' : 'text';
  const label = msg.label || 'Done';
  try {
    if (msg.type === 'style-scan') {
      // A Scan from the entry screen always uses the current selection.
      if (msg.fresh) {
        if (kind === 'paint') lastColorRootIds = []; else lastTextRootIds = [];
      }
      await postStyleScan(kind);
      return;
    }
    // commitUndo() closes the CURRENT undo group. Called only at the end, the
    // group it closes stretches back to the previous action — swallowing any
    // edit the user made on the canvas in between. Close that group first, so
    // one ⌘Z undoes exactly this action and nothing else.
    figma.commitUndo();

    let result;
    if (msg.type === 'style-rows') result = await runRowAction(kind, msg);
    else if (msg.type === 'style-create') {
      result = msg.target === 'variables'
        ? await createVariablesFromList(kind, msg)
        : await createStylesFromList(kind, msg);
    }
    else if (msg.type === 'style-merge') result = await mergeTokens(kind, msg.groups || [], msg);
    else if (msg.type === 'convert') {
      result = await runConversion(kind, msg);
    }
    else if (msg.type === 'merge-style-variable') {
      result = msg.direction === 'style'
        ? await mergeVariableIntoStyle(kind, msg.styleId, msg.uses || [])
        : await mergeStyleIntoVariable(kind, msg.styleId);
    }
    else if (msg.type === 'variable-delete') {
      result = { created: 0, applied: 0, skipped: 0, reasons: [], removed: 0, unit: 'variable' };
      const v = await figma.variables.getVariableByIdAsync(msg.variableId);
      if (v && !v.remote) { v.remove(); result.removed = 1; }
      else pushReason(result, 'That variable belongs to another file and cannot be deleted here.');
    }
    else if (msg.type === 'style-delete') {
      result = { created: 0, applied: 0, skipped: 0, reasons: [], removed: 0 };
      const style = await figma.getStyleByIdAsync(msg.styleId);
      if (style && !style.remote) { style.remove(); result.removed = 1; }
    } else return;

    if (result.conflict) {
      figma.ui.postMessage({ type: 'style-conflict', scope: scope, requestId: msg.requestId, names: result.conflict });
      return;
    }
    figma.commitUndo();
    const did = result.created || result.applied || result.removed || result.reused || result.merged;
    const ok = did && !result.skipped;
    figma.ui.postMessage({
      type: 'style-action-done', scope: scope, requestId: msg.requestId,
      message: describeResult(label, result),
      tone: ok ? 'success' : did ? 'warning' : 'error'
    });
    // Generate flows have no scan to refresh.
    if (msg.type !== 'style-create') await postStyleScan(kind);
  } catch (e) {
    // Whatever was written before the failure is its own undo step too,
    // rather than merging into the next action's group.
    try { figma.commitUndo(); } catch (e2) {}
    figma.ui.postMessage({ type: 'style-error', scope: scope, requestId: msg.requestId, message: e instanceof Error ? e.message : String(e) });
  }
}

async function postFontList() {
  const fonts = await figma.listAvailableFontsAsync();
  const map = new Map();
  for (const f of fonts) {
    const fam = f.fontName.family;
    if (!map.has(fam)) map.set(fam, []);
    const styles = map.get(fam);
    if (styles.indexOf(f.fontName.style) === -1) styles.push(f.fontName.style);
  }
  const list = Array.from(map.entries()).map(e => ({ family: e[0], styles: e[1] })).sort((a, b) => a.family.localeCompare(b.family));
  figma.ui.postMessage({ type: 'fonts-list', fonts: list });
}

// The genuine colors of a frame, read from the DESIGN PROPERTIES — every
// visible solid fill and stroke on the node tree, plus the stops of any
// gradient. No rasterising, so antialiased text edges, shadows and blended
// pixels can't invent colors that aren't in the design.
function collectFrameColors(roots) {
  var nodes = styleScanNodes(roots);
  var byKey = new Map();
  var add = function (color, opacity, weight) {
    if (!color || typeof color.r !== 'number') return;
    var hex = rgbToHexStr(color);
    var op = typeof opacity === 'number' ? opacity : 1;
    if (op <= 0.001) return;                       // fully transparent
    var k = colorKey(hex, op);
    var e = byKey.get(k);
    if (!e) { e = { hex: hex, opacity: op, n: 0 }; byKey.set(k, e); }
    e.n += weight || 1;
  };

  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    // Bigger elements carry more of the design's colour, so they rank higher.
    var area = (typeof node.width === 'number' && typeof node.height === 'number')
      ? Math.max(1, Math.round(node.width * node.height)) : 1;
    for (var pi = 0; pi < 2; pi++) {
      var prop = pi === 0 ? 'fills' : 'strokes';
      if (!(prop in node)) continue;
      var paints = node[prop];
      if (paints === figma.mixed || !Array.isArray(paints)) continue;
      for (var j = 0; j < paints.length; j++) {
        var paint = paints[j];
        if (!paint || paint.visible === false) continue;
        var alpha = typeof paint.opacity === 'number' ? paint.opacity : 1;
        if (paint.type === 'SOLID') {
          add(paint.color, alpha, prop === 'fills' ? area : Math.max(1, Math.round(area / 10)));
        } else if (paint.gradientStops && paint.gradientStops.length) {
          // A gradient's stops ARE design colours; the pixels between them are not.
          for (var g = 0; g < paint.gradientStops.length; g++) {
            var stop = paint.gradientStops[g];
            if (!stop || !stop.color) continue;
            var sa = (typeof stop.color.a === 'number' ? stop.color.a : 1) * alpha;
            add(stop.color, sa, Math.max(1, Math.round(area / paint.gradientStops.length)));
          }
        }
      }
    }
  }

  var out = [];
  byKey.forEach(function (e) { out.push(e); });
  out.sort(function (a, b) { return b.n - a.n; });
  return out.map(function (e) { return { hex: e.hex, opacity: e.opacity }; });
}

// Export what's selected on the canvas as a PNG, so colors can be extracted
// from artwork that's already in Figma. Dragging a layer out of the canvas
// into the plugin isn't possible — plugin UI runs in a null-origin iframe —
// so the selection is the route in.
async function exportSelectionImage() {
  var sel = figma.currentPage.selection;
  if (!sel.length) throw new Error('Select a frame, image or layer on the canvas first.');

  var node = null;
  for (var i = 0; i < sel.length; i++) {
    if (typeof sel[i].exportAsync === 'function') { node = sel[i]; break; }
  }
  if (!node) throw new Error('That selection can\'t be exported as an image — pick a frame, shape or image layer.');

  var w = typeof node.width === 'number' ? node.width : 0;
  var h = typeof node.height === 'number' ? node.height : 0;
  if (!w || !h) throw new Error('“' + node.name + '” has no size to export.');

  // Cap the long edge: colour extraction samples small anyway, and a huge
  // frame would make a needlessly large transfer.
  var longest = Math.max(w, h);
  var settings = { format: 'PNG' };
  if (longest > 512) settings.constraint = { type: 'SCALE', value: 512 / longest };

  var bytes = await node.exportAsync(settings);
  return { bytes: bytes, name: node.name };
}

async function focusNodes(ids) {
  const nodes = [];
  for (const id of ids || []) {
    try {
      const node = await figma.getNodeByIdAsync(id);
      if (node && 'visible' in node && isDescendantOrSelf(node, figma.currentPage.id)) nodes.push(node);
    } catch (e) {}
  }
  if (!nodes.length) {
    figma.notify('Those layers are no longer on this page.', { timeout: 2500 });
    return;
  }
  figma.currentPage.selection = nodes;
  figma.viewport.scrollAndZoomIntoView(nodes);
}

figma.ui.onmessage = async (msg) => {
  try {
    if (msg.type === 'run-audit') {
      captureSelectionIds();
      if (msg.createRevision) {
        figma.ui.postMessage({ type: 'busy', stage: 'Creating revision copy…' });
        const copies = await createRevisionCopies();
        if (copies.length) {
          figma.ui.postMessage({ type: 'revision-created', names: copies.map(n => n.name) });
        }
        captureSelectionIds();
      }
      figma.ui.postMessage({ type: 'busy', stage: 'Starting audit' });
      await markReportData();
      figma.ui.postMessage({ type: 'idle' });
      return;
    }
    if (msg.type === 'rename-generic') {
      captureSelectionIds();
      figma.ui.postMessage({ type: 'busy', stage: 'Renaming generic layers' });
      const result = await renameGenericLayers();
      const message = formatActionMessage('Rename generic layers', result);
      await markReportData(message);
      figma.ui.postMessage({ type: 'idle' });
      figma.notify(message, { timeout: 3000 });
      return;
    }
    if (msg.type === 'remove-hidden') {
      captureSelectionIds();
      figma.ui.postMessage({ type: 'busy', stage: 'Removing hidden layers' });
      const result = await removeHiddenLayers();
      const message = formatActionMessage('Remove hidden layers', result);
      await markReportData(message);
      figma.ui.postMessage({ type: 'idle' });
      figma.notify(message, { timeout: 3000 });
      return;
    }
    if (msg.type === 'add-export-settings') {
      captureSelectionIds();
      figma.ui.postMessage({ type: 'busy', stage: 'Marking exportable assets' });
      const result = await addExportSettings();
      const message = formatActionMessage('Mark exportable assets', result);
      await markReportData(message);
      figma.ui.postMessage({ type: 'idle' });
      figma.notify(message, { timeout: 3000 });
      return;
    }
    if (msg.type === 'flatten-vectors') {
      captureSelectionIds();
      figma.ui.postMessage({ type: 'busy', stage: 'Flattening vectors' });
      const result = await flattenSelectedVectorGroups();
      const message = formatActionMessage('Flatten vectors', result);
      await markReportData(message);
      figma.ui.postMessage({ type: 'idle' });
      figma.notify(message, { timeout: 3000 });
      return;
    }
    if (msg.type === 'convert-buttons') {
      captureSelectionIds();
      figma.ui.postMessage({ type: 'busy', stage: 'Converting buttons' });
      const result = await convertButtonsToAutoLayout();
      const message = formatActionMessage('Convert buttons', result);
      await markReportData(message);
      figma.ui.postMessage({ type: 'idle' });
      figma.notify(message, { timeout: 3000 });
      return;
    }
    if (msg.type === 'outline-strokes') {
      captureSelectionIds();
      figma.ui.postMessage({ type: 'busy', stage: 'Outlining strokes' });
      const result = await outlineStrokesInSelection();
      const message = formatActionMessage('Outline strokes', result);
      await markReportData(message);
      figma.ui.postMessage({ type: 'idle' });
      figma.notify(message, { timeout: 3000 });
      return;
    }
    if (msg.type === 'section-auto-layout') {
      captureSelectionIds();
      figma.ui.postMessage({ type: 'busy', stage: 'Making sections Auto Layout' });
      const result = await makeSectionsAutoLayout();
      const message = formatActionMessage('Make sections Auto Layout', result);
      await markReportData(message);
      figma.ui.postMessage({ type: 'idle' });
      figma.notify(message, { timeout: 3000 });
      return;
    }
    if (msg.type === 'focus-node') {
      captureSelectionIds();
      const node = await figma.getNodeByIdAsync(msg.nodeId);
      if (node && 'visible' in node) {
        figma.currentPage.selection = [node];
        figma.viewport.scrollAndZoomIntoView([node]);
      }
      return;
    }
    if (msg.type === 'ignore-issue') {
      if (msg.nodeId && msg.issueType) {
        ignoredIssueKeys.add(`${msg.nodeId}:${msg.issueType}`);
      }
      return;
    }
    if (msg.type === 'ignore-issues-bulk') {
      for (const pair of (msg.pairs || [])) {
        if (pair.nodeId && pair.issueType) {
          ignoredIssueKeys.add(`${pair.nodeId}:${pair.issueType}`);
        }
      }
      return;
    }
    if (msg.type === 'clear-ignored') {
      captureSelectionIds();
      ignoredIssueKeys = new Set();
      const report = await collectIssues();
      storeAudit(report);
      figma.ui.postMessage({ type: 'report', report, extraMessage: 'Ignored issues cleared.' });
      await restoreSelectionIds();
      return;
    }
    if (msg.type === 'prompt-select-frame') {
      figma.notify('Click on a frame or component in the canvas to select it', { timeout: 3000 });
      return;
    }
    if (msg.type === 'style-scan' || msg.type === 'style-rows' || msg.type === 'style-create' || msg.type === 'style-merge' || msg.type === 'style-delete' || msg.type === 'variable-delete' || msg.type === 'merge-style-variable' || msg.type === 'convert') {
      await handleStyleMessage(msg);
      return;
    }
    if (msg.type === 'uikit-scan' || msg.type === 'uikit-save-breakpoints' ||
        msg.type === 'uikit-generate' || msg.type === 'uikit-bind' ||
        msg.type === 'uikit-preview' || msg.type === 'uikit-parse' ||
        msg.type === 'uikit-reseed' || msg.type === 'uikit-infer' ||
        msg.type === 'uikit-responsive' || msg.type === 'uikit-elements' ||
        msg.type === 'uikit-build' || msg.type === 'uikit-preview-table') {
      await handleUiKitMessage(msg);
      return;
    }
    if (msg.type === 'count-token-uses') {
      const counts = {};
      for (const item of (msg.items || [])) {
        try { counts[item.id] = await countTokenUsesInFile(item.kind, item.id); }
        catch (e) { counts[item.id] = null; }
      }
      figma.ui.postMessage({ type: 'token-use-counts', requestId: msg.requestId, counts: counts });
      return;
    }
    if (msg.type === 'list-fonts') {
      await postFontList();
      return;
    }
    if (msg.type === 'export-selection') {
      try {
        const shot = await exportSelectionImage();
        // The PNG is only ever the thumbnail. Colors come from the design
        // properties, so nothing is invented by rasterising.
        const colors = collectFrameColors(figma.currentPage.selection);
        figma.ui.postMessage({ type: 'selection-image', bytes: shot.bytes, name: shot.name, colors: colors });
      } catch (e) {
        figma.ui.postMessage({ type: 'selection-image-error', message: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    if (msg.type === 'focus-nodes') {
      await focusNodes(msg.nodeIds);
      return;
    }
    if (msg.type === 'collect-texts') {
      if (!figma.currentPage.selection.length) {
        figma.ui.postMessage({ type: 'no-selection' });
        return;
      }
      const scopeNodes = getScopeNodes();
      const entries = getAllNodes(scopeNodes);
      const texts = [];
      const seen = new Set();
      for (const { node } of entries) {
        if (node.type === 'TEXT' && node.characters && node.characters.trim() && !seen.has(node.id)) {
          seen.add(node.id);
          texts.push({ id: node.id, text: node.characters, path: nodePath(node) });
        }
      }
      figma.ui.postMessage({ type: 'texts-collected', texts });
      return;
    }
    if (msg.type === 'resize') {
      figma.ui.resize(
        Math.min(1200, Math.max(400, msg.width  || 760)),
        Math.min(960,  Math.max(400, msg.height || 860))
      );
      return;
    }
    if (msg.type === 'close') {
      figma.closePlugin();
      return;
    }
  } catch (error) {
    figma.ui.postMessage({ type: 'idle' });
    figma.ui.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};

figma.ui.postMessage({ type: 'report', initial: true, report: { scope: 'page', stats: { checkedNodes: 0, genericNames: 0, hiddenLayers: 0, deepNesting: 0, missingTextStyles: 0, missingColorStyles: 0, buttonsWithoutAutoLayout: 0, sectionsWithoutAutoLayout: 0, missingExportSettings: 0, vectorsToFlatten: 0, masksFound: 0, lineObjects: 0, actionable: {} }, issues: [] } });
