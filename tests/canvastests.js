// ── Every token drawn on the canvas, bound to its variable ────────────────
var ONMSG6 = figma.ui.onmessage;
function fresh6() { resetFigma(); figma.ui.onmessage = ONMSG6; globalThis.__posted = [];
                    figma._fonts = ['Inter|Regular', 'Inter|Medium', 'Inter|Semi Bold']; }
function posted6(t) { return (globalThis.__posted || []).filter(function (m) { return m.type === t; }); }

var pass = 0, fail = 0;
function ok(c, l) { if (c) pass++; else { fail++; print('  FAIL: ' + l); } }
function eq(a, b, l) { ok(a === b, l + '  (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }

var BPS = [{ name: 'Desktop', width: 1440 }, { name: 'Mobile', width: 375 }];
var CFG = { preset: 'custom', breakpoints: BPS };

function deepAll(node, pred, out) {
  out = out || [];
  if (pred(node)) out.push(node);
  if (node.children) for (var i = 0; i < node.children.length; i++) deepAll(node.children[i], pred, out);
  return out;
}
function findText(node, substr) {
  return deepAll(node, function (n) {
    return n.type === 'TEXT' && String(n.characters || '').indexOf(substr) !== -1;
  });
}

async function run() {
  // ── 0 ── a node must reject an invented property, as Figma does ───────
  fresh6();
  var probe = mkFrame({ name: 'Probe' });
  var threw = false;
  try { probe.somethingInvented = 1; } catch (e) { threw = String(e).indexOf('not extensible') !== -1; }
  ok(threw, 'assigning an unknown property to a node throws "not extensible", as in Figma');
  var realOk = true;
  try { probe.cornerRadius = 8; } catch (e) { realOk = false; }
  ok(realOk, 'while a real property still assigns');

  // ── 1 ── nothing to draw ──────────────────────────────────────────────
  fresh6();
  var none = await buildTokenCanvas(CFG);
  eq(none.tokens, 0, 'an empty file draws nothing');
  ok(none.reasons.join(' ').indexOf('no tokens') !== -1, 'and says so');
  eq(figma.currentPage.children.length, 0, 'leaving the page clean');

  // ── 2 ── the whole system ─────────────────────────────────────────────
  fresh6();
  writeBreakpointConfig(CFG);
  await generateScaleVariables(CFG, defaultScaleTable(CFG, {}));
  var r = await buildTokenCanvas(CFG);
  ok(r.tokens > 80, 'every token is drawn  (' + r.tokens + ')');
  ok(r.sections >= 10, 'grouped into sections  (' + r.sections + ')');

  var page = figma.currentPage.children.filter(function (c) { return c.name === 'Design System — Tokens'; })[0];
  ok(!!page, 'the page is on the canvas');
  // Side by side and top-aligned, the way a UI kit page is actually read —
  // not one tall column nobody scrolls to the bottom of.
  eq(page.layoutMode, 'HORIZONTAL', 'sections sit side by side');
  eq(page.counterAxisAlignItems, 'MIN', 'top-aligned, so columns of different length line up');
  var sections = page.children || [];
  ok(sections.length >= 10, 'one panel per family  (' + sections.length + ')');
  // The spacing is measured from a real UI kit page: 120 padding, 214
  // between sections, a rule 30 under each title, content 50 under the rule.
  eq(page.itemSpacing, 214, 'sections sit 214 apart, as measured');
  eq(page.paddingLeft, 120, 'with 120 padding');
  sections.forEach(function (sec, i) {
    eq(sec.primaryAxisSizingMode, 'AUTO', 'panel ' + i + ' hugs its height');
    eq(sec.itemSpacing, 50, 'panel ' + i + ' puts 50 under its rule');
    var header = (sec.children || []).filter(function (c) { return c.name === 'Header'; })[0];
    ok(!!header, 'panel ' + i + ' has a header group');
    eq(header.itemSpacing, 30, 'panel ' + i + ' puts 30 under its title');
    ok((header.children || []).some(function (c) { return c.name === 'Line'; }),
       'panel ' + i + ' has a rule under its title');
    var body = (sec.children || []).filter(function (c) { return c.name === 'Rows'; })[0];
    ok(!!body && body.children.length > 0, 'panel ' + i + ' holds its rows in a body group');
  });

  // section headings are present
  ['Spacing', 'Radius', 'Type scale', 'Opacity', 'Semantic colour'].forEach(function (h) {
    ok(findText(page, h).length > 0, 'a "' + h + '" section');
  });

  // every token's NAME appears, which is what makes it findable on canvas
  ok(findText(page, 'space/300').length > 0, 'space/300 is labelled');
  ok(findText(page, 'brand/500').length > 0, 'brand/500 is labelled');
  ok(findText(page, 'color/text/primary').length > 0, 'the semantic names too');

  // ── 3 ── samples are BOUND, not snapshots ─────────────────────────────
  var bound = deepAll(page, function (n) {
    return n.boundVariables && Object.keys(n.boundVariables).length > 0;
  });
  ok(bound.length > 30, 'most samples carry a variable binding  (' + bound.length + ')');

  var spacingSample = deepAll(page, function (n) {
    return n.name === 'space/300' && n.type === 'RECTANGLE';
  })[0];
  ok(!!spacingSample, 'the spacing sample is a rectangle');
  ok(!!spacingSample.boundVariables.width, 'with its WIDTH bound, so retuning the token resizes it');

  var typeSample = deepAll(page, function (n) {
    return n.name === 'text/size/h1' && n.type === 'TEXT';
  })[0];
  ok(!!typeSample, 'the type sample is real text');
  ok(!!typeSample.boundVariables.fontSize, 'with its font size bound');

  // The ROW is named after its token too, so select the sample by type.
  var iconSample = deepAll(page, function (n) { return n.name === 'icon/md' && n.type === 'RECTANGLE'; })[0];
  ok(!!iconSample && !!iconSample.boundVariables.width && !!iconSample.boundVariables.height,
     'icon samples bind both width and height');

  var opacitySample = deepAll(page, function (n) { return n.name === 'opacity/disabled' && n.type === 'RECTANGLE'; })[0];
  ok(!!opacitySample && !!opacitySample.boundVariables.opacity, 'opacity samples bind opacity');

  var colourSample = deepAll(page, function (n) { return n.name === 'brand/500' && n.type === 'RECTANGLE'; })[0];
  ok(!!colourSample, 'a colour swatch exists');
  ok(colourSample.fills && colourSample.fills[0] && colourSample.fills[0].boundVariables &&
     colourSample.fills[0].boundVariables.color, 'with its FILL bound to the colour variable');

  // ── 4 ── a zero value is not asked to be 0px wide ─────────────────────
  var zeroRow = deepAll(page, function (n) { return n.name === 'border/none' && n.type === 'RECTANGLE'; })[0];
  ok(!!zeroRow, 'border/none is drawn');
  ok(!zeroRow.width || zeroRow.width >= 1, 'without asking Figma for a zero-sized node');

  // ── 5 ── a responsive token lists every canvas size, written out ──────
  // Initials packed into one fixed-width cell wrapped mid-word and spilled
  // out of the row. Each size gets its own line now, in full.
  var h1Row = deepAll(page, function (n) { return n.name === 'text/size/h1' && n.children; })[0];
  ok(!!h1Row, 'the h1 row exists');
  var stack = deepAll(h1Row, function (n) { return n.name === 'Values'; })[0];
  ok(!!stack, 'its value cell is a stack, not one wrapping string');
  eq(stack.layoutMode, 'VERTICAL', 'stacked vertically');
  eq(stack.children.length, CFG.breakpoints.length, 'one line per canvas size');
  var lines = stack.children.map(function (t) { return String(t.characters || ''); });
  ok(lines[0].indexOf('Desktop') === 0, 'written out in full, not "D": ' + lines[0]);
  ok(lines[lines.length - 1].indexOf('Mobile') === 0, 'including the last one: ' + lines[lines.length - 1]);
  ok(lines.every(function (l) { return /\d/.test(l); }), 'each carries its value');
  eq(h1Row.counterAxisAlignItems, 'MIN', 'the row is top-aligned so a tall value does not centre the rest');

  // ── 6 ── it comes out of a full build too ─────────────────────────────
  fresh6();
  var built = await buildDesignSystem({ preset: 'custom', breakpoints: BPS, ramp: {}, type: {},
                                        colors: {}, families: {}, elements: [] });
  ok(!!built.canvas && built.canvas.tokens > 0, 'the build documents the tokens  (' + (built.canvas && built.canvas.tokens) + ')');
  ok(!!figma.currentPage.children.filter(function (c) { return c.name === 'Design System — Tokens'; })[0],
     'and the page is there');

  // and can be switched off
  fresh6();
  var off = await buildDesignSystem({ preset: 'custom', breakpoints: BPS, ramp: {}, type: {},
                                      colors: {}, families: { canvas: false }, elements: [] });
  eq(off.canvas, undefined, 'the canvas page can be turned off');
  eq(figma.currentPage.children.filter(function (c) { return c.name === 'Design System — Tokens'; }).length, 0,
     'and then nothing is drawn');

  // ── 7 ── through the handler ──────────────────────────────────────────
  fresh6();
  writeBreakpointConfig(CFG);
  await generateScaleVariables(CFG, defaultScaleTable(CFG, {}));
  globalThis.__posted = [];
  await figma.ui.onmessage({ type: 'uikit-canvas', requestId: 'c1' });
  var d = posted6('uikit-done')[0];
  ok(!!d, 'the canvas action reports done');
  eq(d.tone, 'success', 'and succeeds');
  ok(d.message.indexOf('bound to its variable') !== -1, 'promising live samples: ' + d.message);

  // ── 8 ── the elements no longer overflow their containers ─────────────
  // Figma's own audit flagged the Card's copy running 41px past its edge.
  fresh6();
  writeBreakpointConfig(CFG);
  await generateScaleVariables(CFG, defaultScaleTable(CFG, {}));
  await generateKitElements(CFG, { elements: ['card', 'alert', 'input'] });
  var kit = figma.currentPage.children.filter(function (c) { return c.name === 'UI Kit — Elements'; })[0];
  var texts = deepAll(kit, function (n) { return n.type === 'TEXT'; });
  ok(texts.length > 0, 'the elements have text');
  var autoWidth = texts.filter(function (t) { return t.textAutoResize === 'WIDTH_AND_HEIGHT'; });
  var inFixed = autoWidth.filter(function (t) {
    return t.parent && t.parent.counterAxisSizingMode === 'FIXED';
  });
  eq(inFixed.length, 0, 'no auto-width text sits inside a fixed-width parent — that is the overflow');
  var filled = texts.filter(function (t) { return t.layoutSizingHorizontal === 'FILL'; });
  ok(filled.length >= 3, 'the copy fills its container instead  (' + filled.length + ')');

  // ── 9 ── the logo, drawn in colour, mono dark and mono light ──────────
  fresh6();
  writeBreakpointConfig(CFG);
  await generateScaleVariables(CFG, defaultScaleTable(CFG, {}));
  var withLogo = await buildTokenCanvas(CFG, {
    logo: { bytes: [1, 2, 3, 4], width: 600, height: 200, name: 'logo.png' }
  });
  eq(withLogo.logo, true, 'a logo panel was drawn');
  var lp = figma.currentPage.children.filter(function (c) { return c.name === 'Design System — Tokens'; })[0];
  var logoPanel = (lp.children || []).filter(function (c) { return c.name === 'Logo'; })[0];
  ok(!!logoPanel, 'and it leads the page');
  eq(lp.children[0].name, 'Logo', 'as the first section');

  var tiles = deepAll(logoPanel, function (n) {
    return n.name === 'Original' || n.name.indexOf('Mono') === 0;
  });
  eq(tiles.length, 3, 'three tiles: original, mono dark, mono light');

  var plates = deepAll(logoPanel, function (n) { return n.name === 'Logo' && n.type === 'RECTANGLE'; });
  eq(plates.length, 3, 'each tile carries the image');
  plates.forEach(function (pl, i) {
    eq(pl.fills[0].type, 'IMAGE', 'tile ' + i + ' uses an image fill');
    ok(!!pl.fills[0].imageHash, 'tile ' + i + ' has an image hash');
  });
  // a raster cannot be recoloured, so the mono versions are FILTERED
  var mono = plates.filter(function (pl) { return pl.fills[0].filters; });
  eq(mono.length, 2, 'two of them carry filters');
  mono.forEach(function (pl) {
    eq(pl.fills[0].filters.saturation, -1, 'saturation stripped to make it mono');
  });
  var exposures = mono.map(function (pl) { return pl.fills[0].filters.exposure; }).sort();
  ok(exposures[0] < 0 && exposures[1] > 0, 'one pushed dark, one pushed light');

  // 9b ── a logo Figma refuses is reported, not fatal
  fresh6();
  writeBreakpointConfig(CFG);
  await generateScaleVariables(CFG, defaultScaleTable(CFG, {}));
  var bad = await buildTokenCanvas(CFG, { logo: { bytes: [], width: 10, height: 10 } });
  ok(bad.tokens > 0, 'the rest of the page is still drawn');
  ok(!bad.logo, 'without a logo panel');

  // 9c ── no logo at all is the normal case
  fresh6();
  writeBreakpointConfig(CFG);
  await generateScaleVariables(CFG, defaultScaleTable(CFG, {}));
  var noLogo = await buildTokenCanvas(CFG, {});
  ok(!noLogo.logo, 'no logo section when none was given');
  ok(noLogo.tokens > 0, 'and everything else is there');

  print('');
  print(fail === 0 ? ('ALL PASS (' + pass + ' assertions)') : (pass + ' passed, ' + fail + ' FAILED'));
}
run().catch(function (e) { print('THREW: ' + e + '\n' + (e && e.stack)); });
