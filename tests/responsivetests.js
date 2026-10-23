// ── UI Kit: responsive rules, inference and generation ──────────────────────
var ONMSG2 = figma.ui.onmessage;
function freshPage() { resetFigma(); figma.ui.onmessage = ONMSG2; globalThis.__posted = []; }
function posted2(type) { return (globalThis.__posted || []).filter(function (m) { return m.type === type; }); }

var pass = 0, fail = 0;
function ok(c, l) { if (c) pass++; else { fail++; print('  FAIL: ' + l); } }
function eq(a, b, l) { ok(a === b, l + '  (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }

var BPS = [{ name: 'Desktop', width: 1440 }, { name: 'Tablet', width: 768 }, { name: 'Mobile', width: 375 }];
var CFG = { preset: 'custom', breakpoints: BPS };

// A hero: a wide row of two fixed columns, plus a 4-card grid, plus a nav.
function buildPage() {
  var nav = mkFrame({ name: 'Nav', layoutMode: 'HORIZONTAL', width: 600, itemSpacing: 24, children: [
    mkText('Products'), mkText('Resources'), mkText('About'), mkText('Contact')
  ]});
  var cards = [];
  for (var i = 0; i < 4; i++) cards.push(mkFrame({ name: 'Card ' + i, width: 320, height: 400 }));
  var grid = mkFrame({ name: 'Cards', layoutMode: 'HORIZONTAL', width: 1376, itemSpacing: 32, children: cards });
  var split = mkFrame({ name: 'Split', layoutMode: 'HORIZONTAL', width: 1376, itemSpacing: 64, children: [
    mkFrame({ name: 'Copy', width: 700, height: 300 }),
    mkFrame({ name: 'Image', width: 612, height: 300 })
  ]});
  return mkFrame({ name: 'Home', layoutMode: 'VERTICAL', width: 1440, itemSpacing: 96,
                   paddingLeft: 32, paddingRight: 32, children: [nav, split, grid] });
}

async function run() {
  // ── 1 ── inference ────────────────────────────────────────────────────
  freshPage();
  writeBreakpointConfig(CFG);
  var home = buildPage();
  var inf = inferResponsiveRules(home, CFG);
  ok(inf.proposals.length > 0, 'proposals produced  (' + inf.proposals.length + ')');

  function find(name, bp, rule) {
    return inf.proposals.filter(function (p) {
      return p.name === name && p.breakpoint === bp && p.rule === rule;
    })[0];
  }

  ok(!!find('Split', 'Mobile', 'stack'), 'the two unequal columns are proposed to stack at Mobile');
  ok(!!find('Split', 'Tablet', 'stack'), 'and at Tablet');
  var gridProp = find('Cards', 'Mobile', 'cols');
  ok(!!gridProp, 'the 4-card grid is proposed to drop columns, not stack');
  if (gridProp) ok(gridProp.value < 4, 'to fewer than four  (' + gridProp.value + ')');
  ok(!!find('Nav', 'Mobile', 'hide'), 'the nav is proposed to hide at Mobile');
  ok(find('Split', 'Mobile', 'stack').reason.indexOf('px') !== -1, 'each proposal explains itself with real numbers');

  // nothing is proposed for the widest breakpoint — it IS the design
  eq(inf.proposals.filter(function (p) { return p.breakpoint === 'Desktop'; }).length, 0,
     'nothing proposed for the widest breakpoint');

  // a page that already fits needs nothing
  freshPage(); writeBreakpointConfig(CFG);
  var small = mkFrame({ name: 'Tiny', layoutMode: 'VERTICAL', width: 300, children: [mkText('hi')] });
  eq(inferResponsiveRules(small, CFG).proposals.length, 0, 'a frame that already fits proposes nothing');

  // ── 2 ── rules round trip ─────────────────────────────────────────────
  freshPage();
  var n = mkFrame({ name: 'X' });
  eq(readRules(n), null, 'no rules to begin with');
  writeRules(n, { Mobile: { stack: true } });
  eq(readRules(n).Mobile.stack, true, 'rules read back');
  n.setPluginData('uikit.rules', '{{{ not json');
  eq(readRules(n), null, 'corrupt rules read as absent rather than throwing');

  // ── 3 ── structureHash ────────────────────────────────────────────────
  freshPage();
  var a = mkFrame({ name: 'A', layoutMode: 'VERTICAL', children: [mkText('hello')] });
  var h1 = structureHash(a);
  a.resize(999, 888);
  eq(structureHash(a), h1, 'resizing does NOT change the hash — auto layout and modes compute size');
  a.children[0].characters = 'goodbye';
  ok(structureHash(a) !== h1, 'editing text DOES change it');
  var b = mkFrame({ name: 'A', layoutMode: 'VERTICAL', children: [mkText('hello')] });
  eq(structureHash(b), h1, 'two structurally identical trees hash the same');
  b.children[0].visible = false;
  ok(structureHash(b) !== h1, 'hiding a layer changes it');

  // ── 4 ── generation ───────────────────────────────────────────────────
  freshPage();
  writeBreakpointConfig(CFG);
  await generateScaleVariables(CFG, defaultScaleTable(CFG));
  var page = buildPage();
  figma.currentPage.appendChild(page);
  var inf2 = inferResponsiveRules(page, CFG);
  await saveResponsiveRules(inf2.byNode, {});

  // Make fluid comes first, as the workflow does: generating from a design
  // whose children cannot shrink is what produced four broken frames in a
  // real file, and is now refused.
  await makeFrameFluid(page, { narrowestWidth: 375 });
  figma.currentPage.selection = [page];
  var g = await generateResponsiveFrames(CFG, {});
  eq(g.created, 2, 'one frame per narrower breakpoint');
  eq(g.skipped, 0, 'nothing skipped');
  eq(g.frames.length, 2, 'two frames reported');
  eq(g.frames[0].breakpoint, 'Tablet', 'Tablet first');
  eq(g.frames[1].breakpoint, 'Mobile', 'then Mobile');

  var mobile = figma.currentPage.children.filter(function (c) { return c.name === 'Home — Mobile'; })[0];
  ok(!!mobile, 'the Mobile frame is on the page');
  eq(mobile.width, 375, 'resized to the breakpoint width');
  eq(mobile.getPluginData('uikit.generatedFrom'), page.id, 'stamped with its source');
  eq(mobile.getPluginData('uikit.breakpoint'), 'Mobile', 'and its breakpoint');
  ok(!!mobile.getPluginData('uikit.hash'), 'and a hash');

  var mNav = mobile.children.filter(function (c) { return c.name === 'Nav'; })[0];
  eq(mNav.visible, false, 'the nav really was hidden on the clone');
  var mSplit = mobile.children.filter(function (c) { return c.name === 'Split'; })[0];
  eq(mSplit.layoutMode, 'VERTICAL', 'the split really was stacked');
  eq(mSplit.children[0].layoutSizingHorizontal, 'FILL', 'and its children set to fill');
  var mCards = mobile.children.filter(function (c) { return c.name === 'Cards'; })[0];
  eq(mCards.layoutWrap, 'WRAP', 'the grid wraps');

  // the SOURCE is untouched
  eq(page.children[0].visible, true, 'the source nav is still visible');
  eq(page.children[1].layoutMode, 'HORIZONTAL', 'the source split is still a row');
  eq(page.width, 1440, 'and the source is still its original width');

  // ── 5 ── regenerating replaces an untouched frame ─────────────────────
  var g2 = await generateResponsiveFrames(CFG, {});
  eq(g2.replaced, 2, 'both untouched frames replaced');
  eq(g2.skipped, 0, 'nothing skipped');
  eq(figma.currentPage.children.filter(function (c) { return c.name === 'Home — Mobile'; }).length, 1,
     'and there is still exactly one of each — no pile-up');

  // ── 6 ── a hand-edited frame is left alone ────────────────────────────
  var live = figma.currentPage.children.filter(function (c) { return c.name === 'Home — Mobile'; })[0];
  live.children[0].name = 'Nav (reworked by hand)';
  var g3 = await generateResponsiveFrames(CFG, {});
  eq(g3.skipped, 1, 'the edited frame is skipped');
  ok(g3.reasons.join(' ').indexOf('edited since') !== -1, 'and the reason says why');
  var stillThere = figma.currentPage.children.filter(function (c) { return c.name === 'Home — Mobile'; })[0];
  eq(stillThere.children[0].name, 'Nav (reworked by hand)', 'the hand edit survived — nothing was overwritten');

  // ── 7 ── guards ───────────────────────────────────────────────────────
  figma.currentPage.selection = [];
  var g4 = await generateResponsiveFrames(CFG, {});
  ok(g4.reasons.join(' ').indexOf('exactly one frame') !== -1, 'no selection is refused');

  figma.currentPage.selection = [stillThere];
  var g5 = await generateResponsiveFrames(CFG, {});
  ok(g5.reasons.join(' ').indexOf('was itself generated') !== -1,
     'generating FROM a generated frame is refused, not silently nested');

  // ── 8 ── presets ──────────────────────────────────────────────────────
  var t4 = defaultScaleTable(CFG, { spacing: 'grid4' });
  var s300 = t4.filter(function (r) { return r.name === 'space/300'; })[0];
  eq(s300.values['*'], 24, '4pt grid: space/300 is 24');

  var t8 = defaultScaleTable(CFG, { spacing: 'grid8' });
  eq(t8.filter(function (r) { return r.name === 'space/300'; })[0].values['*'], 24, '8pt grid: space/300 is 24');

  var tBase = defaultScaleTable(CFG, { spacing: 'grid4', spacingBase: 8 });
  eq(tBase.filter(function (r) { return r.name === 'space/300'; })[0].values['*'], 48,
     'doubling the base doubles the ramp');

  var tw = defaultScaleTable(CFG, { spacing: 'tailwind' });
  ok(!!tw.filter(function (r) { return r.name === 'space/4'; })[0], 'tailwind names come through');
  eq(tw.filter(function (r) { return r.name === 'space/4'; })[0].values['*'], 16, 'tailwind 4 is 16px');

  var ts = defaultScaleTable(CFG, { spacing: 'tshirt' });
  ok(!!ts.filter(function (r) { return r.name === 'space/md'; })[0], 't-shirt names come through');

  var rad = defaultScaleTable(CFG, { radius: 'pill' });
  eq(rad.filter(function (r) { return r.name === 'radius/md'; })[0].values['*'], 16, 'pill radius md is 16');

  // ── 9 ── through the handler ──────────────────────────────────────────
  freshPage();
  writeBreakpointConfig(CFG);
  var page2 = buildPage();
  figma.currentPage.appendChild(page2);
  await makeFrameFluid(page2, { narrowestWidth: 375 });
  figma.currentPage.selection = [page2];
  globalThis.__posted = [];
  await figma.ui.onmessage({ type: 'uikit-infer', requestId: 'x1' });
  var d = posted2('uikit-done')[0];
  ok(!!d, 'infer reports done');
  ok(d.result.proposals.length > 0, 'and carries the proposals to the UI');
  ok(d.message.indexOf('Proposed') !== -1, 'with a message: ' + d.message);

  globalThis.__posted = [];
  await figma.ui.onmessage({ type: 'uikit-responsive', requestId: 'x2', byNode: d.result.byNode, accepted: {} });
  var d2 = posted2('uikit-done')[0];
  ok(!!d2, 'responsive generation reports done');
  eq(d2.result.created, 2, 'two frames created through the handler');

  // 9b ── unticking a proposal drops it
  freshPage();
  writeBreakpointConfig(CFG);
  var page3 = buildPage();
  figma.currentPage.appendChild(page3);
  var inf3 = inferResponsiveRules(page3, CFG);
  var navProp = inf3.proposals.filter(function (p) { return p.name === 'Nav' && p.rule === 'hide' && p.breakpoint === 'Mobile'; })[0];
  var rejected = {};
  rejected[navProp.nodeId + '|Mobile|hide'] = false;
  await saveResponsiveRules(inf3.byNode, rejected);
  await makeFrameFluid(page3, { narrowestWidth: 375 });
  figma.currentPage.selection = [page3];
  await generateResponsiveFrames(CFG, {});
  var m3 = figma.currentPage.children.filter(function (c) { return c.name === 'Home — Mobile'; })[0];
  eq(m3.children.filter(function (c) { return c.name === 'Nav'; })[0].visible, true,
     'an unticked proposal is not applied');

  print('');
  print(fail === 0 ? ('ALL PASS (' + pass + ' assertions)') : (pass + ' passed, ' + fail + ' FAILED'));
}
run().catch(function (e) { print('THREW: ' + e + '\n' + (e && e.stack)); });
