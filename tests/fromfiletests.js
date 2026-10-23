// ── Build from an existing file: measure the design, then put it back ─────
//
// The question this path answers is not "what does this page say its scale
// is" — that is the canvas parser — but "what is this page actually built
// from". So the tests build a design with deliberate measurements in it and
// check the system that comes back carries those same numbers.
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
  var st = figma.createPaintStyle(); st.name = name; st.paints = [solid(hex)]; return st;
}
function textStyle(name, size) {
  var st = figma.createTextStyle(); st.name = name;
  st.fontName = { family:'Inter', style:'Regular' }; st.fontSize = size; return st;
}

// A page with measurements worth recovering: a 1440 canvas, a 1200 content
// column (so a 120px margin), gaps of 8/16/24/32, radii of 8, a heading
// ladder of 56/40/28/20 over 16px body, and three colours.
function designPage(opts) {
  opts = opts || {};
  var page = mkFrame({ name: opts.name || 'Homepage', width: opts.width || 1440, height: 2400 });
  figma.currentPage.appendChild(page);

  for (var s = 0; s < 3; s++) {
    var section = mkFrame({ name: 'Section ' + s, width: page.width, height: 600 });
    section.layoutMode = 'VERTICAL';
    section.paddingTop = 32; section.paddingBottom = 32;
    section.itemSpacing = 24;
    page.appendChild(section);

    var container = mkFrame({ name: 'Container', width: 1200, height: 500 });
    container.layoutMode = 'VERTICAL';
    container.itemSpacing = 16;
    container.paddingLeft = 24; container.paddingRight = 24;
    section.appendChild(container);

    var card = mkFrame({ name: 'Card', width: 380, height: 220 });
    card.layoutMode = 'VERTICAL';
    card.cornerRadius = 8; card.itemSpacing = 8;
    card.paddingLeft = 16; card.paddingRight = 16;
    card.paddingTop = 16; card.paddingBottom = 16;
    card.fills = [solid('#FFFFFF')];
    container.appendChild(card);

    var h = mkText('A heading for section ' + s, 'H');
    h.fontSize = [56, 40, 28][s];
    h.fills = [solid('#111111')];
    container.appendChild(h);

    var sub = mkText('A smaller heading', 'Sub');
    sub.fontSize = 20;
    sub.fills = [solid('#111111')];
    container.appendChild(sub);

    // body copy, deliberately the most text on the page
    for (var b = 0; b < 4; b++) {
      var p = mkText('Body copy that runs on for a while so that sixteen is clearly the body size on this page.', 'Body');
      p.fontSize = 16;
      p.fills = [solid('#374151')];
      card.appendChild(p);
    }
    var cta = mkFrame({ name: 'Button', width: 160, height: 48 });
    cta.fills = [solid('#2563EB')];
    cta.cornerRadius = 8;
    card.appendChild(cta);
  }
  return page;
}
function selectPage(p) { figma.currentPage.selection = [p]; return p; }

async function run() {
  // ── 1 ── nothing selected ─────────────────────────────────────────────
  fresh10();
  figma.currentPage.selection = [];
  var none = await buildFromExistingFile({ bindSelection: false });
  eq(none.measured, null, 'with nothing selected it measures nothing');
  ok(none.reasons.join(' ').indexOf('Select the frame') !== -1,
     'and asks for a frame  ("' + none.reasons[0] + '")');

  fresh10();
  var a = designPage({ name: 'A' }), b2 = designPage({ name: 'B' });
  figma.currentPage.selection = [a, b2];
  var many = await buildFromExistingFile({ bindSelection: false });
  ok(many.reasons.join(' ').indexOf('one frame') !== -1,
     'two frames is refused with a reason  ("' + many.reasons[0] + '")');

  // ── 2 ── the canvas is measured, not assumed ──────────────────────────
  fresh10();
  var page = selectPage(designPage({ width: 1600 }));
  var r = await buildFromExistingFile({ bindSelection: false });
  eq(r.seededBreakpoints, true, 'canvas sizes were set up around the frame');
  eq(r.cfg.breakpoints.length, 3, 'Desktop, Tablet and Mobile');
  eq(r.cfg.breakpoints[0].width, 1600, 'and Desktop is the frame that was measured');
  eq(r.cfg.breakpoints[0].name, 'Desktop', 'named Desktop');
  eq(r.cfg.breakpoints[2].name, 'Mobile', 'down to Mobile');
  eq(r.measured.canvasWidth, 1600, 'the measurement records the canvas width');
  eq(r.measured.frameName, 'Homepage', 'and which frame it read');

  // ── 3 ── the margin comes from where the content actually sits ────────
  fresh10();
  page = selectPage(designPage({ width: 1440 }));   // 1200 container inside 1440
  r = await buildFromExistingFile({ bindSelection: false });
  eq(r.measured.margin, 120, 'the margin is measured from the content column');
  var cols = await getUiKitCollections(false);
  var cfg = readBreakpointConfig();
  var modes = await ensureModes(cols.responsive, breakpointNames(cfg));
  var floats = await localVariablesAllModes('FLOAT');
  function byName(list, n) {
    return list.filter(function (e) { return e.variable.name === n; })[0];
  }
  var margin = byName(floats, 'grid/margin');
  ok(!!margin, 'and it became a responsive token');
  if (margin) {
    var mWide = await variableValue(margin.variable, modes.nameToModeId['Desktop']);
    var mNarrow = await variableValue(margin.variable, modes.nameToModeId['Mobile']);
    eq(mWide, 120, 'the widest keeps exactly what was measured');
    ok(mNarrow < mWide && mNarrow >= 16, 'and the narrowest tightens but stays usable  (' + mNarrow + ')');
  }
  var container = byName(floats, 'container/max');
  ok(!!container, 'the content column became a token too');
  if (container) {
    var cWide = await variableValue(container.variable, modes.nameToModeId['Desktop']);
    eq(cWide, 1200, 'matching the column that was measured');
  }

  // ── 4 ── spacing is the ladder the design climbs ──────────────────────
  var spaceVals = [];
  floats.forEach(function (e) {
    if (e.variable.name.indexOf('space/') === 0) {
      spaceVals.push(e.resolved[cols.primitives.modes[0].modeId]);
    }
  });
  spaceVals.sort(function (x, y) { return x - y; });
  ok(spaceVals.length >= 4, 'the repeated gaps became tokens  (' + spaceVals.join(', ') + ')');
  [8, 16, 24, 32].forEach(function (v) {
    ok(spaceVals.indexOf(v) !== -1, 'including the ' + v + 'px the design repeats');
  });
  ok(spaceVals.indexOf(0) === -1, 'and zero is never a step');

  // ── 5 ── headings are ranked h1…h6, body is the most-used size ────────
  var h1 = byName(floats, 'text/size/h1'), h2 = byName(floats, 'text/size/h2'),
      h3 = byName(floats, 'text/size/h3'), body = byName(floats, 'text/size/body');
  ok(!!h1 && !!h2 && !!h3, 'the heading sizes became h1, h2 and h3');
  ok(!!body, 'and the most-used size became body');
  if (h1 && h2 && h3 && body) {
    var v1 = await variableValue(h1.variable, modes.nameToModeId['Desktop']);
    var v2 = await variableValue(h2.variable, modes.nameToModeId['Desktop']);
    var v3 = await variableValue(h3.variable, modes.nameToModeId['Desktop']);
    var vb = await variableValue(body.variable, modes.nameToModeId['Desktop']);
    eq(v1, 56, 'h1 is the largest size on the page');
    eq(v2, 40, 'h2 the next');
    eq(v3, 28, 'h3 the next');
    eq(vb, 16, 'and body is the size most of the words are set in');
    ok(v1 > v2 && v2 > v3 && v3 > vb, 'the ranking holds all the way down');
    var m1 = await variableValue(h1.variable, modes.nameToModeId['Mobile']);
    ok(m1 < v1 && m1 >= 18, 'h1 shrinks on mobile but stays a heading  (' + m1 + ')');
    var mb = await variableValue(body.variable, modes.nameToModeId['Mobile']);
    ok(mb >= 14, 'body never shrinks below readable  (' + mb + ')');
  }

  // ── 6 ── the colours it paints with ───────────────────────────────────
  var colours = await localVariablesWithValues('COLOR');
  var cnames = colours.map(function (e) { return e.variable.name; });
  ok(cnames.length >= 3, 'the design colours became tokens  (' + cnames.join(', ') + ')');
  ok(cnames.every(function (n) { return n.indexOf('color/') === 0; }), 'each named as a colour token');

  // ── 7 ── and it is bound back into the design it came from ────────────
  fresh10();
  page = selectPage(designPage({ width: 1440 }));
  var bound = await buildFromExistingFile({});
  ok(bound.applied && bound.applied.bound > 0,
     'the system is applied back  (' + (bound.applied ? bound.applied.bound : 0) + ')');
  eq(bound.applied.failed, 0, 'with nothing refused');

  // the design still looks like itself: a card still has 16px padding, and
  // that padding now comes from a variable
  function deep(node, pred, out) {
    out = out || [];
    if (pred(node)) out.push(node);
    if (node.children) for (var i = 0; i < node.children.length; i++) deep(node.children[i], pred, out);
    return out;
  }
  var card = deep(page, function (n) { return n.name === 'Card'; })[0];
  ok(!!card, 'the card survived');
  if (card) {
    eq(card.paddingLeft, 16, 'its padding is unchanged');
    ok(!!card.boundVariables.paddingLeft, 'but now follows a token');
    eq(card.cornerRadius, 8, 'and its radius is unchanged');
  }
  var heading = deep(page, function (n) { return n.type === 'TEXT' && n.fontSize === 56; })[0];
  ok(!!heading, 'the h1 is still 56px');
  if (heading) ok(!!heading.boundVariables.fontSize, 'and now follows the h1 token');

  // ── 8 ── styles the file already names are kept, not overruled ────────
  fresh10();
  paintStyle('Brand / Primary', '#2563EB');
  paintStyle('Neutral / Body', '#6B7280');
  textStyle('Heading / H1', 61);
  page = selectPage(designPage({ width: 1440 }));
  var withStyles = await buildFromExistingFile({ bindSelection: false });
  eq(withStyles.paints.adopted, 2, 'every colour style became a token');
  eq(withStyles.paints.bound, 2, 'and each style now follows its token');
  eq(withStyles.texts.adopted, 1, 'the text style too');
  eq(withStyles.texts.bound, 1, 'and the text style now follows its size token');
  var ts0 = figma._textStyles.filter(function (t) { return t.name === 'Heading / H1'; })[0];
  ok(ts0 && ts0.boundVars && ts0.boundVars.fontSize,
     'so a layer wearing that style resizes with the canvas instead of staying at its desktop size');
  var named = (await localVariablesWithValues('COLOR')).map(function (e) { return e.variable.name; });
  ok(named.indexOf('color/brand/primary') !== -1,
     'keeping the name the designer chose  (' + named.slice(0, 5).join(', ') + ')');
  var st0 = figma._paintStyles.filter(function (s) { return s.name === 'Brand / Primary'; })[0];
  ok(st0.paints[0].boundVariables && st0.paints[0].boundVariables.color,
     'so every layer already using that style follows a token, with nothing to re-apply');

  // ── 9 ── a gradient style is left alone, with a reason ────────────────
  fresh10();
  var gradient = figma.createPaintStyle();
  gradient.name = 'Hero gradient';
  gradient.paints = [{ type: 'GRADIENT_LINEAR' }];
  paintStyle('Brand', '#2563EB');
  selectPage(designPage({ width: 1440 }));
  var g = await buildFromExistingFile({ bindSelection: false });
  eq(g.paints.adopted, 1, 'only the solid one is adopted');
  eq(g.paints.skipped, 1, 'the gradient is skipped');
  ok(g.reasons.join(' ').indexOf('single solid colour') !== -1, 'and said so');

  // ── 10 ── running it twice writes nothing new ─────────────────────────
  fresh10();
  page = selectPage(designPage({ width: 1440 }));
  var first = await buildFromExistingFile({ bindSelection: false });
  var second = await buildFromExistingFile({ bindSelection: false });
  eq(second.generated.created, 0, 'a second run creates no new variables');
  ok(second.generated.reused > 0, 'it recognises the ones it wrote  (' + second.generated.reused + ')');

  // ── 11 ── through the handler ─────────────────────────────────────────
  fresh10();
  page = selectPage(designPage({ width: 1440 }));
  globalThis.__posted = [];
  await figma.ui.onmessage({ type: 'uikit-from-file', requestId: 'f1' });
  var d = posted10('uikit-done')[0];
  ok(!!d, 'it reports done');
  if (d) {
    eq(d.tone, 'success', 'and succeeds');
    ok(d.message.indexOf('measured "Homepage" at 1440px') !== -1,
       'saying what it measured: "' + d.message + '"');
    ok(d.message.indexOf('bound back into the design') !== -1, 'and that it was applied back');
    ok(!!d.result.measured, 'the reply carries the measurements for the UI to show');
    ok(!!d.state.fileHas, 'and the state reports what the file holds');
  }

  // ── 12 ── nothing selected, through the handler ───────────────────────
  fresh10();
  figma.currentPage.selection = [];
  globalThis.__posted = [];
  await figma.ui.onmessage({ type: 'uikit-from-file', requestId: 'f2' });
  var w = posted10('uikit-done')[0];
  ok(!!w, 'it still answers');
  if (w) {
    eq(w.tone, 'warning', 'as a warning rather than a success');
    ok(w.message.indexOf('Select the frame') !== -1, 'telling the designer what to do: "' + w.message + '"');
  }

  // ── 13 ── the whole story, in the order a designer does it ───────────
  // Select a frame, build the system from it, then generate the responsive
  // versions. The point of measuring the canvas is that the sizes the
  // frames come out at are the ones the design was built for.
  fresh10();
  page = selectPage(designPage({ width: 1600 }));
  globalThis.__posted = [];
  await figma.ui.onmessage({ type: 'uikit-from-file', requestId: 's1' });
  var built = posted10('uikit-done')[0];
  ok(!!built && built.tone === 'success', 'step 1: the system is built from the selected frame');

  figma.currentPage.selection = [page];
  globalThis.__posted = [];
  await figma.ui.onmessage({ type: 'uikit-fluid', requestId: 's2' });
  var fluid = posted10('uikit-done')[0];
  ok(!!fluid, 'step 2: the frame is made fluid');

  figma.currentPage.selection = [page];
  globalThis.__posted = [];
  await figma.ui.onmessage({ type: 'uikit-responsive', requestId: 's3' });
  var resp = posted10('uikit-done')[0];
  ok(!!resp, 'step 3: the responsive versions are generated');
  if (resp) {
    var made = figma.currentPage.children.map(function (c) { return c.name; });
    var tablet = figma.currentPage.children.filter(function (c) { return /Tablet/.test(c.name); })[0];
    var mobile = figma.currentPage.children.filter(function (c) { return /Mobile/.test(c.name); })[0];
    ok(!!tablet, 'a Tablet frame  (' + made.join(' | ') + ')');
    ok(!!mobile, 'and a Mobile frame');
    if (tablet) eq(tablet.width, 768, 'at the Tablet width');
    if (mobile) eq(mobile.width, 375, 'and the Mobile width');
    eq(page.width, 1600, 'while the design that was measured keeps its own width');
  }

  print('');
  if (fail === 0) print('ALL PASS (' + pass + ' assertions)');
  else print(fail + ' FAILED, ' + pass + ' passed');
}
run().catch(function (e) { print('THREW: ' + (e && e.stack || e)); });
