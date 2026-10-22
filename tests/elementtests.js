// ── UI Kit: the elements ───────────────────────────────────────────────────
var ONMSG3 = figma.ui.onmessage;
function fresh3() { resetFigma(); figma.ui.onmessage = ONMSG3; globalThis.__posted = [];
                    figma._fonts = ['Inter|Regular', 'Inter|Medium', 'Inter|Semi Bold']; }
function posted3(t) { return (globalThis.__posted || []).filter(function (m) { return m.type === t; }); }

var pass = 0, fail = 0;
function ok(c, l) { if (c) pass++; else { fail++; print('  FAIL: ' + l); } }
function eq(a, b, l) { ok(a === b, l + '  (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }

var BPS = [{ name: 'Desktop', width: 1440 }, { name: 'Mobile', width: 375 }];
var CFG = { preset: 'custom', breakpoints: BPS };

function findDeep(node, pred) {
  if (pred(node)) return node;
  if (node.children) for (var i = 0; i < node.children.length; i++) {
    var hit = findDeep(node.children[i], pred);
    if (hit) return hit;
  }
  return null;
}
function collectDeep(node, pred, out) {
  out = out || [];
  if (pred(node)) out.push(node);
  if (node.children) for (var i = 0; i < node.children.length; i++) collectDeep(node.children[i], pred, out);
  return out;
}

async function run() {
  // ── 1 ── the whole kit ────────────────────────────────────────────────
  fresh3();
  writeBreakpointConfig(CFG);
  await generateScaleVariables(CFG, defaultScaleTable(CFG));

  var g = await generateKitElements(CFG, {});
  eq(g.created, 10, 'every element in the catalogue was created');
  eq(g.skipped, 0, 'none skipped');
  ok(g.reasons.length === 0, 'no complaints: ' + g.reasons.join(' | '));

  var root = figma.currentPage.children.filter(function (c) { return c.name === 'UI Kit — Elements'; })[0];
  ok(!!root, 'the kit frame is on the page');

  // ── 2 ── they are REAL components, not pictures ───────────────────────
  var comps = collectDeep(root, function (n) { return n.type === 'COMPONENT'; });
  ok(comps.length >= 25, 'plenty of real components  (' + comps.length + ')');
  var sets = collectDeep(root, function (n) { return n.type === 'COMPONENT_SET'; });
  ok(sets.length >= 8, 'and variant sets rather than loose copies  (' + sets.length + ')');

  // ── 3 ── Button has a real variant matrix ─────────────────────────────
  var btnSet = sets.filter(function (n) { return n.name === 'Button'; })[0];
  ok(!!btnSet, 'Button is a component set');
  eq(btnSet.children.length, 9, '3 variants x 3 states = 9');
  var names = btnSet.children.map(function (c) { return c.name; });
  ok(names.indexOf('Variant=Primary, State=Default') !== -1, 'named as variant properties, so Figma reads them as a matrix');
  ok(names.indexOf('Variant=Tertiary, State=Disabled') !== -1, 'including the far corner of the matrix');

  // ── 4 ── bound to the tokens, not to loose numbers ────────────────────
  var primary = btnSet.children.filter(function (c) { return c.name === 'Variant=Primary, State=Default'; })[0];
  ok(!!primary.boundVariables.paddingLeft, 'button padding is bound to a token');
  ok(!!primary.boundVariables.cornerRadius, 'and its corner radius');
  ok(!!primary.boundVariables.itemSpacing, 'and its gap');

  var cols = await getUiKitCollections(false);
  var padVar = figma._vars.filter(function (v) { return v.id === primary.boundVariables.paddingLeft.id; })[0];
  eq(padVar.variableCollectionId, cols.primitives.id, 'the token lives in Primitives');
  eq(await variableValue(padVar), 24, 'and really holds 24');

  // ── 4b ── a component must HUG its height, not keep the resize value ──
  var cardSet = collectDeep(root, function (n) { return n.type === 'COMPONENT' && n.name === 'Card'; })[0];
  ok(!!cardSet, 'the Card component exists');
  eq(cardSet.primaryAxisSizingMode, 'AUTO', 'and hugs its height, so its copy is not clipped');
  var alert0 = collectDeep(root, function (n) { return n.name === 'Tone=Info'; })[0];
  if (alert0) eq(alert0.counterAxisSizingMode, 'AUTO', 'the alert hugs its height too');
  var input0 = collectDeep(root, function (n) { return n.name === 'State=Default'; })[0];
  if (input0) eq(input0.counterAxisSizingMode, 'AUTO', 'and so does the input');

  // ── 5 ── colour tokens were created and bound ─────────────────────────
  var colourVars = await localVariablesWithValues('COLOR');
  ok(colourVars.length >= 15, 'the kit colour tokens exist  (' + colourVars.length + ')');
  var brand = colourVars.filter(function (e) { return e.variable.name === 'color/brand/default'; })[0];
  ok(!!brand, 'color/brand/default among them');
  var fill = primary.fills[0];
  ok(fill.boundVariables && fill.boundVariables.color, 'the button fill is bound to a colour token, not a literal');

  // ── 6 ── running it twice reuses the colour tokens ────────────────────
  var before = (await localVariablesWithValues('COLOR')).length;
  await generateKitElements(CFG, {});
  eq((await localVariablesWithValues('COLOR')).length, before, 'a second run creates no duplicate colour tokens');

  // ── 7 ── a subset ─────────────────────────────────────────────────────
  fresh3();
  writeBreakpointConfig(CFG);
  await generateScaleVariables(CFG, defaultScaleTable(CFG));
  var sub = await generateKitElements(CFG, { elements: ['button', 'card'] });
  eq(sub.created, 2, 'only what was asked for');
  var subRoot = figma.currentPage.children.filter(function (c) { return c.name === 'UI Kit — Elements'; })[0];
  ok(!findDeep(subRoot, function (n) { return n.name === 'Badge'; }), 'and nothing else');

  // ── 8 ── no Inter: falls back rather than failing ─────────────────────
  fresh3();
  figma._fonts = ['Helvetica|Regular', 'Helvetica|Bold'];
  writeBreakpointConfig(CFG);
  var fb = await generateKitElements(CFG, { elements: ['card'] });
  eq(fb.created, 1, 'the kit still builds without Inter');
  var fbRoot = figma.currentPage.children.filter(function (c) { return c.name === 'UI Kit — Elements'; })[0];
  var someText = findDeep(fbRoot, function (n) { return n.type === 'TEXT'; });
  eq(someText.fontName.family, 'Helvetica', 'using a font the machine actually has');

  // ── 9 ── no usable font at all is reported, not thrown ────────────────
  fresh3();
  figma._fonts = [];
  writeBreakpointConfig(CFG);
  var none = await generateKitElements(CFG, { elements: ['card'] });
  eq(none.created, 0, 'nothing created with no fonts');
  ok(none.reasons.join(' ').indexOf('font') !== -1, 'and it says why: ' + none.reasons.join(' | '));

  // ── 10 ── through the handler ─────────────────────────────────────────
  fresh3();
  writeBreakpointConfig(CFG);
  await generateScaleVariables(CFG, defaultScaleTable(CFG));
  globalThis.__posted = [];
  await figma.ui.onmessage({ type: 'uikit-elements', requestId: 'e1' });
  var d = posted3('uikit-done')[0];
  ok(!!d, 'elements report done');
  eq(d.tone, 'success', 'and succeed');
  ok(d.message.indexOf('bound to the tokens') !== -1, 'with a message: ' + d.message);
  ok(d.state.elements.length === 10, 'the state lists the catalogue for the UI');

  print('');
  print(fail === 0 ? ('ALL PASS (' + pass + ' assertions)') : (pass + ' passed, ' + fail + ' FAILED'));
}
run().catch(function (e) { print('THREW: ' + e + '\n' + (e && e.stack)); });
