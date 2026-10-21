// ── Make a frame genuinely fluid: drag the width, everything adapts ───────
var ONMSG7 = figma.ui.onmessage;
function fresh7() { resetFigma(); figma.ui.onmessage = ONMSG7; globalThis.__posted = [];
                    figma._fonts = ['Inter|Regular', 'Inter|Medium', 'Inter|Semi Bold']; }
function posted7(t) { return (globalThis.__posted || []).filter(function (m) { return m.type === t; }); }

var pass = 0, fail = 0;
function ok(c, l) { if (c) pass++; else { fail++; print('  FAIL: ' + l); } }
function eq(a, b, l) { ok(a === b, l + '  (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }

function kid(node, name) {
  return (node.children || []).filter(function (c) { return c.name === name; })[0];
}

// A page shaped like a real one: a card grid, a copy block, an icon row.
function page() {
  var cards = [];
  for (var i = 0; i < 4; i++) {
    cards.push(mkFrame({ name: 'Card ' + i, layoutMode: 'VERTICAL', width: 320, height: 400,
      children: [mkText('Card heading'), mkText('Some supporting copy that runs on a bit.')] }));
  }
  var grid = mkFrame({ name: 'Cards', layoutMode: 'HORIZONTAL', width: 1376, itemSpacing: 32, children: cards });

  var copy = mkFrame({ name: 'Copy', layoutMode: 'VERTICAL', width: 1376, itemSpacing: 16, children: [
    mkText('A heading'), mkText('A paragraph of body copy that should wrap rather than overflow.')
  ]});

  var icons = mkFrame({ name: 'Icons', layoutMode: 'HORIZONTAL', width: 200, itemSpacing: 8, children: [
    mkFrame({ name: 'Icon', width: 24, height: 24 }),
    mkFrame({ name: 'Icon', width: 24, height: 24 }),
    mkFrame({ name: 'Icon', width: 24, height: 24 })
  ]});

  return mkFrame({ name: 'Home', layoutMode: 'VERTICAL', width: 1440, itemSpacing: 96,
                   paddingLeft: 32, paddingRight: 32, children: [copy, grid, icons] });
}

async function run() {
  // ── 1 ── the card grid becomes a wrapping grid ────────────────────────
  fresh7();
  var home = page();
  figma.currentPage.appendChild(home);
  var r = await makeFrameFluid(home, { minCardWidth: 260 });

  var grid = kid(home, 'Cards');
  eq(grid.layoutWrap, 'WRAP', 'the row of equal cards now WRAPS — this is what makes it reflow');
  eq(grid.children[0].layoutSizingHorizontal, 'FILL', 'its cards fill the width');
  ok(grid.children[0].minWidth > 0, 'and carry a minimum width  (' + grid.children[0].minWidth + ')');
  eq(grid.children[0].minWidth, 260, 'capped at the minimum card width');
  eq(grid.counterAxisSpacing, grid.itemSpacing, 'with a row gap matching the column gap');
  ok(r.wrapped >= 1, 'reported as wrapped');

  // ── 2 ── text wraps instead of overflowing ────────────────────────────
  var copy = kid(home, 'Copy');
  eq(copy.children[1].textAutoResize, 'HEIGHT', 'body copy grows in height');
  eq(copy.children[1].layoutSizingHorizontal, 'FILL', 'and fills the width instead of running past it');
  ok(r.text >= 2, 'reported');

  // ── 3 ── icons keep their size ────────────────────────────────────────
  var icons = kid(home, 'Icons');
  ok(icons.children[0].layoutSizingHorizontal !== 'FILL', 'a 24px icon is NOT stretched');
  ok(r.fixedKept >= 3, 'reported as deliberately kept fixed  (' + r.fixedKept + ')');

  // ── 4 ── the root gets a floor and a ceiling ──────────────────────────
  fresh7();
  var h2 = page();
  figma.currentPage.appendChild(h2);
  var r2 = await makeFrameFluid(h2, { rootMinWidth: 375, rootMaxWidth: 1440 });
  eq(h2.minWidth, 375, 'the root cannot collapse below the narrowest canvas');
  eq(h2.maxWidth, 1440, 'nor stretch past the widest');

  // ── 5 ── a GROUP with no auto layout gets one ─────────────────────────
  fresh7();
  var loose = mkFrame({ name: 'Loose', width: 800, children: [
    mkFrame({ name: 'A', width: 240, height: 100 }),
    mkFrame({ name: 'B', width: 240, height: 100 })
  ]});
  loose.layoutMode = 'NONE';
  loose.children[0].x = 0; loose.children[0].y = 0;
  loose.children[1].x = 280; loose.children[1].y = 0;
  figma.currentPage.appendChild(loose);
  var r3 = await makeFrameFluid(loose, {});
  ok(loose.layoutMode === 'HORIZONTAL' || loose.layoutMode === 'VERTICAL',
     'a frame without auto layout is given one  (' + loose.layoutMode + ')');
  ok(r3.autoLayout >= 1, 'reported');

  // ── 6 ── FILL is never set where Figma would refuse it ────────────────
  // The mock throws exactly as the API does, so a clean run proves the
  // code respects "FILL is only valid on auto-layout children".
  fresh7();
  var orphan = mkFrame({ name: 'Orphan', width: 400, children: [mkText('hello')] });
  orphan.layoutMode = 'NONE';
  var r4 = await makeFrameFluid(orphan, {});
  eq(r4.refused, 0, 'nothing was refused — the code checks before it sets');

  // ── 7 ── running it twice changes nothing new ─────────────────────────
  fresh7();
  var h3 = page();
  figma.currentPage.appendChild(h3);
  await makeFrameFluid(h3, {});
  var before = JSON.stringify({
    wrap: kid(h3, 'Cards').layoutWrap,
    fill: kid(h3, 'Cards').children[0].layoutSizingHorizontal,
    min: kid(h3, 'Cards').children[0].minWidth
  });
  var r5 = await makeFrameFluid(h3, {});
  var after = JSON.stringify({
    wrap: kid(h3, 'Cards').layoutWrap,
    fill: kid(h3, 'Cards').children[0].layoutSizingHorizontal,
    min: kid(h3, 'Cards').children[0].minWidth
  });
  eq(after, before, 'a second run leaves the layout identical');
  eq(r5.refused, 0, 'and refuses nothing');

  // ── 8 ── through the handler, using the configured canvas sizes ───────
  fresh7();
  writeBreakpointConfig({ preset: 'custom', breakpoints: [
    { name: 'Desktop', width: 1440 }, { name: 'Mobile', width: 375 }] });
  var h4 = page();
  figma.currentPage.appendChild(h4);
  figma.currentPage.selection = [h4];
  globalThis.__posted = [];
  await figma.ui.onmessage({ type: 'uikit-fluid', requestId: 'f1' });
  var d = posted7('uikit-done')[0];
  ok(!!d, 'the fluid action reports done');
  eq(d.tone, 'success', 'and succeeds');
  ok(d.message.indexOf('reflow') !== -1, 'telling you what to do next: ' + d.message);
  eq(h4.minWidth, 375, 'the floor came from the narrowest configured canvas');
  eq(h4.maxWidth, 1440, 'the ceiling from the widest');

  // 8b ── nothing selected
  figma.currentPage.selection = [];
  globalThis.__posted = [];
  await figma.ui.onmessage({ type: 'uikit-fluid', requestId: 'f2' });
  var d2 = posted7('uikit-done')[0];
  eq(d2.tone, 'warning', 'no selection warns');
  ok(d2.message.indexOf('Select a frame') !== -1, 'and asks for one');

  print('');
  print(fail === 0 ? ('ALL PASS (' + pass + ' assertions)') : (pass + ' passed, ' + fail + ' FAILED'));
}
run().catch(function (e) { print('THREW: ' + e + '\n' + (e && e.stack)); });
