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
  ok(lsVals.some(function (v) { return Math.abs(v - 20) < 1.5; }),
     'tracking: 20% and 2.4px-at-12px read as the same value  (' + lsVals.join(', ') + ')');
  var twenty = ls.filter(function (c) { return Math.abs(c.value - 20) < 1.5; })[0];
  eq(twenty && twenty.count, 2, 'tracking: both spellings land in one cluster');
  ok(lsVals.some(function (v) { return v < -2 && v > -4; }),
     'tracking: -2.64px at 88px is about -3%, not -2.64  (' + lsVals.join(', ') + ')');
  eq(ls.pixelBased, 2, 'tracking: the pixel-based ones are counted');
  eq(ls.percentBased, 1, 'tracking: and so are the percent-based ones');

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

  print('');
  if (fail === 0) print('ALL PASS (' + pass + ' assertions)');
  else print(fail + ' FAILED, ' + pass + ' passed');
}
run().catch(function (e) { print('THREW: ' + (e && e.stack || e)); });
