// ── A canvas to actually design in ────────────────────────────────────────
var ONMSG9 = figma.ui.onmessage;
function fresh9() { resetFigma(); figma.ui.onmessage = ONMSG9; globalThis.__posted = [];
                    figma._fonts = ['Inter|Regular', 'Inter|Medium', 'Inter|Semi Bold']; }
function posted9(t) { return (globalThis.__posted || []).filter(function (m) { return m.type === t; }); }

var pass = 0, fail = 0;
function ok(c, l) { if (c) pass++; else { fail++; print('  FAIL: ' + l); } }
function eq(a, b, l) { ok(a === b, l + '  (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }

var BPS = [{ name: 'Desktop', width: 1440 }, { name: 'Tablet', width: 768 }, { name: 'Mobile', width: 375 }];
var CFG = { preset: 'custom', breakpoints: BPS };

function deep(node, pred, out) {
  out = out || [];
  if (pred(node)) out.push(node);
  if (node.children) for (var i = 0; i < node.children.length; i++) deep(node.children[i], pred, out);
  return out;
}
function starter() {
  return figma.currentPage.children.filter(function (c) { return c.name === 'Desktop — 1440'; })[0];
}

async function run() {
  // ── 1 ── nothing to design with ───────────────────────────────────────
  fresh9();
  var none = await createStarterCanvas(CFG, {});
  eq(none.created, 0, 'no canvas without tokens');
  ok(none.reasons.join(' ').indexOf('no tokens') !== -1, 'and it says why');

  // ── 2 ── the canvas itself ────────────────────────────────────────────
  fresh9();
  writeBreakpointConfig(CFG);
  await generateScaleVariables(CFG, defaultScaleTable(CFG, {}));
  await createGridStyles(CFG, {});
  var r = await createStarterCanvas(CFG, {});
  eq(r.created, 1, 'one canvas created');
  eq(r.sections, 3, 'three sections to start from');
  ok(r.bound > 0, 'with values bound to the system  (' + r.bound + ')');

  var page = starter();
  ok(!!page, 'named for the widest canvas size');
  eq(page.width, 1440, 'and sized to it');
  eq(page.layoutMode, 'VERTICAL', 'as an auto-layout frame');

  // ── 3 ── full-bleed sections, each holding a centred container ────────
  // A real page is a full-width band with a content column inside it, so an
  // image can reach the edge while the copy stays in the column.
  eq(page.paddingLeft, 0, 'the page itself has no side padding — its sections are full-bleed');
  var sections = (page.children || []);
  ok(sections.length >= 3, 'it has sections  (' + sections.length + ')');
  sections.forEach(function (sec, i) {
    eq(sec.layoutSizingHorizontal, 'FILL', 'section ' + i + ' runs the full width');
    eq(sec.counterAxisAlignItems, 'CENTER', 'section ' + i + ' centres its container');
    ok(!!sec.boundVariables.paddingTop, 'section ' + i + ' has its vertical padding bound');
    ok(!!sec.boundVariables.paddingLeft, 'section ' + i + ' has the margin floor bound');
  });

  var container = sections[0].children.filter(function (c) { return c.name === 'Container'; })[0];
  ok(!!container, 'the first section holds a Container');
  eq(container.layoutSizingHorizontal, 'FILL', 'which fills...');
  ok(!!container.boundVariables.maxWidth, '...up to a bound max width — the content column');
  var maxVar = figma._vars.filter(function (v) { return v.id === container.boundVariables.maxWidth.id; })[0];
  eq(maxVar.name, 'container/max', 'and that token is container/max');

  ok(page.fills && page.fills[0] && page.fills[0].boundVariables &&
     page.fills[0].boundVariables.color, 'the background is a colour token');

  var padVar = figma._vars.filter(function (v) { return v.id === sections[0].boundVariables.paddingTop.id; })[0];
  eq(padVar.name, 'space/section/lg', 'and the section padding token is the responsive one');

  // ── 4 ── fluid from birth ─────────────────────────────────────────────
  eq(page.minWidth, 375, 'a floor from the narrowest canvas size');
  eq(page.maxWidth, 1440, 'a ceiling from the widest');
  var row = deep(page, function (n) { return n.name === 'Card row'; })[0];
  ok(!!row, 'there is a card row');
  eq(row.layoutWrap, 'WRAP', 'and it already wraps');
  eq(row.children.length, 3, 'with three cards');
  row.children.forEach(function (c, i) {
    eq(c.layoutSizingHorizontal, 'FILL', 'card ' + i + ' fills');
    eq(c.minWidth, 260, 'card ' + i + ' has a minimum width — what makes it wrap');
  });

  // ── 4b ── containers must HUG their height, not sit at the resize value
  // resize() resets both sizing modes to FIXED, so setting AUTO and then
  // resizing leaves a section 1px tall with its content clipped.
  // The mock does not recompute auto-layout height, so the MODE is what can
  // be asserted here — and it is the actual contract: AUTO means Figma grows
  // the frame to its content, FIXED means it clips at the resize value.
  eq(page.primaryAxisSizingMode, 'AUTO', 'the canvas hugs its height rather than clipping at the resize value');
  var hero = deep(page, function (n) { return n.name === 'Hero'; })[0];
  ok(!!hero, 'there is a hero section');
  eq(hero.primaryAxisSizingMode, 'AUTO', 'and it hugs its height too');
  eq(hero.counterAxisSizingMode, 'FIXED', 'while its width is driven by the parent');
  var heroContainer = hero.children.filter(function (c) { return c.name === 'Container'; })[0];
  eq(heroContainer.primaryAxisSizingMode, 'AUTO', 'and its container hugs too');
  var firstCard = row.children[0];
  eq(firstCard.primaryAxisSizingMode, 'AUTO', 'and so does a card');

  // ── 5 ── the grid style is applied ────────────────────────────────────
  ok(!!page.gridStyleId, 'the grid style for this canvas size is applied');

  // ── 6 ── the type scale is in use, not hardcoded ──────────────────────
  var texts = deep(page, function (n) { return n.type === 'TEXT'; });
  ok(texts.length >= 4, 'the canvas has copy  (' + texts.length + ')');
  var bound = texts.filter(function (t) { return t.boundVariables && t.boundVariables.fontSize; });
  ok(bound.length >= 2, 'with font sizes bound to the scale  (' + bound.length + ')');
  var h1 = texts.filter(function (t) { return String(t.characters).indexOf('Headline') === 0; })[0];
  ok(!!h1 && !!h1.boundVariables.fontSize, 'the headline uses a type token');

  // no auto-width text inside a fixed-width parent — the overflow shape
  var overflowing = texts.filter(function (t) {
    return t.textAutoResize === 'WIDTH_AND_HEIGHT' && t.parent && t.parent.counterAxisSizingMode === 'FIXED';
  });
  eq(overflowing.length, 0, 'and nothing is set up to overflow');

  // ── 7 ── it uses the generated components when they exist ─────────────
  fresh9();
  writeBreakpointConfig(CFG);
  await generateScaleVariables(CFG, defaultScaleTable(CFG, {}));
  await generateKitElements(CFG, { elements: ['button', 'card'] });
  var withKit = await createStarterCanvas(CFG, {});
  ok(withKit.usedComponents.length > 0, 'it reaches for the kit  (' + withKit.usedComponents.join(', ') + ')');
  var page2 = starter();
  var instances = deep(page2, function (n) { return n.type === 'INSTANCE'; });
  ok(instances.length > 0, 'and places real instances  (' + instances.length + ')');

  // ── 8 ── it still works with no components at all ─────────────────────
  fresh9();
  writeBreakpointConfig(CFG);
  await generateScaleVariables(CFG, defaultScaleTable(CFG, {}));
  var noKit = await createStarterCanvas(CFG, {});
  eq(noKit.created, 1, 'a canvas is still made without a component kit');
  eq(noKit.usedComponents.length, 0, 'using none');
  var cards = deep(starter(), function (n) { return n.name === 'Card'; });
  eq(cards.length, 3, 'with placeholder cards instead');

  // ── 9 ── it comes out of a full build, after the components ───────────
  fresh9();
  var built = await buildDesignSystem({ preset: 'custom', breakpoints: BPS, ramp: {}, type: {},
                                        colors: {}, families: {}, elements: ['button', 'card'] });
  ok(!!built.starter && built.starter.created === 1, 'the build makes one');
  ok(built.starter.usedComponents.length > 0,
     'and it runs AFTER the elements, so it can use them  (' + built.starter.usedComponents.join(', ') + ')');

  // and can be turned off
  fresh9();
  var off = await buildDesignSystem({ preset: 'custom', breakpoints: BPS, ramp: {}, type: {},
                                      colors: {}, families: { starter: false }, elements: [] });
  eq(off.starter, undefined, 'the starter canvas can be switched off');

  // ── 10 ── through the handler ─────────────────────────────────────────
  fresh9();
  writeBreakpointConfig(CFG);
  await generateScaleVariables(CFG, defaultScaleTable(CFG, {}));
  globalThis.__posted = [];
  await figma.ui.onmessage({ type: 'uikit-starter', requestId: 's1' });
  var d = posted9('uikit-done')[0];
  ok(!!d, 'the action reports done');
  eq(d.tone, 'success', 'and succeeds');
  ok(d.message.indexOf('ready to design in') !== -1, 'saying what it gave you: ' + d.message);

  print('');
  print(fail === 0 ? ('ALL PASS (' + pass + ' assertions)') : (pass + ' passed, ' + fail + ' FAILED'));
}
run().catch(function (e) { print('THREW: ' + e + '\n' + (e && e.stack)); });
