// ── The four sampled real designs, as regression cases ───────────────────
//
// Every number below was measured from ea5joxg8ao02SQFakDKifb via
// get_design_context, not invented for the test. Each section reproduces one
// design's actual structure and asserts the extraction handles what that
// design does differently.
var ONMSGR = figma.ui.onmessage;
function freshR() {
  resetFigma(); figma.ui.onmessage = ONMSGR; globalThis.__posted = [];
  figma._fonts = ['Inter|Regular', 'Inter|Medium', 'Inter|Semi Bold'];
}
var pass = 0, fail = 0;
function ok(c, l) { if (c) pass++; else { fail++; print('  FAIL: ' + l); } }
function eq(a, b, l) { ok(a === b, l + '  (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }
function solid(hex) {
  var n = parseInt(hex.replace('#', ''), 16);
  return { type: 'SOLID', color: { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }, opacity: 1 };
}
var CFG = { preset: 'custom', breakpoints: [
  { name: 'Desktop', width: 1440 }, { name: 'Tablet', width: 768 }, { name: 'Mobile', width: 375 }] };
function cfgFor(w) {
  return { preset: 'custom', breakpoints: [
    { name: 'Desktop', width: w }, { name: 'Tablet', width: 768 }, { name: 'Mobile', width: 375 }] };
}
function rowNamed(rows, n) { return rows.filter(function (r) { return r.name === n; })[0]; }

async function run() {
  // ══ 1 ══ CLINICAL — reuse the file's own variables, do not duplicate ══
  // Measured: section padding 80 × 96, products grid gap 32, button radius 8,
  // body 16/24, H2 40. The file already defines Container Margin 80,
  // Padding/5XL 96, Space Between/LG 32, Size/Body/Base 16.
  freshR();
  var own = figma.variables.createVariableCollection('Clinical tokens');
  own.addMode('Value');
  function ownVar(name, value, scopes) {
    var v = figma.variables.createVariable(name, own, 'FLOAT');
    try { v.scopes = scopes; } catch (e) {}
    v.setValueForMode(own.modes[0].modeId, value);
    return v;
  }
  var vMargin = ownVar('Container Margin', 80, ['GAP']);
  var vPad5xl = ownVar('Padding/5XL', 96, ['GAP']);
  var vSpaceLg = ownVar('Space Between/LG', 32, ['GAP']);
  var vBodyBase = ownVar('Size/Body/Base', 16, ['FONT_SIZE']);
  var vBtnRadius = ownVar('Border Radius/Button-radius', 8, ['CORNER_RADIUS']);

  var clinical = mkFrame({ name: 'clinical-range-section', width: 1440, height: 950 });
  clinical.layoutMode = 'VERTICAL';
  clinical.paddingLeft = 80; clinical.paddingRight = 80;
  clinical.paddingTop = 96; clinical.paddingBottom = 96;
  clinical.itemSpacing = 40;
  figma.currentPage.appendChild(clinical);
  var grid = mkFrame({ name: 'products-grid', width: 1280, height: 617 });
  grid.layoutMode = 'HORIZONTAL'; grid.itemSpacing = 32;
  clinical.appendChild(grid);
  for (var c = 0; c < 3; c++) {
    var card = mkFrame({ name: 'product-card-0', width: 405, height: 617 });
    card.layoutMode = 'VERTICAL'; card.paddingTop = 20; card.paddingBottom = 20;
    card.itemSpacing = 10; card.cornerRadius = 30; card.fills = [solid('#FFFFFF')];
    grid.appendChild(card);
    var h4 = mkText('Workplace Solutions', 'H4'); h4.fontSize = 24;
    h4.fills = [solid('#072730')]; card.appendChild(h4);
    var body = mkText('Keep employees comfortable and productive on the job across every site.', 'Body');
    body.fontSize = 16; body.lineHeight = { unit: 'PIXELS', value: 24 };
    body.fills = [solid('#2f2f31')]; card.appendChild(body);
    var btn = mkFrame({ name: 'Standard Button', width: 220, height: 40 });
    btn.layoutMode = 'HORIZONTAL'; btn.paddingLeft = 24; btn.paddingRight = 24;
    btn.paddingTop = 10; btn.paddingBottom = 10; btn.cornerRadius = 8;
    btn.fills = [solid('#d22526')];
    btn.appendChild(mkText('Explore Workplace Relief', 'Label'));
    card.appendChild(btn);
  }
  var h2 = mkText('Solutions Built for Your Care Setting', 'H2');
  h2.fontSize = 40; h2.fills = [solid('#072730')];
  clinical.appendChild(h2);

  figma.currentPage.selection = [clinical];
  var r1 = await buildFromExistingFile({ styleChoice: 'keep' });
  ok(!!r1.measured, 'clinical: it measured the frame');
  ok(Array.isArray(r1.reused), 'clinical: it reports what it reused');
  var reusedNames = (r1.reused || []).map(function (x) { return x.existing; });
  ok(reusedNames.indexOf('Container Margin') !== -1,
     'clinical: 80px reuses Container Margin  (' + reusedNames.join(', ') + ')');
  ok(reusedNames.indexOf('Padding/5XL') !== -1, 'clinical: 96px reuses Padding/5XL');
  ok(reusedNames.indexOf('Space Between/LG') !== -1, 'clinical: 32px reuses Space Between/LG');

  // and no competing token was written for those values
  var made = (await localVariablesAllModes('FLOAT')).map(function (e) { return e.variable.name; });
  var kitCols = await getUiKitCollections(false);
  var kitFloats = (await localVariablesAllModes('FLOAT')).filter(function (e) {
    return e.variable.variableCollectionId !== own.id;
  });
  var dupes = [];
  for (var d = 0; d < kitFloats.length; d++) {
    var v = kitFloats[d].resolved[Object.keys(kitFloats[d].resolved)[0]];
    if (v === 80 || v === 96 || v === 32) dupes.push(kitFloats[d].variable.name + '=' + v);
  }
  eq(dupes.length, 0, 'clinical: no second variable for a value the file already had  (' + dupes.join(', ') + ')');

  // the padding is now driven by the file's OWN variable, by name
  async function boundName(node, field) {
    var b = node.boundVariables && node.boundVariables[field];
    if (!b) return null;
    var v = await figma.variables.getVariableByIdAsync(b.id);
    return v ? v.name : null;
  }
  eq(await boundName(clinical, 'paddingLeft'), 'Container Margin',
     'clinical: the 80px padding now follows the file\u2019s own Container Margin');
  eq(await boundName(clinical, 'paddingTop'), 'Padding/5XL',
     'clinical: and the 96px padding follows Padding/5XL');
  eq(await boundName(grid, 'itemSpacing'), 'Space Between/LG',
     'clinical: and the 32px gap follows Space Between/LG');

  // a radius of 8 must not pick up a spacing variable that happens to be 8
  var btn0 = grid.children[0].children.filter(function (n) { return n.name === 'Standard Button'; })[0];
  var radiusVar = btn0 ? await boundName(btn0, 'cornerRadius') : null;
  ok(radiusVar === null || /radius/i.test(radiusVar),
     'clinical: a corner radius only ever binds to a radius variable  (' + radiusVar + ')');

  // ══ 2 ══ GROWTH SYSTEM — two containers, and a real multi-column row ══
  // Measured: page 1440, dominant container 1248 (margin 96, x11), a second
  // at 928 (margin 256, x4). Rows of equal cards are the grid; a heading
  // stacked over a paragraph is not.
  freshR();
  var growth = mkFrame({ name: 'Growth System page', width: 1440, height: 3000 });
  figma.currentPage.appendChild(growth);
  for (var sIdx = 0; sIdx < 11; sIdx++) {
    var band = mkFrame({ name: 'Section ' + sIdx, width: 1440, height: 600 });
    growth.appendChild(band);
    var wide = mkFrame({ name: 'Container', width: 1248, height: 500 });
    band.appendChild(wide);
    // a genuine 3-column row of equal cards, side by side
    var row = mkFrame({ name: 'Cards', width: 1248, height: 300 });
    row.layoutMode = 'HORIZONTAL'; row.itemSpacing = 24;
    wide.appendChild(row);
    for (var k = 0; k < 3; k++) {
      var cell = mkFrame({ name: 'Card', width: 400, height: 300 });
      cell.y = 0;
      row.appendChild(cell);
    }
    // a heading stacked above a paragraph — equal widths, NOT a grid
    var stack = mkFrame({ name: 'Copy', width: 1248, height: 200 });
    wide.appendChild(stack);
    var head = mkFrame({ name: 'Heading', width: 1248, height: 60 }); head.y = 0;
    var para = mkFrame({ name: 'Paragraph', width: 1248, height: 120 }); para.y = 80;
    stack.appendChild(head); stack.appendChild(para);
  }
  for (var n2 = 0; n2 < 4; n2++) {
    var band2 = mkFrame({ name: 'Narrow band ' + n2, width: 1440, height: 400 });
    growth.appendChild(band2);
    band2.appendChild(mkFrame({ name: 'Container', width: 928, height: 300 }));
  }
  var box = measureContainers(growth);
  var widths = box.containers.map(function (x) { return x.width; });
  ok(widths.indexOf(1248) !== -1, 'growth: the 1248 container is found  (' + widths.join(', ') + ')');
  ok(widths.indexOf(928) !== -1, 'growth: and so is the 928 one');
  eq(box.margin, 96, 'growth: the dominant margin is the one that repeats most');
  ok(box.confidence >= 11, 'growth: reported with the count behind it  (' + box.confidence + ')');

  var g = measureGrid(growth);
  eq(g.columns, 3, 'growth: the three-card row is the grid');
  eq(g.repeated, true, 'growth: and it repeats, so it is trusted');
  var m2 = await measureDesign(growth, CFG);
  ok(!!rowNamed(m2.rows, 'container/max'), 'growth: the dominant container becomes a token');
  ok(!!rowNamed(m2.rows, 'container/narrow'), 'growth: and the second one does too');

  // ══ 3 ══ COMMERCIAL CHIMNEY — H5/H6 below body, mixed units ═══════════
  // Measured: H1 80, H2 55, H3 28, Body 19, H5 16, H6 12, eyebrow 12 with
  // letterSpacing 20% (= 2.4px at 12px). Line heights appear as AUTO, as
  // 35px, and as 160%.
  freshR();
  var chim = mkFrame({ name: 'Commercial Chimney', width: 1920, height: 2000 });
  figma.currentPage.appendChild(chim);
  function txt(parent, chars, size, lh) {
    var t = mkText(chars, 'T'); t.fontSize = size;
    if (lh) t.lineHeight = lh;
    t.fills = [solid('#111111')];
    parent.appendChild(t);
    return t;
  }
  txt(chim, 'Our Simple 4 Step Chimney Cleaning Process', 55, { unit: 'AUTO' });
  txt(chim, 'Consultation and Scheduling', 28, { unit: 'PIXELS', value: 35 });
  for (var b3 = 0; b3 < 6; b3++) {
    txt(chim, 'We discuss your property needs and schedule a professional chimney service at a time that suits you.',
        18, { unit: 'PERCENT', value: 160 });
  }
  txt(chim, 'OUR 4 STEP', 12, { unit: 'AUTO' });
  var type3 = await measureTypeSizes(styleScanNodes([chim]));
  var names3 = type3.steps.map(function (x) { return x.name + ':' + x.size; });
  eq(type3.body, 18, 'chimney: body is the size most of the words use  (' + names3.join(' ') + ')');
  var h1s = type3.steps.filter(function (x) { return x.name === 'h1'; })[0];
  eq(h1s && h1s.size, 55, 'chimney: the largest size is H1');
  var smalls = type3.steps.filter(function (x) { return x.size === 12; })[0];
  ok(!!smalls && smalls.name !== 'h1', 'chimney: the 12px label is not promoted to a heading  (' + (smalls && smalls.name) + ')');
  var lead = measureLeading(styleScanNodes([chim]));
  ok(lead.length >= 1, 'chimney: leading is read across the mixed units  (' + lead.map(function (x) { return x.value; }).join(', ') + ')');
  ok(lead.some(function (x) { return Math.abs(x.value - 160) < 6; }), 'chimney: including the 160% one');

  // ══ 4 ══ BIG DOT — styled runs, negative coordinates, no auto layout ══
  // Measured: hero text node reports fontSize 0 with runs at 88px; children
  // at x = -638 and x = -406; the section is absolutely positioned.
  freshR();
  var bigdot = mkFrame({ name: 'Header 1', width: 1920, height: 1084 });
  figma.currentPage.appendChild(bigdot);
  // scenery parked outside the frame — must not become a margin
  var scenery = mkFrame({ name: 'Mask group', width: 2604, height: 1073 });
  scenery.x = -638; bigdot.appendChild(scenery);
  var scenery2 = mkFrame({ name: 'Ellipse', width: 1336, height: 1336 });
  scenery2.x = -406; bigdot.appendChild(scenery2);
  // the real content column, in bounds
  for (var q = 0; q < 3; q++) {
    var col = mkFrame({ name: 'Content', width: 1414, height: 300 });
    col.x = 253; col.y = q * 320;
    bigdot.appendChild(col);
  }
  // a hero headline whose node-level size is 0, with the real size in a run
  var hero = mkText('Lighting the Future of Business', 'Hero');
  hero.fontSize = 0;
  hero.getStyledTextSegments = function () {
    return [{ start: 0, end: 31, characters: 'Lighting the Future of Business',
              fontName: { family: 'Figtree', style: 'Bold' }, fontSize: 88,
              lineHeight: { unit: 'AUTO' }, letterSpacing: { unit: 'PIXELS', value: -2.64 },
              textCase: 'ORIGINAL', textDecoration: 'NONE', fillStyleId: '', textStyleId: '',
              fills: [solid('#FFFFFF')], boundVariables: {} }];
  };
  hero.fills = [solid('#FFFFFF')];
  bigdot.appendChild(hero);
  for (var bd = 0; bd < 4; bd++) {
    var para2 = mkText('Whether you are operating a car wash or managing a large commercial facility we help.', 'Body');
    para2.fontSize = 22; para2.fills = [solid('#FFFFFF')];
    bigdot.appendChild(para2);
  }

  var type4 = await measureTypeSizes(styleScanNodes([bigdot]));
  var sizes4 = type4.steps.map(function (x) { return x.name + ':' + x.size; });
  var h1b = type4.steps.filter(function (x) { return x.name === 'h1'; })[0];
  eq(h1b && h1b.size, 88, 'bigdot: the 88px headline is recovered from its run  (' + sizes4.join(' ') + ')');
  eq(type4.body, 22, 'bigdot: and body is still the most-used size');
  eq(type4.mixedRuns >= 0, true, 'bigdot: mixed-run layers are counted');

  var box4 = measureContainers(bigdot);
  eq(box4.outOfBounds, 2, 'bigdot: both out-of-bounds layers are excluded');
  eq(box4.margin, 253, 'bigdot: the margin comes from the in-bounds column  (' + box4.margin + ')');
  ok(box4.confidence >= 3, 'bigdot: with three measurements behind it  (' + box4.confidence + ')');

  // no auto layout anywhere, so spacing falls back to the gaps
  var m4 = await measureDesign(bigdot, cfgFor(1920));
  ok(m4.measured.coverage.absoluteContainers > 0, 'bigdot: hand-placed containers are reported');
  ok(m4.measured.spacingFromGaps === true || m4.measured.spacing.length > 0,
     'bigdot: spacing is read from the gaps rather than left empty');
  var fabricated = m4.rows.filter(function (r) {
    return r.name.indexOf('space/') === 0 &&
           r.values[UIKIT_VALUE_KEY] < 4;
  });
  eq(fabricated.length, 0, 'bigdot: nothing under 4px is called a spacing step');

  // ══ 5 ══ LEFT-ALIGNED containers — stop assuming everything is centred ══
  freshR();
  var leftPage = mkFrame({ name: 'Left aligned', width: 1440, height: 2000 });
  figma.currentPage.appendChild(leftPage);
  for (var la = 0; la < 6; la++) {
    var band = mkFrame({ name: 'Band ' + la, width: 1440, height: 300 });
    band.y = la * 320;
    leftPage.appendChild(band);
    var col = mkFrame({ name: 'Column', width: 1000, height: 260 });
    col.x = 80;                    // 80 left, 360 right — clearly not centred
    band.appendChild(col);
  }
  var lb = measureContainers(leftPage);
  eq(lb.alignment, 'left', 'left-aligned: the alignment is read from the coordinates');
  eq(lb.margin, 80, 'left-aligned: and the margin is the real left inset, not half the slack');
  ok(lb.confidence >= 6, 'left-aligned: with the count behind it  (' + lb.confidence + ')');

  // a page whose coordinates say nothing falls back, and says that it did
  freshR();
  var noXPage = mkFrame({ name: 'No coordinates', width: 1440, height: 1200 });
  figma.currentPage.appendChild(noXPage);
  for (var nx = 0; nx < 4; nx++) {
    var b2 = mkFrame({ name: 'Band', width: 1440, height: 280 });
    noXPage.appendChild(b2);
    b2.appendChild(mkFrame({ name: 'Column', width: 1200, height: 240 }));   // x left at 0
  }
  var nb = measureContainers(noXPage);
  eq(nb.alignment, 'assumed-centred', 'no coordinates: it says the centring was assumed');
  eq(nb.margin, 120, 'no coordinates: and still produces a usable margin');

  // ══ 6 ══ a ONE-OFF section container keeps its own width ═══════════════
  freshR();
  var mixPage = mkFrame({ name: 'Mixed', width: 1440, height: 3000 });
  figma.currentPage.appendChild(mixPage);
  for (var mp = 0; mp < 8; mp++) {
    var wideBand = mkFrame({ name: 'Wide band ' + mp, width: 1440, height: 300 });
    mixPage.appendChild(wideBand);
    wideBand.appendChild(mkFrame({ name: 'Container', width: 1248, height: 260 }));
  }
  var oneOff = mkFrame({ name: 'Quote band', width: 1440, height: 300 });
  mixPage.appendChild(oneOff);
  oneOff.appendChild(mkFrame({ name: 'Narrow quote', width: 880, height: 260 }));
  var mb = measureContainers(mixPage);
  var found = mb.containers.map(function (c) { return c.width + ':' + c.scope; });
  ok(found.indexOf('1248:page') !== -1, 'one-off: the page column is scoped to the page  (' + found.join(' ') + ')');
  ok(found.indexOf('880:section') !== -1, 'one-off: and the single band keeps its own, marked as a section');

  // ══ 7 ══ LETTER SPACING — px and percent are not the same thing ════════
  freshR();
  var lsPage = mkFrame({ name: 'Tracking', width: 1440, height: 800 });
  figma.currentPage.appendChild(lsPage);
  // an eyebrow: 20% at 12px renders as 2.4px. Both must read as 20%.
  var eyebrowPct = mkText('OUR 4 STEP', 'Eyebrow');
  eyebrowPct.fontSize = 12;
  eyebrowPct.letterSpacing = { unit: 'PERCENT', value: 20 };
  lsPage.appendChild(eyebrowPct);
  var eyebrowPx = mkText('OUR PROCESS', 'Eyebrow px');
  eyebrowPx.fontSize = 12;
  eyebrowPx.letterSpacing = { unit: 'PIXELS', value: 2.4 };
  lsPage.appendChild(eyebrowPx);
  // a headline at -3% — the same -2.64px would be a different percentage
  var tight = mkText('Lighting the Future', 'Hero');
  tight.fontSize = 88;
  tight.letterSpacing = { unit: 'PIXELS', value: -2.64 };
  lsPage.appendChild(tight);

  var ls = await measureLetterSpacing(styleScanNodes([lsPage]));
  var lsVals = ls.map(function (c) { return c.value; });
  // Measured in Figma: a variable bound to letterSpacing is read as PIXELS
  // and flips the unit, so a token holding the percentage 20 lands as 20px
  // and took a line from 171px wide to 470px. Tokens are pixels.
  ok(lsVals.some(function (v) { return Math.abs(v - 2.4) < 0.3; }),
     'tracking: 20% at 12px is stored as 2.4px, not as 20  (' + lsVals.join(', ') + ')');
  ok(!lsVals.some(function (v) { return Math.abs(v - 20) < 1; }),
     'tracking: the raw percentage is never the token value');
  var twoFour = ls.filter(function (c) { return Math.abs(c.value - 2.4) < 0.3; })[0];
  eq(twoFour && twoFour.count, 2, 'tracking: 20% and 2.4px are the same tracking, so one cluster');
  eq(twoFour && twoFour.percent, 20, 'tracking: the percentage is kept for the report');
  ok(lsVals.some(function (v) { return Math.abs(v + 2.64) < 0.3; }),
     'tracking: -2.64px stays -2.64px  (' + lsVals.join(', ') + ')');
  eq(ls.pixelBased, 2, 'tracking: the pixel-based ones are counted');
  eq(ls.percentBased, 1, 'tracking: and so are the percent-based ones');

  // ── tracking rides with its type step, and is responsive ─────────────
  // A letter-spacing variable is pixels, and the design states tracking as a
  // percentage of the size. So the pixel value is worked out per breakpoint
  // from that breakpoint's own font size: the percentage holds at every
  // width while the number in the variable moves with it.
  var lsCfg = { preset: 'custom', breakpoints: [
    { name: 'Desktop', width: 1440 }, { name: 'Tablet', width: 768 }, { name: 'Mobile', width: 375 }] };
  var lsMeasured = await measureDesign(lsPage, lsCfg);
  var trackRows = lsMeasured.rows.filter(function (r) { return r.name.indexOf('text/tracking/') === 0; });
  ok(trackRows.length > 0, 'tracking: tokens are emitted  (' + trackRows.map(function (r) { return r.name; }).join(', ') + ')');
  trackRows.forEach(function (r) {
    eq(r.tier, 'responsive', 'tracking: ' + r.name + ' is responsive, not a single pixel value');
    eq(r.scopes[0], 'LETTER_SPACING', 'tracking: ' + r.name + ' is scoped to letter spacing');
    var sizeRow = lsMeasured.rows.filter(function (x) {
      return x.name === r.name.replace('text/tracking/', 'text/size/');
    })[0];
    ok(!!sizeRow, 'tracking: ' + r.name + ' has the type step it belongs to');
    if (sizeRow) {
      // the pixel value at each width is the percentage of THAT width's size
      ['Desktop', 'Tablet', 'Mobile'].forEach(function (bp) {
        var want = Math.round((r.percent / 100) * sizeRow.values[bp] * 100) / 100;
        eq(r.values[bp], want,
           'tracking: ' + r.name + ' at ' + bp + ' is ' + r.percent + '% of ' + sizeRow.values[bp] + 'px');
      });
      // Tracking follows its size in whichever direction the size went. A
      // small step is floored UP on mobile for readability, and its tracking
      // grows with it — which is right, not a bug.
      var sizeGrew = sizeRow.values.Mobile > sizeRow.values.Desktop;
      var trackGrew = Math.abs(r.values.Mobile) > Math.abs(r.values.Desktop);
      eq(trackGrew, sizeGrew,
         'tracking: ' + r.name + ' moves with its type  (size ' + sizeRow.values.Desktop + '->' +
         sizeRow.values.Mobile + ', tracking ' + r.values.Desktop + '->' + r.values.Mobile + ')');
    }
  });

  // the same 20% at two sizes now gets a token each, both correct
  freshR();
  var sharedPage = mkFrame({ name: 'Shared tracking', width: 1440, height: 900 });
  figma.currentPage.appendChild(sharedPage);
  for (var sm = 0; sm < 3; sm++) {
    var small = mkText('SMALL EYEBROW TEXT', 'S' + sm);
    small.fontSize = 12; small.letterSpacing = { unit: 'PERCENT', value: 20 };
    sharedPage.appendChild(small);
  }
  var big = mkText('BIG EYEBROW', 'B');
  big.fontSize = 48; big.letterSpacing = { unit: 'PERCENT', value: 20 };
  sharedPage.appendChild(big);
  var sharedMeasured = await measureDesign(sharedPage, lsCfg);
  var sharedRows = sharedMeasured.rows.filter(function (r) { return r.name.indexOf('text/tracking/') === 0; });
  ok(sharedRows.length >= 2,
     'tracking: 20% at 12px and at 48px each get their own token  (' +
     sharedRows.map(function (r) { return r.name + '=' + r.values.Desktop; }).join(', ') + ')');
  var desktopPx = sharedRows.map(function (r) { return r.values.Desktop; });
  ok(desktopPx.some(function (v) { return Math.abs(v - 2.4) < 0.2; }),
     'tracking: 2.4px for the 12px step  (' + desktopPx.join(', ') + ')');
  ok(desktopPx.some(function (v) { return Math.abs(v - 9.6) < 0.4; }),
     'tracking: and 9.6px for the 48px one, instead of refusing both');

  // ══ 8 ══ NEAR matches are reported, never silently applied ═════════════
  freshR();
  var nearOwn = figma.variables.createVariableCollection('House tokens');
  nearOwn.addMode('Value');
  function houseVar(name, value, scopes) {
    var v = figma.variables.createVariable(name, nearOwn, 'FLOAT');
    try { v.scopes = scopes; } catch (e) {}
    v.setValueForMode(nearOwn.modes[0].modeId, value);
    return v;
  }
  houseVar('Spacing/Large', 96, ['GAP']);     // the design uses 94 — close, not equal
  var nearPage = mkFrame({ name: 'Near', width: 1440, height: 1600 });
  nearPage.layoutMode = 'VERTICAL';
  nearPage.paddingTop = 94; nearPage.paddingBottom = 94;
  nearPage.itemSpacing = 94;
  figma.currentPage.appendChild(nearPage);
  for (var nq = 0; nq < 4; nq++) {
    var nc = mkFrame({ name: 'Card', width: 1200, height: 200 });
    nc.layoutMode = 'VERTICAL'; nc.paddingLeft = 94; nc.paddingRight = 94;
    nearPage.appendChild(nc);
    var nt = mkText('Body copy for the near-match case, long enough to count.', 'Body');
    nt.fontSize = 16; nc.appendChild(nt);
  }
  figma.currentPage.selection = [nearPage];
  var rNear = await buildFromExistingFile({ styleChoice: 'keep', bindSelection: false });
  var nearNames = (rNear.nearMatches || []).map(function (x) { return x.existing + '@' + x.existingValue + ' vs ' + x.value; });
  ok((rNear.nearMatches || []).length > 0,
     'near: 94 against a 96 variable is reported as a near match  (' + nearNames.join(', ') + ')');
  eq((rNear.reused || []).filter(function (x) { return x.kind === 'exact'; }).length, 0,
     'near: and is NOT counted as an exact reuse');
  // the design keeps its own 94, rather than being moved to 96
  var ninetyFour = (await localVariablesAllModes('FLOAT')).filter(function (e) {
    var v = e.resolved[Object.keys(e.resolved)[0]];
    return v === 94;
  });
  ok(ninetyFour.length > 0, 'near: the design\u2019s own 94 is written, not snapped to 96');

  // ══ 9 ══ a COLOUR reused from the file is reported like the rest ═══════
  freshR();
  var colOwn = figma.variables.createVariableCollection('House colour');
  colOwn.addMode('Value');
  var brandVar = figma.variables.createVariable('Brand/Primary red', colOwn, 'COLOR');
  brandVar.setValueForMode(colOwn.modes[0].modeId, { r: 0.824, g: 0.145, b: 0.149, a: 1 });
  var colPage = mkFrame({ name: 'Colour', width: 1440, height: 1200 });
  colPage.layoutMode = 'VERTICAL';
  colPage.paddingTop = 48; colPage.paddingBottom = 48; colPage.itemSpacing = 24;
  figma.currentPage.appendChild(colPage);
  for (var cq = 0; cq < 4; cq++) {
    var btn2 = mkFrame({ name: 'Button', width: 200, height: 48 });
    btn2.layoutMode = 'HORIZONTAL'; btn2.paddingLeft = 24; btn2.paddingRight = 24;
    btn2.fills = [{ type: 'SOLID', color: { r: 0.824, g: 0.145, b: 0.149 }, opacity: 1 }];
    colPage.appendChild(btn2);
    var bt = mkText('Contact us today for a quote', 'Label');
    bt.fontSize = 16; btn2.appendChild(bt);
  }
  figma.currentPage.selection = [colPage];
  var rCol = await buildFromExistingFile({ styleChoice: 'keep' });
  var colourReuse = (rCol.reused || []).filter(function (x) { return x.kind === 'colour'; });
  ok(colourReuse.length > 0,
     'colour: a colour bound to the file\u2019s own variable is reported under reused  (' +
     (rCol.reused || []).map(function (x) { return x.existing; }).join(', ') + ')');

  // ══ 10 ══ a bound corner radius is not proposed all over again ════════
  // Found by binding a real button in a real file: Figma expands a
  // cornerRadius binding into topLeftRadius/topRightRadius/... so asking
  // boundVariables.cornerRadius answers no, and a second pass rebinds it.
  freshR();
  var radiusCol = figma.variables.createVariableCollection('House radius');
  radiusCol.addMode('Value');
  var rv = figma.variables.createVariable('Border Radius/Button', radiusCol, 'FLOAT');
  try { rv.scopes = ['CORNER_RADIUS']; } catch (e) {}
  rv.setValueForMode(radiusCol.modes[0].modeId, 8);

  var rPage = mkFrame({ name: 'Radius page', width: 1440, height: 900 });
  rPage.layoutMode = 'VERTICAL'; rPage.itemSpacing = 24;
  figma.currentPage.appendChild(rPage);
  var rBtn = mkFrame({ name: 'Button', width: 200, height: 48 });
  rBtn.layoutMode = 'HORIZONTAL'; rBtn.cornerRadius = 8;
  rBtn.paddingLeft = 24; rBtn.paddingRight = 24;
  rPage.appendChild(rBtn);
  rBtn.appendChild(mkText('Click', 'Label'));

  // Figma's own expansion, reproduced: the four corners, no cornerRadius key
  rBtn.boundVariables.topLeftRadius = { type: 'VARIABLE_ALIAS', id: rv.id };
  rBtn.boundVariables.topRightRadius = { type: 'VARIABLE_ALIAS', id: rv.id };
  rBtn.boundVariables.bottomLeftRadius = { type: 'VARIABLE_ALIAS', id: rv.id };
  rBtn.boundVariables.bottomRightRadius = { type: 'VARIABLE_ALIAS', id: rv.id };

  eq(spaceFieldBound(rBtn, 'cornerRadius'), true,
     'corner radius: a four-corner binding counts as bound');
  figma.currentPage.selection = [rPage];
  var svR = await surveyAdoption([rPage], {});
  var radiusAgain = svR.proposals.filter(function (p) { return p.field === 'cornerRadius'; });
  eq(radiusAgain.length, 0, 'corner radius: and is not proposed a second time');
  ok(svR.alreadyBound > 0, 'corner radius: it is counted as already bound  (' + svR.alreadyBound + ')');

  // ══ 11 ══ going fluid must not collapse a hand-placed frame ═══════════
  // Measured in Figma: a 1440x700 hero given auto layout hugged down to
  // 1440x68 and threw its children 645px outside it.
  freshR();
  var absPage = mkFrame({ name: 'Hand placed', width: 1440, height: 700 });
  figma.currentPage.appendChild(absPage);
  var heroBlock = mkFrame({ name: 'Hero block', width: 1100, height: 420 });
  heroBlock.x = 170; heroBlock.y = 120;
  absPage.appendChild(heroBlock);
  var hTitle = mkText('Lighting the Future of Business', 'H');
  hTitle.fontSize = 56; hTitle.width = 900; hTitle.height = 70; hTitle.x = 0; hTitle.y = 0;
  heroBlock.appendChild(hTitle);
  var hSub = mkText('A subheading that sits below it.', 'Sub');
  hSub.fontSize = 20; hSub.width = 760; hSub.height = 60; hSub.x = 0; hSub.y = 110;
  heroBlock.appendChild(hSub);

  var fr = await makeFrameFluid(absPage, { narrowestWidth: 375, minCardWidth: 260 });
  eq(absPage.width, 1440, 'fluid: a hand-placed frame keeps its width');
  eq(absPage.height, 700, 'fluid: and its height, instead of hugging down to nothing');
  // Measured in Figma: the offset child used to snap to 0,0. Its offsets are
  // now carried across as padding, so it sits exactly where it sat.
  eq(Math.round(heroBlock.x), 170, 'fluid: the offset child keeps its x');
  eq(Math.round(heroBlock.y), 120, 'fluid: and its y');
  eq(absPage.paddingLeft, 170, 'fluid: because the offset became padding');
  eq(absPage.paddingTop, 120, 'fluid: on both axes');

  // ══ 11b ══ a composition auto layout cannot express is left alone ═════
  // Measured in Figma: a caption deliberately sitting ON a backdrop was
  // moved 840px to the right and placed beside it, widening the frame from
  // 900 to 1300.
  freshR();
  var art = mkFrame({ name: 'Art directed', width: 900, height: 500 });
  figma.currentPage.appendChild(art);
  var backdrop = mkFrame({ name: 'Backdrop', width: 900, height: 500 });
  backdrop.x = 0; backdrop.y = 0;
  art.appendChild(backdrop);
  var caption = mkFrame({ name: 'Caption over it', width: 400, height: 120 });
  caption.x = 60; caption.y = 320;
  art.appendChild(caption);

  var fa = await makeFrameFluid(art, { narrowestWidth: 375 });
  eq(art.layoutMode, 'NONE', 'overlap: the frame is left without auto layout');
  eq(Math.round(art.width), 900, 'overlap: its width is unchanged');
  eq(Math.round(caption.x), 60, 'overlap: the caption stays where it was put');
  eq(Math.round(caption.y), 320, 'overlap: on both axes');
  ok(fa.unconvertible > 0, 'overlap: it is counted as unconvertible  (' + fa.unconvertible + ')');
  ok(fa.reasons.join(' ').indexOf('auto layout cannot reproduce') !== -1,
     'overlap: and it says why, rather than silently rearranging it');
  ok(fa.unconvertibleNames.indexOf('Art directed') !== -1,
     'overlap: naming the frame it left alone  (' + fa.unconvertibleNames.join(', ') + ')');

  // ══ 12 ══ a column floor must fit the narrowest canvas ════════════════
  // Measured: a 260px floor inside a 1440 frame with 120px side padding
  // left the cards 125px wider than their column on a 375 phone.
  freshR();
  var wide = mkFrame({ name: 'Section', width: 1440, height: 600 });
  wide.layoutMode = 'VERTICAL';
  wide.paddingLeft = 120; wide.paddingRight = 120;
  figma.currentPage.appendChild(wide);
  var cardRow = mkFrame({ name: 'Cards', width: 1200, height: 300 });
  cardRow.layoutMode = 'HORIZONTAL'; cardRow.itemSpacing = 24;
  wide.appendChild(cardRow);
  for (var fc = 0; fc < 4; fc++) {
    var fcard = mkFrame({ name: 'Card ' + fc, width: 282, height: 300 });
    fcard.y = 0;
    cardRow.appendChild(fcard);
  }
  var fr2 = await makeFrameFluid(wide, { narrowestWidth: 375, minCardWidth: 260 });
  var floors = cardRow.children.map(function (c) { return c.minWidth; });
  var slack = 1440 - 1200;                       // 240px of padding above the row
  var affordable = 375 - slack;                  // 135px on the narrowest canvas
  ok(floors.every(function (f) { return f !== null && f <= affordable; }),
     'floor: no column floor exceeds what a 375 canvas affords  (' + floors.join(', ') + ' vs ' + affordable + ')');
  ok(fr2.reasons.join(' ').indexOf('only has') !== -1,
     'floor: and it explains why the floor is small, and how to win the room back');

  // ══ 13 ══ provenance that cannot be written is reported, not assumed ══
  freshR();
  var provCfg = { preset: 'custom', breakpoints: [
    { name: 'Desktop', width: 1440 }, { name: 'Tablet', width: 768 }, { name: 'Mobile', width: 375 }] };
  writeBreakpointConfig(provCfg);
  await generateScaleVariables(provCfg, defaultScaleTable(provCfg, {}));
  var provPage = mkFrame({ name: 'Home', width: 1440, height: 900 });
  provPage.layoutMode = 'VERTICAL'; provPage.itemSpacing = 24;
  figma.currentPage.appendChild(provPage);
  var provRow = mkFrame({ name: 'Cards', width: 1200, height: 300 });
  provRow.layoutMode = 'HORIZONTAL'; provRow.itemSpacing = 24;
  provPage.appendChild(provRow);
  for (var pq = 0; pq < 3; pq++) {
    var pc = mkFrame({ name: 'Card', width: 380, height: 300 });
    pc.x = pq * 404; pc.y = 0;
    provRow.appendChild(pc);
  }

  await makeFrameFluid(provPage, { narrowestWidth: 375 });
  figma.currentPage.selection = [provPage];
  var gen1 = await generateResponsiveFrames(provCfg, {});
  ok(gen1.created > 0, 'provenance: frames are generated  (' + gen1.created + ')');
  eq(gen1.unstamped || 0, 0, 'provenance: and all of them are recorded');
  var madeNames = gen1.frames.map(function (f) { return f.name + '@' + f.breakpoint; });
  ok(madeNames.length >= 2, 'provenance: the reply names them  (' + madeNames.join(', ') + ')');

  // a second run updates rather than duplicating
  figma.currentPage.selection = [provPage];
  var gen2 = await generateResponsiveFrames(provCfg, {});
  eq(gen2.created, 0, 'provenance: a second run creates nothing new');
  var tabletCount = figma.currentPage.children.filter(function (c) {
    return /Tablet/.test(c.name);
  }).length;
  eq(tabletCount, 1, 'provenance: and there is still exactly one Tablet frame');

  // a hand-edited generated frame is protected
  var tabletFrame = figma.currentPage.children.filter(function (c) { return /Tablet/.test(c.name); })[0];
  ok(!!tabletFrame, 'provenance: the Tablet frame is there to edit');
  if (tabletFrame) {
    tabletFrame.appendChild(mkText('A note the designer added', 'Note'));
    figma.currentPage.selection = [provPage];
    var gen3 = await generateResponsiveFrames(provCfg, {});
    ok(gen3.skipped > 0, 'provenance: an edited frame is left alone  (' + gen3.skipped + ' skipped)');
    ok(gen3.reasons.join(' ').length > 0, 'provenance: with a reason given');
  }

  // and when the file refuses to store provenance, it says so
  freshR();
  writeBreakpointConfig(provCfg);
  await generateScaleVariables(provCfg, defaultScaleTable(provCfg, {}));
  var noStore = mkFrame({ name: 'Home', width: 1440, height: 900 });
  noStore.layoutMode = 'VERTICAL'; noStore.itemSpacing = 24;
  figma.currentPage.appendChild(noStore);
  var nsRow = mkFrame({ name: 'Cards', width: 1200, height: 200 });
  nsRow.layoutMode = 'HORIZONTAL';
  noStore.appendChild(nsRow);
  nsRow.appendChild(mkFrame({ name: 'Card', width: 580, height: 200 }));
  await makeFrameFluid(noStore, { narrowestWidth: 375 });
  var realSet = noStore.setPluginData;
  figma.currentPage.selection = [noStore];
  // every clone's stamp throws, as a locked or restricted file would
  var origClone = noStore.clone;
  noStore.clone = function () {
    var c = origClone.call(this);
    c.setPluginData = function () { throw new Error('plugin data unavailable'); };
    return c;
  };
  var gen4 = await generateResponsiveFrames(provCfg, {});
  ok((gen4.unstamped || 0) > 0, 'provenance: unstampable frames are counted  (' + gen4.unstamped + ')');
  ok(gen4.reasons.join(' ').indexOf('will not recognise them') !== -1,
     'provenance: and the warning explains the consequence');

  // ══ 14 ══ a config that cannot be saved reports false ═════════════════
  freshR();
  eq(writeBreakpointConfig({ preset: 'custom', breakpoints: [{ name: 'Desktop', width: 1440 }] }), true,
     'config: a normal save reports success');
  var realRoot = figma.root.setPluginData;
  figma.root.setPluginData = function () { throw new Error('read-only file'); };
  eq(writeBreakpointConfig({ preset: 'custom', breakpoints: [{ name: 'Desktop', width: 1440 }] }), false,
     'config: a refused save reports failure instead of throwing');
  figma.root.setPluginData = realRoot;

  // ══ 15 ══ generating from a design that cannot reflow is refused ══════
  // Reproduces what a real page did: four frames generated from a design
  // whose children were all fixed width. At 1024 a 1428px card sat inside a
  // parent that had collapsed to 544px; at 375 a 644px block sat in a
  // parent 1px wide.
  freshR();
  var rigidCfg = { preset: 'custom', breakpoints: [
    { name: 'Desktop', width: 1920 }, { name: 'Tablet', width: 768 }, { name: 'Mobile', width: 375 }] };
  writeBreakpointConfig(rigidCfg);
  await generateScaleVariables(rigidCfg, defaultScaleTable(rigidCfg, {}));

  var rigidPage = mkFrame({ name: 'Services Page', width: 1920, height: 2000 });
  rigidPage.layoutMode = 'VERTICAL'; rigidPage.itemSpacing = 40;
  figma.currentPage.appendChild(rigidPage);
  var rigidRow = mkFrame({ name: 'Service Cards Container', width: 1428, height: 600 });
  rigidRow.layoutMode = 'HORIZONTAL'; rigidRow.itemSpacing = 24;
  rigidRow.layoutSizingHorizontal = 'FIXED';
  rigidPage.appendChild(rigidRow);
  for (var rc = 0; rc < 4; rc++) {
    var rcard = mkFrame({ name: 'service_' + (rc + 1), width: 1428, height: 600 });
    rcard.layoutMode = 'VERTICAL';
    rcard.layoutSizingHorizontal = 'FIXED';
    rcard.y = 0;
    rigidRow.appendChild(rcard);
  }

  var readiness = fluidReadiness(rigidPage);
  eq(readiness.ready, false, 'rigid: the design is reported as not ready to narrow');
  ok(readiness.rigid > 0, 'rigid: the fixed-width layers are counted  (' + readiness.rigid + ')');
  ok(readiness.names.join(' ').indexOf('service_') !== -1,
     'rigid: and named  (' + readiness.names.slice(0, 3).join(', ') + ')');

  figma.currentPage.selection = [rigidPage];
  var refused = await generateResponsiveFrames(rigidCfg, {});
  eq(refused.created, 0, 'rigid: no frames are generated');
  ok(refused.reasons.join(' ').indexOf('Make fluid first') !== -1,
     'rigid: and it says to make it fluid first  ("' + refused.reasons[0] + '")');
  var madeAnything = figma.currentPage.children.filter(function (c) {
    return /Tablet|Mobile/.test(c.name);
  });
  eq(madeAnything.length, 0, 'rigid: nothing half-built is left behind');

  // once it IS fluid, the same design generates
  await makeFrameFluid(rigidPage, { narrowestWidth: 375 });
  var readyNow = fluidReadiness(rigidPage);
  eq(readyNow.ready, true, 'rigid: Make fluid makes it ready  (' + readyNow.flexible + ' flexible)');
  figma.currentPage.selection = [rigidPage];
  var allowed = await generateResponsiveFrames(rigidCfg, {});
  ok(allowed.created >= 2, 'rigid: and then the frames generate  (' + allowed.created + ')');

  print('');
  if (fail === 0) print('ALL PASS (' + pass + ' assertions)');
  else print(fail + ' FAILED, ' + pass + ' passed');
}
run().catch(function (e) { print('THREW: ' + (e && e.stack || e)); });
