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

  print('');
  print(fail === 0 ? ('ALL PASS (' + pass + ' assertions)') : (pass + ' passed, ' + fail + ' FAILED'));
}
run().catch(function (e) { print('THREW: ' + e + '\n' + (e && e.stack)); });
