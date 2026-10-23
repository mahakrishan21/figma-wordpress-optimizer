// ── The two workflows, walked exactly as the spec numbers them ────────────
//
// This suite is a conformance check, not a unit test. Each section follows
// one workflow end to end in the order a designer does it, and asserts the
// numbered step actually happened. If a step is not implemented, the failure
// says which one.
var ONMSGW = figma.ui.onmessage;
function freshW() {
  resetFigma(); figma.ui.onmessage = ONMSGW; globalThis.__posted = [];
  figma._fonts = ['Inter|Regular', 'Inter|Medium', 'Inter|Semi Bold'];
  lastAuditNodeIds = []; lastAuditIssueTypesByNode = new Map(); ignoredIssueKeys = new Set();
}
function postedW(t) { return (globalThis.__posted || []).filter(function (m) { return m.type === t; }); }

var pass = 0, fail = 0;
function ok(c, l) { if (c) pass++; else { fail++; print('  FAIL: ' + l); } }
function eq(a, b, l) { ok(a === b, l + '  (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }

function solid(hex) {
  var n = parseInt(hex.replace('#', ''), 16);
  return { type: 'SOLID', color: { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }, opacity: 1 };
}
function deep(node, pred, out) {
  out = out || [];
  if (pred(node)) out.push(node);
  if (node.children) for (var i = 0; i < node.children.length; i++) deep(node.children[i], pred, out);
  return out;
}
async function send(msg) {
  globalThis.__posted = [];
  await figma.ui.onmessage(Object.assign({ requestId: 'w' + Math.random() }, msg));
  var r = (globalThis.__posted || []).filter(function (m) {
    return m.type === 'uikit-done' || m.type === 'uikit-error';
  });
  return r[r.length - 1];
}
// Every variable in the system, by name.
async function systemVars() {
  var cols = await getUiKitCollections(false);
  var ids = {};
  [cols.primitives, cols.theme, cols.responsive].forEach(function (c) { if (c) ids[c.id] = true; });
  var out = {};
  var floats = await localVariablesAllModes('FLOAT');
  var colours = await localVariablesAllModes('COLOR');
  floats.concat(colours).forEach(function (e) {
    if (ids[e.variable.variableCollectionId]) out[e.variable.name] = e;
  });
  return out;
}
function family(names, prefix) {
  return names.filter(function (n) { return n.indexOf(prefix) === 0; });
}

// A design with real measurements in it, for workflow 2.
function designPage(width) {
  var page = mkFrame({ name: 'Homepage', width: width || 1440, height: 2400 });
  figma.currentPage.appendChild(page);
  for (var s = 0; s < 3; s++) {
    var section = mkFrame({ name: 'Section ' + s, width: page.width, height: 600 });
    section.layoutMode = 'VERTICAL';
    section.paddingTop = 64; section.paddingBottom = 64; section.itemSpacing = 24;
    page.appendChild(section);
    var container = mkFrame({ name: 'Container', width: 1200, height: 460 });
    container.layoutMode = 'HORIZONTAL';
    container.itemSpacing = 32; container.paddingLeft = 24; container.paddingRight = 24;
    section.appendChild(container);
    for (var c = 0; c < 3; c++) {
      var card = mkFrame({ name: 'Card', width: 368, height: 380 });
      card.layoutMode = 'VERTICAL';
      card.cornerRadius = 8; card.itemSpacing = 16;
      card.paddingLeft = 16; card.paddingRight = 16; card.paddingTop = 16; card.paddingBottom = 16;
      card.fills = [solid('#FFFFFF')];
      container.appendChild(card);
      var h = mkText('Heading ' + c, 'H');
      h.fontSize = [56, 40, 28][c]; h.fills = [solid('#111111')];
      card.appendChild(h);
      for (var b = 0; b < 3; b++) {
        var p = mkText('Body copy that runs on long enough to make sixteen the body size here.', 'Body');
        p.fontSize = 16; p.fills = [solid('#374151')];
        card.appendChild(p);
      }
      var btn = mkFrame({ name: 'Button', width: 160, height: 48 });
      btn.layoutMode = 'HORIZONTAL';
      btn.paddingLeft = 24; btn.paddingRight = 24;
      btn.cornerRadius = 8; btn.fills = [solid('#2563EB')];
      btn.appendChild(mkText('Get started', 'Label'));
      card.appendChild(btn);
    }
  }
  return page;
}

async function run() {
  // ════════════════════════════════════════════════════════════════════════
  // The tab asks which workflow, before either one starts
  // ════════════════════════════════════════════════════════════════════════
  freshW();
  var state = await uiKitState();
  eq(state.config, null, 'a fresh file has no workflow under way');
  ok(!!state.presets && !!state.spacingPresets && !!state.radiusPresets,
     'and the tab has what it needs to offer both workflows');

  // ════════════════════════════════════════════════════════════════════════
  // OPTION 1 — Build from Scratch
  // ════════════════════════════════════════════════════════════════════════
  freshW();
  var BPS = [{ name: 'Desktop', width: 1440 }, { name: 'Tablet', width: 768 }, { name: 'Mobile', width: 375 }];

  // 1 ── gather the requirements: colours, typography, spacing, layout rules
  var spec = {
    preset: 'custom', breakpoints: BPS,
    spacing: 'grid8', spacingBase: 8, radius: 'rounded', radiusBase: 4,
    typeBase: 16, typeRatio: 1.25,
    colors: { brandHex: '#2563EB', neutralHex: '#6B7280' },
    grid: { columns: 12, gutter: 24 },
    elements: ['button', 'card'], families: {}
  };
  var preview = previewTable(spec);
  ok(preview.length > 0, '1: the requirements produce a table before anything is written  (' + preview.length + ' rows)');
  eq((await localVariablesAllModes('FLOAT')).length, 0, '   and nothing is written while gathering them');

  // 2 ── create reusable variables for colour, typography and spacing
  var built = await send({ type: 'uikit-build', spec: spec });
  ok(built && built.type === 'uikit-done', '2: the system is built');
  var vars = await systemVars();
  var names = Object.keys(vars);
  ok(family(names, 'space/').length > 0, '2: spacing variables  (' + family(names, 'space/').length + ')');
  ok(family(names, 'text/size/').length > 0, '2: typography variables  (' + family(names, 'text/size/').length + ')');
  ok(family(names, 'brand/').length > 0 || family(names, 'color/').length > 0,
     '2: colour variables  (' + family(names, 'brand/').concat(family(names, 'color/')).length + ')');
  ok(family(names, 'radius/').length > 0, '2: radius variables');
  ok(family(names, 'grid/').length > 0, '2: layout variables  (' + family(names, 'grid/').join(', ') + ')');

  // 3 ── the system exists before any design does
  var cols = await getUiKitCollections(false);
  ok(!!cols.primitives && !!cols.responsive, '3: the system is in place, tiered');
  eq(cols.responsive.modes.length, 3, '3: with one mode per screen size');

  // 4 ── create the design using the established system
  figma.currentPage.selection = [];
  var starter = await send({ type: 'uikit-starter' });
  ok(starter && starter.type === 'uikit-done', '4: a design canvas is created from the system');
  ok(starter.result && starter.result.bound > 0,
     '4: and its values come from the variables, not from numbers  (' + (starter.result ? starter.result.bound : 0) + ' bound)');
  var canvas = figma.currentPage.children.filter(function (c) { return /Desktop/.test(c.name); })[0];
  ok(!!canvas, '4: the canvas is named for the widest screen size  (' + canvas.name + ')');

  // 5 ── generate responsive desktop, tablet and mobile from the same variables
  figma.currentPage.selection = [canvas];
  await send({ type: 'uikit-fluid' });
  figma.currentPage.selection = [canvas];
  var resp1 = await send({ type: 'uikit-responsive' });
  ok(resp1 && resp1.type === 'uikit-done', '5: responsive versions are generated');
  var kids1 = figma.currentPage.children.map(function (c) { return c.name; });
  ok(kids1.some(function (n) { return /Tablet/.test(n); }), '5: a Tablet layout  (' + kids1.join(' | ') + ')');
  ok(kids1.some(function (n) { return /Mobile/.test(n); }), '5: a Mobile layout');
  var tablet1 = figma.currentPage.children.filter(function (c) { return /Tablet/.test(c.name); })[0];
  if (tablet1) eq(tablet1.width, 768, '5: at the Tablet width');

  // the same variables drive every size, rather than one set per size
  var responsiveVars = Object.keys(vars).filter(function (n) {
    return vars[n].variable.variableCollectionId === cols.responsive.id;
  });
  ok(responsiveVars.length > 0, '5: the screen sizes are modes of one variable set  (' + responsiveVars.length + ')');

  // ════════════════════════════════════════════════════════════════════════
  // OPTION 2 — Build from an Existing File
  // ════════════════════════════════════════════════════════════════════════
  freshW();
  var page = designPage(1440);

  // 1 ── it asks for a frame, and refuses to guess without one
  figma.currentPage.selection = [];
  var noSel = await send({ type: 'uikit-from-file' });
  eq(noSel.tone, 'warning', '1: with nothing selected it asks for a frame');
  ok(/Select the frame/.test(noSel.message), '1: saying so  ("' + noSel.message + '")');
  eq((await localVariablesAllModes('FLOAT')).length, 0, '1: and writes nothing meanwhile');

  // 2 ── extract the design's actual properties
  figma.currentPage.selection = [page];
  var fromFile = await send({ type: 'uikit-from-file' });
  ok(fromFile && fromFile.type === 'uikit-done', '2: analysing the frame answers');
  var md = fromFile.result.measured;
  ok(!!md, '2: it extracted properties');
  eq(md.canvasWidth, 1440, '2: the canvas dimensions');
  eq(md.margin, 120, '2: the margins');
  ok(md.spacing.length > 0, '2: the spacing  (' + md.spacing.map(function (x) { return x.value; }).join(', ') + ')');
  var typeNames = md.type.map(function (t) { return t.name; });
  ok(typeNames.indexOf('h1') !== -1, '2: H1  (' + typeNames.join(', ') + ')');
  ok(typeNames.indexOf('h2') !== -1, '2: H2');
  ok(typeNames.indexOf('body') !== -1, '2: and body text');
  ok(md.colours.length > 0, '2: the colours  (' + md.colours.length + ')');
  ok(md.counts.controls > 0, '2: and its controls  (' + md.counts.controls + ')');

  // 3 ── build variables from those values, without inventing any
  var vars2 = await systemVars();
  var names2 = Object.keys(vars2);
  var cfg2 = readBreakpointConfig();
  var modes2 = await ensureModes((await getUiKitCollections(false)).responsive, breakpointNames(cfg2));
  var wide = modes2.nameToModeId[cfg2.breakpoints[0].name];

  var h1v = vars2['text/size/h1'], bodyv = vars2['text/size/body'];
  ok(!!h1v && !!bodyv, '3: H1 and body became variables');
  if (h1v) eq(await variableValue(h1v.variable, wide), 56, '3: H1 holds the size the design uses, not a preset one');
  if (bodyv) eq(await variableValue(bodyv.variable, wide), 16, '3: and so does body');
  var marginv = vars2['grid/margin'];
  if (marginv) eq(await variableValue(marginv.variable, wide), 120, '3: the margin is the measured one');
  var spaceVals = [];
  family(names2, 'space/').forEach(function (n) {
    if (vars2[n].variable.variableCollectionId === (cols && cols.primitives ? cols.primitives.id : null)) return;
  });
  ok(family(names2, 'space/').length > 0, '3: spacing variables exist  (' + family(names2, 'space/').length + ')');

  // and nothing the design never used
  var invented = [];
  var measuredNames = {};
  fromFile.result.measured.counts.byFamily && Object.keys(fromFile.result.measured.counts.byFamily)
    .forEach(function (f) { measuredNames[f] = true; });
  names2.forEach(function (n) {
    var f = n.split('/')[0];
    if (!measuredNames[f]) invented.push(n);
  });
  eq(invented.length, 0,
     '3: no variable exists for anything the design did not use  (' + invented.join(', ') + ')');
  ok(family(names2, 'icon/').length === 0, '3: no icon sizes, since this design has no icons');
  ok(family(names2, 'opacity/').length === 0, '3: no opacities, since nothing in it is translucent');
  ok(family(names2, 'border/').length === 0, '3: no border widths, since nothing in it is stroked');
  ok(Array.isArray(fromFile.result.notMeasured) && fromFile.result.notMeasured.length > 0,
     '3: and it reports what it found nothing for  (' + (fromFile.result.notMeasured || []).join(', ') + ')');
  ok(/none was invented/.test(fromFile.message), '3: saying so in the summary');
  eq(fromFile.result.cfg.breakpoints[0].width, 1440,
     '3: the measured canvas becomes the widest screen size, rather than a preset width');

  // 4 ── apply them to the design without changing how it looks
  var applied = fromFile.result.applied;
  ok(applied && applied.bound > 0, '4: variables were applied to the design  (' + (applied ? applied.bound : 0) + ')');
  eq(applied.failed, 0, '4: with nothing refused');
  var card = deep(page, function (n) { return n.name === 'Card'; })[0];
  ok(!!card, '4: the design still has its cards');
  if (card) {
    eq(card.paddingLeft, 16, '4: padding unchanged');
    eq(card.cornerRadius, 8, '4: radius unchanged');
    ok(!!card.boundVariables.paddingLeft, '4: but the padding now comes from a variable');
  }
  var h1node = deep(page, function (n) { return n.type === 'TEXT' && n.fontSize === 56; })[0];
  ok(!!h1node, '4: the H1 is still 56px');
  if (h1node) ok(!!h1node.boundVariables.fontSize, '4: and now follows the H1 variable');
  eq(page.width, 1440, '4: and the frame is the width it always was');

  // 5 ── responsive layouts from the same variables
  figma.currentPage.selection = [page];
  await send({ type: 'uikit-fluid' });
  figma.currentPage.selection = [page];
  var resp2 = await send({ type: 'uikit-responsive' });
  ok(resp2 && resp2.type === 'uikit-done', '5: responsive versions are generated');
  var kids2 = figma.currentPage.children.map(function (c) { return c.name; });
  var tablet2 = figma.currentPage.children.filter(function (c) { return /Tablet/.test(c.name); })[0];
  var mobile2 = figma.currentPage.children.filter(function (c) { return /Mobile/.test(c.name); })[0];
  ok(!!tablet2, '5: a Tablet layout  (' + kids2.join(' | ') + ')');
  ok(!!mobile2, '5: a Mobile layout');
  if (tablet2) eq(tablet2.width, 768, '5: at the Tablet width');
  if (mobile2) eq(mobile2.width, 375, '5: and the Mobile width');
  eq(page.width, 1440, '5: while the design that was analysed is left at its own width');

  // and the narrower sizes read the SAME variables, in another mode
  var narrow = modes2.nameToModeId[cfg2.breakpoints[cfg2.breakpoints.length - 1].name];
  if (h1v) {
    var h1narrow = await variableValue(h1v.variable, narrow);
    ok(h1narrow < 56 && h1narrow >= 18,
       '5: H1 resolves smaller on Mobile from the same variable  (' + h1narrow + ')');
  }

  print('');
  if (fail === 0) print('ALL PASS (' + pass + ' assertions)');
  else print(fail + ' FAILED, ' + pass + ' passed');
}
run().catch(function (e) { print('THREW: ' + (e && e.stack || e)); });
