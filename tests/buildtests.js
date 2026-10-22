// ── Build design system: families, colour tiers, one-shot build ────────────
var ONMSG4 = figma.ui.onmessage;
function fresh4() { resetFigma(); figma.ui.onmessage = ONMSG4; globalThis.__posted = [];
                    figma._fonts = ['Inter|Regular', 'Inter|Medium', 'Inter|Semi Bold']; }
function posted4(t) { return (globalThis.__posted || []).filter(function (m) { return m.type === t; }); }

var pass = 0, fail = 0;
function ok(c, l) { if (c) pass++; else { fail++; print('  FAIL: ' + l); } }
function eq(a, b, l) { ok(a === b, l + '  (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }

var BPS = [{ name: 'Desktop', width: 1440 }, { name: 'Tablet', width: 768 }, { name: 'Mobile', width: 375 }];
var CFG = { preset: 'custom', breakpoints: BPS };
function row(table, name) { return table.filter(function (r) { return r.name === name; })[0]; }

async function run() {
  // ── 1 ── type scale ───────────────────────────────────────────────────
  var ts = typeScaleRows(CFG, { typeBase: 16, typeRatio: 1.25 });
  var h1 = row(ts, 'text/size/h1');
  var body = row(ts, 'text/size/body');
  ok(!!h1 && !!body, 'the type scale has h1 and body');
  eq(body.values['Desktop'], 16, 'body stays at the base');
  eq(body.values['Mobile'], 16, 'at EVERY breakpoint — body copy never shrinks below comfort');
  ok(h1.values['Desktop'] > h1.values['Mobile'], 'but h1 is smaller on mobile');
  ok(h1.values['Desktop'] === Math.round(16 * Math.pow(1.25, 6)), 'desktop h1 is base x ratio^6');
  eq(h1.tier, 'responsive', 'type sizes are responsive, not primitive');
  eq(h1.scopes[0], 'FONT_SIZE', 'and scoped to font size');

  var tight = typeScaleRows(CFG, { typeBase: 16, typeRatio: 1.618 });
  var looseDrop = row(ts, 'text/size/h1').values['Desktop'] - row(ts, 'text/size/h1').values['Mobile'];
  var tightDrop = row(tight, 'text/size/h1').values['Desktop'] - row(tight, 'text/size/h1').values['Mobile'];
  ok(tightDrop > looseDrop, 'a bigger ratio compresses further on small screens');

  // ── 2 ── the other families ───────────────────────────────────────────
  ok(!!row(lineHeightRows(), 'text/leading/normal'), 'line heights');
  eq(row(lineHeightRows(), 'text/leading/normal').values['*'], 150, 'normal leading is 150');
  ok(!!row(borderRows(), 'border/thin'), 'border widths');
  ok(!!row(iconSizeRows(), 'icon/md'), 'icon sizes');
  ok(!!row(opacityRows(), 'opacity/disabled'), 'opacity');
  var bw = breakpointWidthRows(CFG);
  eq(row(bw, 'breakpoint/mobile').values['*'], 375, 'breakpoint widths become tokens too');

  // ── 3 ── colour ramps and the theme tier ──────────────────────────────
  var cs = colorSystemRows({ brandHex: '#2563EB' });
  var b500 = row(cs, 'brand/500');
  var b50 = row(cs, 'brand/50');
  var b900 = row(cs, 'brand/900');
  ok(!!b500 && !!b50 && !!b900, 'a full brand ramp');
  eq(b500.type, 'COLOR', 'typed as COLOR');
  ok(b50.values['*'].r > b500.values['*'].r, '50 is lighter than 500');
  ok(b900.values['*'].r < b500.values['*'].r, '900 is darker');

  var sem = row(cs, 'color/text/primary');
  eq(sem.tier, 'theme', 'semantic names live on the theme tier');
  eq(sem.refs.Light, 'neutral/900', 'light mode points at a dark neutral');
  eq(sem.refs.Dark, 'neutral/50', 'dark mode points at a light one');

  var noTheme = colorSystemRows({ theme: false });
  eq(noTheme.filter(function (r) { return r.tier === 'theme'; }).length, 0, 'the theme tier can be turned off');

  // ── 4 ── generating colour and theme for real ─────────────────────────
  fresh4();
  writeBreakpointConfig(CFG);
  var table = defaultScaleTable(CFG, {});
  var g = await generateScaleVariables(CFG, table);
  eq(g.skipped, 0, 'nothing skipped: ' + g.reasons.slice(0, 3).join(' | '));
  ok(!g.themeModes.capHit, 'the Theme collection took two modes');

  var cols = await getUiKitCollections(false);
  eq(cols.theme.modes.length, 2, 'Light and Dark exist');
  eq(cols.theme.modes[0].name, 'Light', 'named Light');

  var colorVars = await localVariablesAllModes('COLOR');
  var textPrimary = colorVars.filter(function (e) { return e.variable.name === 'color/text/primary'; })[0];
  ok(!!textPrimary, 'the semantic token was created');
  var lightId = null, darkId = null;
  for (var i = 0; i < cols.theme.modes.length; i++) {
    if (cols.theme.modes[i].name === 'Light') lightId = cols.theme.modes[i].modeId;
    if (cols.theme.modes[i].name === 'Dark') darkId = cols.theme.modes[i].modeId;
  }
  var lightRaw = textPrimary.variable.valuesByMode[lightId];
  eq(lightRaw && lightRaw.type, 'VARIABLE_ALIAS', 'light mode is an ALIAS, not a copied colour');
  var lightVal = await variableValue(textPrimary.variable, lightId);
  var darkVal = await variableValue(textPrimary.variable, darkId);
  ok(lightVal.r < 0.3, 'light theme resolves to a dark text colour');
  ok(darkVal.r > 0.7, 'dark theme resolves to a light one');

  // ── 5 ── one-shot build ───────────────────────────────────────────────
  fresh4();
  var spec = {
    preset: 'custom', breakpoints: BPS,
    ramp: { spacing: 'grid8', spacingBase: 8, radius: 'pill' },
    type: { base: 18, ratio: 1.333 },
    colors: { brandHex: '#7C3AED', theme: true },
    families: {},
    elements: ['button', 'card']
  };
  var built = await buildDesignSystem(spec);
  ok(built.tokens.created > 50, 'a whole system in one call  (' + built.tokens.created + ' tokens)');
  ok(!!built.elements, 'and the elements');
  eq(built.elements.created, 2, 'just the two asked for');
  ok(!!readBreakpointConfig(), 'the breakpoint config was saved');

  var floats = await localVariablesAllModes('FLOAT');
  var space300 = floats.filter(function (e) { return e.variable.name === 'space/300'; })[0];
  eq(await variableValue(space300.variable), 24, '8pt grid with base 8: space/300 is 24');
  var h1v = floats.filter(function (e) { return e.variable.name === 'text/size/h1'; })[0];
  ok(!!h1v, 'the type scale was generated');

  // ── 6 ── a cap hit writes NOTHING ─────────────────────────────────────
  fresh4();
  figma._modeCap = 2;
  var blocked = await buildDesignSystem(spec);
  eq(blocked.tokens, null, 'no tokens generated');
  ok(blocked.reasons.join(' ').indexOf('go back and remove') !== -1, 'and it says what to do: ' + blocked.reasons[0]);
  eq(readBreakpointConfig(), null, 'and no config was saved, so nothing is half-set-up');
  eq((await localVariablesAllModes('FLOAT')).length, 0, 'the file is untouched');
  figma._modeCap = 4;

  // ── 7 ── preview writes nothing ───────────────────────────────────────
  fresh4();
  var preview = previewTable(spec);
  ok(preview.length > 50, 'a preview table is produced  (' + preview.length + ' rows)');
  eq((await localVariablesAllModes('FLOAT')).length, 0, 'and nothing was written to the file');

  // ── 8 ── through the handler ──────────────────────────────────────────
  fresh4();
  globalThis.__posted = [];
  await figma.ui.onmessage({ type: 'uikit-build', requestId: 'b1', spec: spec });
  var d = posted4('uikit-done')[0];
  ok(!!d, 'build reports done');
  eq(d.tone, 'success', 'and succeeds');
  ok(d.message.indexOf('One undo reverses all of it') !== -1, 'promising a single undo: ' + d.message);

  // ── 9 ── canvas, columns, gutter, margin ──────────────────────────────
  var gr = gridRows(CFG, {});
  eq(row(gr, 'grid/columns').values['Desktop'], 12, '1440px gets 12 columns');
  eq(row(gr, 'grid/columns').values['Mobile'], 4, '375px gets 4');
  eq(row(gr, 'grid/gutter').values['Desktop'], 24, 'wide gutter on desktop');
  ok(row(gr, 'grid/gutter').values['Mobile'] < 24, 'tighter on mobile');
  eq(row(gr, 'canvas/width').values['Desktop'], 1440, 'canvas width is the breakpoint width');

  // ── the container drives the margin, not the other way round ──────────
  // Measured in a real file: a 1600 page with content at x=200 w=1200,
  // which is exactly (1600 - 1200) / 2 a side.
  var page1600 = { preset: 'custom', breakpoints: [{ name: 'Desktop', width: 1600 }, { name: 'Mobile', width: 375 }] };
  var g1600 = gridRows(page1600, { grid: { container: { Desktop: 1200 } } });
  eq(row(g1600, 'container/max').values['Desktop'], 1200, 'a 1600 page with a 1200 container');
  eq(row(g1600, 'grid/margin').values['Desktop'], 200, 'gives a 200 margin a side — derived, not chosen');

  var g1920 = gridRows({ preset: 'custom', breakpoints: [{ name: 'Desktop', width: 1920 }] },
                       { grid: { container: { Desktop: 1400 } } });
  eq(row(g1920, 'container/max').values['Desktop'], 1400, '1920 page, 1400 container');
  eq(row(g1920, 'grid/margin').values['Desktop'], 260, 'margin is (1920 - 1400) / 2');

  // on a phone the margin floor wins and the container gives way
  eq(row(g1600, 'grid/margin').values['Mobile'], 16, 'a phone keeps a 16px margin floor');
  eq(row(g1600, 'container/max').values['Mobile'], 375 - 32, 'and the container is whatever is left');

  // a container wider than the canvas cannot win
  var tooWide = gridRows(page1600, { grid: { container: { Desktop: 5000 } } });
  ok(row(tooWide, 'container/max').values['Desktop'] <= 1600,
     'a container wider than the page is clamped  (' + row(tooWide, 'container/max').values['Desktop'] + ')');

  // overrides win
  var custom = gridRows(CFG, { grid: { columns: { Desktop: 16 }, gutter: { Desktop: 40 } } });
  eq(row(custom, 'grid/columns').values['Desktop'], 16, 'an override is respected');
  eq(row(custom, 'grid/gutter').values['Desktop'], 40, 'and so is a gutter override');
  eq(row(custom, 'grid/columns').values['Mobile'], 4, 'while the rest keep their defaults');

  // an explicit margin still beats the derived one
  var marginWins = gridRows(page1600, { grid: { container: { Desktop: 1200 }, margin: { Desktop: 80 } } });
  eq(row(marginWins, 'grid/margin').values['Desktop'], 80, 'an explicit margin overrides the derivation');
  eq(row(marginWins, 'container/max').values['Desktop'], 1200, 'and the container still fits');

  // exactly one row owns container/max
  var full = defaultScaleTable(CFG, {});
  eq(full.filter(function (r) { return r.name === 'container/max'; }).length, 1,
     'only one row owns container/max — two would race to be written');

  // ── 10 ── grid STYLES, one per breakpoint ─────────────────────────────
  fresh4();
  writeBreakpointConfig(CFG);
  var gs = await createGridStyles(CFG, {});
  eq(gs.created, 3, 'one grid style per breakpoint — a grid style cannot carry modes');
  eq(figma._gridStyles.length, 3, 'and they really exist');
  var deskStyle = figma._gridStyles.filter(function (s2) { return s2.name === 'Grid / Desktop'; })[0];
  ok(!!deskStyle, 'named per breakpoint');
  eq(deskStyle.layoutGrids[0].count, 12, 'with 12 columns');
  eq(deskStyle.layoutGrids[0].gutterSize, 24, 'the gutter');
  // 1440 canvas, 1120 container -> (1440-1120)/2 = 160 a side
  eq(deskStyle.layoutGrids[0].offset, 160, 'and the DERIVED margin as the offset');
  eq(deskStyle.layoutGrids[0].pattern, 'COLUMNS', 'as a column grid');

  var again = await createGridStyles(CFG, {});
  eq(again.created, 0, 'a second run creates none');
  eq(again.reused, 3, 'and reuses all three');
  eq(figma._gridStyles.length, 3, 'no duplicates');

  // ── 11 ── the grid comes through a full build ─────────────────────────
  fresh4();
  var gspec = { preset: 'custom', breakpoints: BPS, ramp: {}, type: {}, colors: {}, families: {},
                grid: { columns: { Desktop: 16 } }, elements: [] };
  var gb = await buildDesignSystem(gspec);
  eq(gb.grids.created, 3, 'the build created the grid styles');
  var gfloats = await localVariablesAllModes('FLOAT');
  var colVar = gfloats.filter(function (e) { return e.variable.name === 'grid/columns'; })[0];
  ok(!!colVar, 'grid/columns is a token too');
  var cols2 = await getUiKitCollections(false);
  var deskMode = null;
  for (var q = 0; q < cols2.responsive.modes.length; q++) {
    if (cols2.responsive.modes[q].name === 'Desktop') deskMode = cols2.responsive.modes[q].modeId;
  }
  eq(await variableValue(colVar.variable, deskMode), 16, 'carrying the override');

  // grid can be switched off
  fresh4();
  var noGrid = await buildDesignSystem({ preset: 'custom', breakpoints: BPS, ramp: {}, type: {},
                                         colors: {}, families: { grid: false }, elements: [] });
  eq(noGrid.grids, undefined, 'no grid styles when the family is off');
  eq(figma._gridStyles.length, 0, 'and none created');
  var ngf = await localVariablesAllModes('FLOAT');
  eq(ngf.filter(function (e) { return e.variable.name === 'grid/columns'; }).length, 0, 'nor the tokens');

  print('');
  print(fail === 0 ? ('ALL PASS (' + pass + ' assertions)') : (pass + ' passed, ' + fail + ' FAILED'));
}
run().catch(function (e) { print('THREW: ' + e + '\n' + (e && e.stack)); });
