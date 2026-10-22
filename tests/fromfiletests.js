// ── Build from an existing file: adopt its styles rather than rebuild ─────
var ONMSG10 = figma.ui.onmessage;
function fresh10() { resetFigma(); figma.ui.onmessage = ONMSG10; globalThis.__posted = [];
                     figma._fonts = ['Inter|Regular','Inter|Medium','Inter|Semi Bold']; }
function posted10(t) { return (globalThis.__posted || []).filter(function (m) { return m.type === t; }); }

var pass = 0, fail = 0;
function ok(c, l) { if (c) pass++; else { fail++; print('  FAIL: ' + l); } }
function eq(a, b, l) { ok(a === b, l + '  (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }

function solid(hex) {
  var n = parseInt(hex.replace('#',''), 16);
  return { type:'SOLID', color:{ r:((n>>16)&255)/255, g:((n>>8)&255)/255, b:(n&255)/255 }, opacity:1 };
}
function paintStyle(name, hex) {
  var st = figma.createPaintStyle();
  st.name = name;
  st.paints = [solid(hex)];
  return st;
}
function textStyle(name, size) {
  var st = figma.createTextStyle();
  st.name = name;
  st.fontName = { family:'Inter', style:'Regular' };
  st.fontSize = size;
  return st;
}

async function run() {
  // ── 1 ── a file with styles: adopt them, do not rebuild ───────────────
  fresh10();
  paintStyle('Brand / Primary', '#2563EB');
  paintStyle('Brand / Dark', '#1D4ED8');
  paintStyle('Neutral / Body', '#6B7280');
  textStyle('Heading / H1', 61);
  textStyle('Body', 16);

  var before = await surveyExistingFile();
  eq(before.paintStyles, 3, 'the survey sees the paint styles');
  eq(before.textStyles, 2, 'and the text styles');
  eq(before.hasSystem, false, 'and no system yet');

  var r = await buildFromExistingFile({ bindSelection: false });
  eq(r.seededBreakpoints, true, 'canvas sizes were set up');
  eq(r.paints.adopted, 3, 'every colour style became a token');
  eq(r.texts.adopted, 2, 'and every text style a type token');

  // the token keeps the style's NAME, so the file still reads the same
  var cols = await getUiKitCollections(false);
  var colours = await localVariablesWithValues('COLOR');
  var names = colours.map(function (e) { return e.variable.name; });
  ok(names.indexOf('color/brand/primary') !== -1, 'named after the style: ' + names.slice(0,4).join(', '));
  ok(names.indexOf('color/neutral/body') !== -1, 'including the neutral');

  // ── 2 ── the STYLE now follows the token ──────────────────────────────
  eq(r.paints.bound, 3, 'each style was bound to its token');
  var st0 = figma._paintStyles.filter(function (s) { return s.name === 'Brand / Primary'; })[0];
  ok(st0.paints[0].boundVariables && st0.paints[0].boundVariables.color,
     'so every layer already using that style now follows a token, with nothing to re-apply');

  // ── 3 ── text sizes are RESPONSIVE, seeded down from the style ────────
  var floats = await localVariablesAllModes('FLOAT');
  var h1 = floats.filter(function (e) { return e.variable.name === 'text/size/heading/h1'; })[0];
  ok(!!h1, 'the H1 style became a responsive token');
  eq(h1.variable.variableCollectionId, cols.responsive.id, 'in the Responsive collection');
  var cfg = readBreakpointConfig();
  var modes = await ensureModes(cols.responsive, breakpointNames(cfg));
  var wide = await variableValue(h1.variable, modes.nameToModeId[cfg.breakpoints[0].name]);
  var narrow = await variableValue(h1.variable, modes.nameToModeId[cfg.breakpoints[cfg.breakpoints.length-1].name]);
  eq(wide, 61, 'the widest keeps the style value exactly');
  ok(narrow < wide, 'and the narrowest is seeded smaller  (' + narrow + ')');
  ok(narrow >= 18, 'but not below readable  (' + narrow + ')');

  var body = floats.filter(function (e) { return e.variable.name === 'text/size/body'; })[0];
  var bNarrow = await variableValue(body.variable, modes.nameToModeId[cfg.breakpoints[cfg.breakpoints.length-1].name]);
  ok(bNarrow >= 14, 'body copy never seeded below 14  (' + bNarrow + ')');

  // ── 4 ── it fills the GAPS without rebuilding colour or type ──────────
  var spacing = floats.filter(function (e) { return e.variable.name.indexOf('space/') === 0; });
  ok(spacing.length > 5, 'spacing was filled in, since the file had none  (' + spacing.length + ')');
  var brandRamp = colours.filter(function (e) { return e.variable.name.indexOf('brand/') === 0; });
  eq(brandRamp.length, 0, 'but NO fresh brand ramp was generated beside the adopted colours');
  var genType = floats.filter(function (e) { return e.variable.name.indexOf('text/size/h') === 0 &&
                                                    e.variable.name.length === 13; });
  eq(genType.length, 0, 'and no generated type scale beside the adopted one');

  // ── 5 ── running it twice adopts nothing new ──────────────────────────
  var again = await buildFromExistingFile({ bindSelection: false });
  eq(again.paints.adopted, 0, 'a second run adopts no new colours');
  eq(again.paints.reused, 3, 'it recognises them');
  eq(again.texts.adopted, 0, 'nor new text sizes');

  // ── 6 ── a file with NO styles still gets a system ────────────────────
  fresh10();
  var bare = await buildFromExistingFile({ bindSelection: false });
  eq(bare.paints.adopted, 0, 'nothing to adopt');
  ok(bare.filled.created > 0, 'but the gaps are still filled  (' + bare.filled.created + ')');

  // ── 7 ── a style that is not one solid colour is left alone ───────────
  fresh10();
  var gradient = figma.createPaintStyle();
  gradient.name = 'Hero gradient';
  gradient.paints = [{ type: 'GRADIENT_LINEAR' }];
  paintStyle('Brand', '#2563EB');
  var g = await buildFromExistingFile({ bindSelection: false });
  eq(g.paints.adopted, 1, 'only the solid one is adopted');
  eq(g.paints.skipped, 1, 'the gradient is skipped');
  ok(g.reasons.join(' ').indexOf('single solid colour') !== -1, 'and said so');

  // ── 8 ── through the handler ──────────────────────────────────────────
  fresh10();
  paintStyle('Brand', '#2563EB');
  textStyle('Body', 16);
  globalThis.__posted = [];
  await figma.ui.onmessage({ type: 'uikit-from-file', requestId: 'f1', bindSelection: false });
  var d = posted10('uikit-done')[0];
  ok(!!d, 'it reports done');
  eq(d.tone, 'success', 'and succeeds');
  ok(d.message.indexOf('adopted') !== -1, 'saying what it adopted: ' + d.message);
  ok(!!d.state.fileHas, 'and the state reports what the file holds');
  eq(d.state.fileHas.paintStyles, 1, 'one paint style');

  print('');
  print(fail === 0 ? ('ALL PASS (' + pass + ' assertions)') : (pass + ' passed, ' + fail + ' FAILED'));
}
run().catch(function (e) { print('THREW: ' + e + '\n' + (e && e.stack)); });
