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

function useRef(node, prop, multi, paintInfo) {
  const u = { id: node.id, name: node.name, path: shortPath(node), type: node.type, prop: prop, multi: !!multi, inst: isInInstance(node) };
  if (paintInfo) u.paints = paintInfo;
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

const ICON_TYPES = ['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'POLYGON', 'LINE'];

function colorRoleOf(use) {
  if (use.prop === 'strokes') return 'Border';
  if (use.type === 'TEXT') return 'Text';
  if (ICON_TYPES.indexOf(use.type) !== -1) return 'Icon';
  return 'Fill';
}

// "Text / Dark Gray", "Brand / Blue", "Neutral / White / 6%" …
function suggestColorName(hex, opacity, uses, taken) {
  const shade = colorShade(hex);
  const counts = {};
  for (const u of uses) {
    const role = colorRoleOf(u);
    counts[role] = (counts[role] || 0) + 1;
  }
  let group = shade.neutral ? 'Neutral' : 'Brand';
  for (const role of ['Text', 'Border', 'Icon']) {
    if (uses.length && (counts[role] || 0) / uses.length >= 0.7) { group = role; break; }
  }
  const pct = opPct(opacity);
  const base = group + ' / ' + shade.name + (pct < 100 ? ' / ' + pct + '%' : '');
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
  const localUse = new Map();   // local styleId -> uses
  const remoteUse = new Map();  // remote styleId -> { style, uses }
  const remoteVarUse = new Map(); // remote variableId -> { name, hex, opacity, uses }
  const unlinked = new Map();   // colorKey -> { hex, opacity, uses }

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    for (const prop of ['fills', 'strokes']) {
      if (!(prop in node)) continue;
      const paints = node[prop];
      if (paints === figma.mixed || !Array.isArray(paints) || !paints.length) continue;
      const styleProp = prop === 'fills' ? 'fillStyleId' : 'strokeStyleId';
      const sid = styleProp in node ? node[styleProp] : '';
      if (sid === figma.mixed) continue;
      if (typeof sid === 'string' && sid) {
        const style = await getStyleCached(cache, sid);
        if (!style) continue;
        if (localIds.has(sid) && !style.remote) {
          if (!localUse.has(sid)) localUse.set(sid, []);
          localUse.get(sid).push(useRef(node, prop));
        } else {
          if (!remoteUse.has(sid)) remoteUse.set(sid, { style: style, uses: [] });
          remoteUse.get(sid).uses.push(useRef(node, prop));
        }
        continue;
      }
      const solids = paints.filter(p => p.type === 'SOLID' && p.visible !== false);
      // A style replaces every paint on the layer, so only single-paint
      // layers can be linked automatically.
      const multi = !(paints.length === 1 && solids.length === 1);
      const paintInfo = multi ? describePaints(paints, prop) : null;
      for (const p of solids) {
        if (p.boundVariables && p.boundVariables.color) {
          // Local variables count as linked; variables from another file don't.
          const rv = await resolveColorVariable(varCache, p.boundVariables.color.id);
          if (rv && rv.remote) {
            const vid = p.boundVariables.color.id;
            const op = (typeof rv.color.a === 'number' ? rv.color.a : 1) * (typeof p.opacity === 'number' ? p.opacity : 1);
            if (!remoteVarUse.has(vid)) remoteVarUse.set(vid, { name: rv.name, hex: rgbToHexStr(rv.color), opacity: op, uses: [] });
            remoteVarUse.get(vid).uses.push(useRef(node, prop, multi, paintInfo));
          }
          continue;
        }
        const hex = rgbToHexStr(p.color);
        const op = typeof p.opacity === 'number' ? p.opacity : 1;
        const k = colorKey(hex, op);
        if (!unlinked.has(k)) unlinked.set(k, { hex: hex, opacity: op, uses: [] });
        unlinked.get(k).uses.push(useRef(node, prop, multi, paintInfo));
      }
    }
    if ((i + 1) % 300 === 0) {
      figma.ui.postMessage({ type: 'style-progress', scope: 'colors', completed: i + 1, total: nodes.length });
      await pause();
    }
  }

  const taken = new Set(locals.map(s => s.name));
  const matchLocalById = new Map();
  const addLocalMatch = (style, hex, opacity, uses) => {
    if (!matchLocalById.has(style.id)) {
      matchLocalById.set(style.id, { key: 'l:' + style.id, styleId: style.id, styleName: style.name, hex: hex, opacity: opacity, uses: [] });
    }
    Array.prototype.push.apply(matchLocalById.get(style.id).uses, uses);
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
      addLocalMatch(twin, sp.hex, sp.opacity, r.uses);
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
    if (twin) { addLocalMatch(twin, rv.hex, rv.opacity, rv.uses); continue; }
    const row = { key: 'v:' + vid, variableId: vid, name: rv.name, source: 'variable', hex: rv.hex, opacity: rv.opacity, uses: rv.uses.slice() };
    matchRemote.push(row);
    if (!remoteByKey.has(k)) remoteByKey.set(k, row);
  }

  const newColors = [];
  for (const [k, e] of unlinked) {
    const local = localByKey.get(k);
    if (local) { addLocalMatch(local, e.hex, e.opacity, e.uses); continue; }
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

  // Near-duplicates across ALL local styles: same opacity and practically the
  // same color (CIE Lab ΔE < 3). Same color at a different opacity is usually
  // a deliberate overlay, so it's only flagged, never offered for merging.
  const pool = [];
  for (const s of locals) {
    const sp = solidOfStyle(s);
    if (!sp) continue;
    pool.push({ id: s.id, name: s.name, hex: sp.hex, opacity: sp.opacity, lab: hexToLab(sp.hex), uses: (localUse.get(s.id) || []).length });
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

  return {
    colorStyles: colorStyles,
    newColors: newColorsFixable,
    matchLocal: matchLocal,
    matchRemote: matchRemoteFixable,
    nearDupes: nearDupes,
    opacityVariants: opacityVariants,
    manual: manual,
    summary: {
      localStyles: colorStyles.length,
      remoteStyles: matchRemoteFixable.length,
      detached: newColorsFixable.length + matchLocal.length + matchRemoteFixable.length,
      detachedLayers: detachedLayers.size,
      manualLayers: manualLayers.size,
      instanceLayers: instanceLayers,
      dupes: nearDupes.length,
      scannedNodes: nodes.length
    }
  };
}

function stripLab(p) {
  return { id: p.id, name: p.name, hex: p.hex, opacity: p.opacity, uses: p.uses };
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
  let mixedSkipped = 0;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.fontSize !== figma.mixed) {
      const sz = Math.round(node.fontSize);
      if (sz > 0) sizeFreq.set(sz, (sizeFreq.get(sz) || 0) + 1);
    }
    if (node.fontName !== figma.mixed) {
      const fam = node.fontName.family;
      if (!famMap.has(fam)) famMap.set(fam, { family: fam, styles: new Set(), count: 0 });
      famMap.get(fam).styles.add(node.fontName.style);
      famMap.get(fam).count++;
    }

    const sid = node.textStyleId;
    if (sid === figma.mixed) { mixedSkipped++; continue; }
    if (typeof sid === 'string' && sid) {
      const style = await getStyleCached(cache, sid);
      if (!style) continue;
      if (localIds.has(sid) && !style.remote) {
        if (!localUse.has(sid)) localUse.set(sid, []);
        localUse.get(sid).push(useRef(node, 'text'));
      } else {
        if (!remoteUse.has(sid)) remoteUse.set(sid, { style: style, uses: [] });
        remoteUse.get(sid).uses.push(useRef(node, 'text'));
      }
      continue;
    }
    if (hasTextVariableBinding(node)) continue;
    const spec = textSpecOfNode(node);
    if (!spec) { mixedSkipped++; continue; }
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

  const matchLocalById = new Map();
  const addLocalMatch = (style, uses) => {
    if (!matchLocalById.has(style.id)) {
      matchLocalById.set(style.id, { key: 'l:' + style.id, styleId: style.id, styleName: style.name, styleSpec: textSpecOfStyle(style), spec: textSpecOfStyle(style), uses: [] });
    }
    Array.prototype.push.apply(matchLocalById.get(style.id).uses, uses);
  };

  const matchRemote = [];
  const remoteByKey = new Map();
  for (const [sid, r] of remoteUse) {
    const spec = textSpecOfStyle(r.style);
    const k = textSpecKey(spec);
    const twin = localByNameKey.get(r.style.name + '||' + k) || localByKey.get(k);
    if (twin) { addLocalMatch(twin, r.uses); continue; }
    const row = { key: 'r:' + sid, styleId: sid, name: r.style.name, spec: spec, styleSpec: spec, uses: r.uses.slice() };
    matchRemote.push(row);
    if (!remoteByKey.has(k)) remoteByKey.set(k, row);
  }

  const taken = new Set(locals.map(s => s.name));
  const newText = [];
  for (const [k, e] of unlinked) {
    const local = localByKey.get(k);
    if (local) { addLocalMatch(local, e.uses); continue; }
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
    .map(f => ({ family: f.family, styles: Array.from(f.styles).sort(), count: f.count }))
    .sort((a, b) => b.count - a.count);
  const typeSizeInfo = Array.from(sizeFreq.entries()).map(e => ({ size: e[0], count: e[1] })).sort((a, b) => b.size - a.size);

  const unlinkedLayers = new Set();
  let instanceLayers = 0;
  for (const list of [newText, matchLocal, matchRemote]) for (const r of list) for (const u of r.uses) if (u.inst) instanceLayers++;
  for (const r of newText) for (const u of r.uses) unlinkedLayers.add(u.id);
  for (const r of matchLocal) for (const u of r.uses) unlinkedLayers.add(u.id);
  for (const r of matchRemote) for (const u of r.uses) unlinkedLayers.add(u.id);

  return {
    textStyles: textStyles,
    newText: newText,
    matchLocal: matchLocal,
    matchRemote: matchRemote,
    duplicates: duplicates,
    fontFamilies: fontFamilies,
    typeSizeInfo: typeSizeInfo,
    summary: {
      localStyles: textStyles.length,
      remoteStyles: matchRemote.length,
      unlinked: newText.length + matchLocal.length + matchRemote.length,
      unlinkedLayers: unlinkedLayers.size,
      dupes: duplicates.length,
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
  for (const n of names) if (existing.has(n) && out.indexOf(n) === -1) out.push(n);
  return out;
}

async function createOrUpdatePaintStyle(name, paints, conflict, existing) {
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
  await figma.loadFontAsync(fontName);
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

async function applyStyleToUses(kind, style, uses, result) {
  if (kind === 'text') {
    try { await figma.loadFontAsync(style.fontName); } catch (e) {
      result.skipped += uses.length;
      pushReason(result, 'Font "' + style.fontName.family + ' ' + style.fontName.style + '" is not available.');
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
    const doneKey = node.id + '|' + u.prop;
    if (result.done && result.done.has(doneKey)) { result.applied++; continue; }
    try {
      if (kind === 'text') {
        await loadTextNodeFonts(node);
        await node.setTextStyleIdAsync(style.id);
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

  if (msg.action === 'apply') {
    for (const x of rows) {
      const style = await figma.getStyleByIdAsync(x.row.styleId);
      if (!style) { result.skipped += x.row.uses.length; continue; }
      await applyStyleToUses(kind, style, x.row.uses, result);
    }
    return result;
  }

  const names = rows.map(x => (x.ref.name || '').trim() || x.row.suggested || x.row.name);
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
  for (const item of items) {
    try {
      const style = kind === 'paint'
        ? await createOrUpdatePaintStyle(item.name, [{ type: 'SOLID', color: hexToRgb01(item.hex), opacity: item.opacity }], msg.conflict, existing)
        : await createOrUpdateTextStyle(item.name, item, msg.conflict, existing);
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

async function mergeStyles(kind, groups) {
  const result = { created: 0, applied: 0, skipped: 0, reasons: [], removed: 0 };
  await figma.loadAllPagesAsync();
  for (const g of groups) {
    const keep = await figma.getStyleByIdAsync(g.keepId);
    if (!keep) { pushReason(result, 'Style to keep no longer exists.'); continue; }
    await relinkStylesInFile(kind, g.keepId, g.removeIds, result);
    for (const id of g.removeIds) {
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
  if (r.created) parts.push(r.created + ' style' + (r.created !== 1 ? 's' : '') + ' created');
  if (r.removed) parts.push(r.removed + ' style' + (r.removed !== 1 ? 's' : '') + ' removed');
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
    let result;
    if (msg.type === 'style-rows') result = await runRowAction(kind, msg);
    else if (msg.type === 'style-create') result = await createStylesFromList(kind, msg);
    else if (msg.type === 'style-merge') result = await mergeStyles(kind, msg.groups || []);
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
    const ok = (result.created || result.applied || result.removed) && !result.skipped;
    figma.ui.postMessage({
      type: 'style-action-done', scope: scope, requestId: msg.requestId,
      message: describeResult(label, result),
      tone: ok ? 'success' : (result.created || result.applied || result.removed) ? 'warning' : 'error'
    });
    // Generate flows have no scan to refresh.
    if (msg.type !== 'style-create') await postStyleScan(kind);
  } catch (e) {
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
    if (msg.type === 'style-scan' || msg.type === 'style-rows' || msg.type === 'style-create' || msg.type === 'style-merge' || msg.type === 'style-delete') {
      await handleStyleMessage(msg);
      return;
    }
    if (msg.type === 'list-fonts') {
      await postFontList();
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
