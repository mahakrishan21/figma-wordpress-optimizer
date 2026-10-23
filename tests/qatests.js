// ── QA sweep: every feature, driven through the real message entry point ──
//
// The other suites each test one feature in depth by calling its function.
// This one goes in the way the UI does — figma.ui.onmessage — so it also
// covers routing, the undo contract, the requestId correlation the UI needs
// to match a reply to the button that asked for it, and the summary line
// the user actually reads.
var ONMSGQ = figma.ui.onmessage;
var undoCount = 0;
function freshQ() {
  resetFigma(); figma.ui.onmessage = ONMSGQ; globalThis.__posted = [];
  figma._fonts = ['Inter|Regular', 'Inter|Medium', 'Inter|Semi Bold'];
  undoCount = 0;
  figma.commitUndo = function () { undoCount++; };
}

var pass = 0, fail = 0;
function ok(c, l) { if (c) pass++; else { fail++; print('  FAIL: ' + l); } }
function eq(a, b, l) { ok(a === b, l + '  (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }

var seq = 0;
// Send exactly as the UI does, and hand back the single reply it correlates.
async function send(msg) {
  var id = 'q' + (++seq);
  globalThis.__posted = [];
  await figma.ui.onmessage(Object.assign({ requestId: id }, msg));
  var replies = (globalThis.__posted || []).filter(function (m) {
    return m.type === 'uikit-done' || m.type === 'uikit-error' || m.type === 'uikit-state';
  });
  var mine = replies.filter(function (m) { return m.requestId === id || m.type === 'uikit-state'; });
  return { reply: mine[mine.length - 1], all: replies, id: id };
}
function okReply(res, label) {
  var r = res.reply;
  if (!r) { fail++; print('  FAIL: ' + label + ' — no reply at all'); return null; }
  if (r.type === 'uikit-error') { fail++; print('  FAIL: ' + label + ' — errored: ' + r.message); return null; }
  pass++;
  return r;
}

var BPS = [{ name: 'Desktop', width: 1440 }, { name: 'Tablet', width: 768 }, { name: 'Mobile', width: 375 }];
var CFG = { preset: 'custom', breakpoints: BPS };

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
// A plausible desktop design to run the adopt / fluid / responsive paths on.
function makeDesign() {
  var page = mkFrame({ name: 'Home', width: 1440, height: 900 });
  page.layoutMode = 'VERTICAL';
  figma.currentPage.appendChild(page);
  var row = mkFrame({ name: 'Cards', width: 1200, height: 300 });
  row.layoutMode = 'HORIZONTAL';
  row.itemSpacing = 24; row.paddingLeft = 24; row.paddingRight = 24;
  row.paddingTop = 32; row.paddingBottom = 32;
  page.appendChild(row);
  for (var i = 0; i < 4; i++) {
    var card = mkFrame({ name: 'Card ' + (i + 1), width: 280, height: 220 });
    card.layoutMode = 'VERTICAL';
    card.cornerRadius = 8; card.itemSpacing = 16;
    card.paddingLeft = 24; card.paddingRight = 24; card.paddingTop = 24; card.paddingBottom = 24;
    card.fills = [solid('#FFFFFF')];
    row.appendChild(card);
    var t = mkText('A card heading that is long enough to wrap when it narrows', 'Title ' + (i + 1));
    t.fontSize = 24; t.fills = [solid('#111111')];
    card.appendChild(t);
  }
  return page;
}

async function run() {
  // ══ 1 ══ a cold file: the tab must open without a system ══════════════
  freshQ();
  var s0 = await send({ type: 'uikit-scan' });
  var st0 = okReply(s0, 'scan answers on a cold file');
  if (st0) {
    eq(st0.type, 'uikit-state', 'scan replies with state');
    eq(st0.config, null, 'cold file has no breakpoint config');
    ok(!!st0.fileHas, 'state reports what the file holds');
    eq(st0.fileHas.paintStyles, 0, 'no paint styles yet');
    ok(Array.isArray(st0.presetNames) && st0.presetNames.length >= 4, 'breakpoint presets offered  (' + (st0.presetNames || []).length + ')');
    ok(!!st0.spacingPresets && !!st0.radiusPresets, 'spacing and radius presets offered');
    ok(Array.isArray(st0.elements) && st0.elements.length > 0, 'the element catalogue is offered  (' + (st0.elements || []).length + ')');
    ok(Array.isArray(st0.exportFormats) && st0.exportFormats.length > 0, 'export formats offered');
  }
  eq(undoCount, 0, 'a scan changes nothing, so it opens no undo group');

  // ══ 2 ══ every action that needs breakpoints refuses clearly without ══
  var needsConfig = ['uikit-generate', 'uikit-reseed', 'uikit-infer', 'uikit-responsive'];
  for (var i = 0; i < needsConfig.length; i++) {
    freshQ();
    var res = await send({ type: needsConfig[i], table: [] });
    var rep = res.reply;
    eq(rep && rep.type, 'uikit-error', needsConfig[i] + ' refuses without breakpoints');
    eq(rep && rep.requestId, res.id, needsConfig[i] + ' error carries the requestId the UI waits on');
    ok(rep && /breakpoint/i.test(rep.message || ''), needsConfig[i] + ' says what is missing  ("' + (rep && rep.message) + '")');
    ok(undoCount >= 1, needsConfig[i] + ' still closes its undo group on the way out');
  }

  // ══ 3 ══ setting up breakpoints ═══════════════════════════════════════
  freshQ();
  var bp = await send({ type: 'uikit-save-breakpoints', preset: 'custom', breakpoints: BPS });
  var bpr = okReply(bp, 'breakpoints save');
  if (bpr) {
    eq(bpr.tone, 'success', 'and it reads as a success');
    ok(/3 breakpoints/.test(bpr.message), 'the summary counts them  ("' + bpr.message + '")');
    eq(bpr.state.config.breakpoints.length, 3, 'the state comes back carrying them');
    eq(bpr.state.collections.responsive, true, 'the Responsive collection now exists');
    eq(bpr.state.collections.responsiveModes.length, 3, 'with one mode per canvas size');
  }
  var emptyBp = await send({ type: 'uikit-save-breakpoints', preset: 'custom', breakpoints: [] });
  eq(emptyBp.reply && emptyBp.reply.type, 'uikit-error', 'no breakpoints at all is refused');

  // the mode cap is probed, never predicted
  freshQ();
  figma._modeCap = 2;
  var capped = await send({ type: 'uikit-save-breakpoints', preset: 'custom', breakpoints: BPS });
  var cr = okReply(capped, 'hitting the mode cap is not an error');
  if (cr) {
    eq(cr.tone, 'warning', 'it warns instead');
    ok(/allows 2 modes/.test(cr.message), 'naming the real cap it measured  ("' + cr.message + '")');
    ok(/Nothing was changed/.test(cr.message), 'and says nothing was half-applied');
    eq(cr.state.config, null, 'the config was not written');
  }
  delete figma._modeCap;

  // ══ 4 ══ the preview table, which writes nothing ══════════════════════
  freshQ();
  await send({ type: 'uikit-save-breakpoints', preset: 'custom', breakpoints: BPS });
  var pv = await send({ type: 'uikit-preview-table', spec: { breakpoints: BPS, spacing: 'grid8', radius: 'rounded', ratio: 1.25 } });
  var pvr = okReply(pv, 'the wizard previews its table');
  if (pvr) {
    ok(pvr.result.rows.length > 0, 'the preview has rows  (' + pvr.result.rows.length + ')');
    eq(pvr.state.tableFromFile, false, 'flagged as a proposal, not what is in the file');
    eq(pvr.state.table.length, pvr.result.rows.length, 'and the state carries the proposal, not the file');
    eq((await localVariablesAllModes('FLOAT')).length, 0, 'previewing wrote no variables');
  }

  // ══ 5 ══ generate, then generate again ════════════════════════════════
  var gen = await send({ type: 'uikit-generate', table: defaultScaleTable(CFG, {}) });
  var gr = okReply(gen, 'the scale generates');
  if (gr) {
    ok(gr.result.created > 0, 'tokens created  (' + gr.result.created + ')');
    eq(gr.tone, 'success', 'and it reads as a success');
    ok(gr.state.table.length > 0, 'the state carries the table that is now in the file');
    eq(gr.state.tableFromFile, true, 'flagged as read from the file');
  }
  var gen2 = await send({ type: 'uikit-generate', table: defaultScaleTable(CFG, {}) });
  var gr2 = okReply(gen2, 'generating twice is safe');
  if (gr2) {
    eq(gr2.result.created, 0, 'the second run creates nothing');
    ok(gr2.result.reused > 0, 'it reuses what is there  (' + gr2.result.reused + ')');
  }

  // ══ 6 ══ the three tiers, as designed ═════════════════════════════════
  var cols = await getUiKitCollections(false);
  ok(!!cols.primitives && !!cols.theme && !!cols.responsive, 'all three collections exist');
  eq(cols.primitives.modes.length, 1, 'Primitives holds one mode');
  eq(cols.theme.modes.length, 2, 'Theme holds Light and Dark');
  eq(cols.responsive.modes.length, 3, 'Responsive holds one mode per canvas size');

  // a responsive token really does differ per mode
  var vars = (await localVariablesAllModes('FLOAT'));
  var resp = vars.filter(function (v) { return v.collection.id === cols.responsive.id; });
  ok(resp.length > 0, 'responsive tokens exist  (' + resp.length + ')');
  var varied = resp.filter(function (v) {
    var vals = cols.responsive.modes.map(function (m) { return v.resolved[m.modeId]; });
    return vals.some(function (x) { return x !== vals[0]; });
  });
  ok(varied.length > 0, 'and some step between canvas sizes  (' + varied.length + ' of ' + resp.length + ')');

  // ══ 7 ══ export, in every format offered ══════════════════════════════
  var fmts = (st0 && st0.exportFormats) ? st0.exportFormats.map(function (f) { return f.key; }) : [];
  ok(fmts.length > 0, 'there are formats to test  (' + fmts.join(', ') + ')');
  for (var f = 0; f < fmts.length; f++) {
    var ex = await send({ type: 'uikit-export', format: fmts[f] });
    var exr = okReply(ex, 'export as ' + fmts[f]);
    if (exr) {
      ok(!exr.result.empty, fmts[f] + ' is not empty');
      ok(typeof exr.result.text === 'string' && exr.result.text.length > 40, fmts[f] + ' produced real text  (' + ((exr.result.text || '').length) + ' chars)');
      ok(!/undefined|NaN|\[object/.test(exr.result.text), fmts[f] + ' has no undefined/NaN leaking into it');
    }
  }
  // theme.json is the WordPress payoff — check it is valid JSON and shaped right
  var wp = (fmts.indexOf('theme') !== -1) ? 'theme' : (fmts.indexOf('themejson') !== -1 ? 'themejson' : null);
  if (wp) {
    var wex = await send({ type: 'uikit-export', format: wp });
    if (wex.reply && wex.reply.result && wex.reply.result.text) {
      var parsed = null;
      try { parsed = JSON.parse(wex.reply.result.text); } catch (e) { parsed = null; }
      ok(!!parsed, 'theme.json parses as JSON');
      ok(!!(parsed && parsed.settings), 'and has a settings block');
    }
  }
  // JSON formats must parse
  for (var jf = 0; jf < fmts.length; jf++) {
    if (!/json/i.test(fmts[jf])) continue;
    var jx = await send({ type: 'uikit-export', format: fmts[jf] });
    if (jx.reply && jx.reply.result && jx.reply.result.text) {
      var pj = null;
      try { pj = JSON.parse(jx.reply.result.text); } catch (e) { pj = null; }
      ok(!!pj, fmts[jf] + ' parses as JSON');
    }
  }
  // an unknown format must not throw a raw exception at the user
  var bad = await send({ type: 'uikit-export', format: 'no-such-format' });
  ok(bad.reply && (bad.reply.type === 'uikit-error' || bad.reply.result), 'an unknown export format is handled, not crashed into');

  // ══ 8 ══ documenting on canvas ════════════════════════════════════════
  var canv = await send({ type: 'uikit-canvas' });
  var cvr = okReply(canv, 'the system documents itself on canvas');
  if (cvr) {
    ok(cvr.result.tokens > 0, 'tokens drawn  (' + cvr.result.tokens + ')');
    ok(cvr.result.sections > 0, 'across sections  (' + cvr.result.sections + ')');
  }

  // ══ 9 ══ elements ═════════════════════════════════════════════════════
  var els = await send({ type: 'uikit-elements', elements: ['button', 'input', 'card', 'badge', 'alert', 'avatar', 'navlink'] });
  var elr = okReply(els, 'the element kit builds');
  if (elr) {
    ok(elr.result.created > 0, 'elements created  (' + elr.result.created + ')');
    var comps = deep(figma.currentPage, function (n) { return n.type === 'COMPONENT_SET' || n.type === 'COMPONENT'; });
    ok(comps.length > 0, 'as real components  (' + comps.length + ')');
    var btnSet = comps.filter(function (n) { return n.type === 'COMPONENT_SET' && /button/i.test(n.name); })[0];
    ok(!!btnSet, 'Button is a variant set');
    if (btnSet) {
      eq(btnSet.layoutWrap, 'WRAP', 'and the matrix wraps instead of running off the page');
      var props = btnSet.componentPropertyDefinitions || {};
      var names = Object.keys(props).map(function (k) { return k.split('#')[0]; });
      ok(names.indexOf('Label') !== -1, 'with a Label text property  (' + names.join(', ') + ')');
    }
  }

  // ══ 10 ══ a canvas to design in ═══════════════════════════════════════
  var starter = await send({ type: 'uikit-starter' });
  var str = okReply(starter, 'a starter canvas is created');
  if (str) {
    ok(str.result.created === 1, 'one canvas');
    ok(str.result.bound > 0, 'with values bound to the system  (' + str.result.bound + ')');
    ok(/ready to design in/.test(str.message), 'and the summary names it  ("' + str.message + '")');
  }

  // ══ 11 ══ adopting an existing design ═════════════════════════════════
  freshQ();
  await send({ type: 'uikit-save-breakpoints', preset: 'custom', breakpoints: BPS });
  await send({ type: 'uikit-generate', table: defaultScaleTable(CFG, {}) });
  var design = makeDesign();
  figma.currentPage.selection = [design];

  var sv = await send({ type: 'uikit-survey' });
  var svr = okReply(sv, 'the survey finds what can be wired up');
  var proposals = svr ? svr.result.proposals : [];
  ok(proposals.length > 0, 'it proposes bindings  (' + proposals.length + ')');
  if (proposals.length) {
    var shapes = proposals.filter(function (p) { return p.key && p.nodeId && p.field && p.tokenId; });
    eq(shapes.length, proposals.length, 'every proposal names a node, a field and a token');
    var keys = {}; proposals.forEach(function (p) { keys[p.key] = (keys[p.key] || 0) + 1; });
    eq(Object.keys(keys).length, proposals.length, 'and every key is unique, so a tick cannot toggle two rows');
  }

  var ad = await send({ type: 'uikit-adopt', proposals: proposals, accepted: {} });
  var adr = okReply(ad, 'accepted proposals are applied');
  if (adr) {
    ok(adr.result.bound > 0, 'bindings written  (' + adr.result.bound + ')');
    eq(adr.result.failed, 0, 'none refused');
  }
  // and a second survey should find far less left to do
  var sv2 = await send({ type: 'uikit-survey' });
  if (sv2.reply && sv2.reply.result) {
    ok(sv2.reply.result.alreadyBound > 0, 'a re-survey sees what is already bound  (' + sv2.reply.result.alreadyBound + ')');
  }
  // unticking every row must bind nothing and say so, not quietly apply them
  var noneMap = {};
  proposals.forEach(function (p) { noneMap[p.key] = false; });
  var adNone = await send({ type: 'uikit-adopt', proposals: proposals, accepted: noneMap });
  if (adNone.reply && adNone.reply.type === 'uikit-done') {
    eq(adNone.reply.result.bound, 0, 'unticking every row binds nothing');
    eq(adNone.reply.result.skipped, proposals.length, 'and counts them all as left alone');
    eq(adNone.reply.tone, 'warning', 'and warns rather than claiming success');
  }

  // ══ 12 ══ making a frame fluid ════════════════════════════════════════
  figma.currentPage.selection = [design];
  var fl = await send({ type: 'uikit-fluid' });
  var flr = okReply(fl, 'the design is made fluid');
  if (flr) {
    var row = deep(design, function (n) { return n.name === 'Cards'; })[0];
    ok(!!row, 'the card row is still there');
    if (row) {
      eq(row.layoutWrap, 'WRAP', 'the row of equal cards now wraps');
      var kids = row.children.filter(function (c) { return /^Card/.test(c.name); });
      var fills = kids.filter(function (c) { return c.layoutSizingHorizontal === 'FILL'; });
      eq(fills.length, kids.length, 'every card fills the width it is given');
      var mins = kids.filter(function (c) { return typeof c.minWidth === 'number' && c.minWidth > 0; });
      eq(mins.length, kids.length, 'and each has a minimum width, which is what makes it reflow');
    }
    var texts = deep(design, function (n) { return n.type === 'TEXT'; });
    var wrapped = texts.filter(function (t) { return t.textAutoResize === 'HEIGHT'; });
    eq(wrapped.length, texts.length, 'every text layer wraps instead of growing sideways');
  }
  // fluid with nothing selected
  figma.currentPage.selection = [];
  var flNone = await send({ type: 'uikit-fluid' });
  var flnr = flNone.reply;
  ok(flnr && (flnr.type === 'uikit-error' || flnr.tone === 'warning'), 'making nothing fluid is refused or warned, not claimed');

  // ══ 13 ══ responsive frames: Desktop, Tablet, Mobile ══════════════════
  figma.currentPage.selection = [design];
  var inf = await send({ type: 'uikit-infer' });
  var infr = inf.reply;
  ok(infr && infr.type === 'uikit-done', 'rules can be inferred from the design');

  var before = figma.currentPage.children.length;
  var rsp = await send({ type: 'uikit-responsive' });
  var rspr = okReply(rsp, 'responsive frames generate');
  if (rspr) {
    ok(rspr.result.created > 0, 'frames created  (' + rspr.result.created + ')');
    var names = figma.currentPage.children.map(function (c) { return c.name; });
    var made = BPS.map(function (b) {
      return names.filter(function (n) { return n.indexOf(b.name) !== -1 && n.indexOf('Home') !== -1; }).length;
    });
    ok(made[1] >= 1 && made[2] >= 1, 'one per narrower canvas size  (' + names.join(' | ') + ')');
    var tablet = figma.currentPage.children.filter(function (c) { return /Home.*Tablet/.test(c.name); })[0];
    if (tablet) eq(tablet.width, 768, 'the Tablet frame is the Tablet width');
    var mobile = figma.currentPage.children.filter(function (c) { return /Home.*Mobile/.test(c.name); })[0];
    if (mobile) eq(mobile.width, 375, 'the Mobile frame is the Mobile width');
  }
  // regenerating must not pile up duplicates
  var rsp2 = await send({ type: 'uikit-responsive' });
  if (rsp2.reply && rsp2.reply.result) {
    var dupes = figma.currentPage.children.filter(function (c) { return /Home.*Tablet/.test(c.name); }).length;
    eq(dupes, 1, 'regenerating replaces rather than duplicating');
  }

  // ══ 14 ══ previewing a canvas size ════════════════════════════════════
  figma.currentPage.selection = [design];
  var prev = await send({ type: 'uikit-preview', breakpoint: 'Mobile' });
  var prr = okReply(prev, 'a canvas size can be previewed on the selection');
  if (prr) {
    ok(prr.result.applied > 0, 'the mode is applied  (' + prr.result.applied + ')');
    var colsNow = await getUiKitCollections(false);
    var modes = design.explicitVariableModes || {};
    ok(!!modes[colsNow.responsive.id], 'as an explicit mode on the frame, which is what makes it reflow');
  }

  // ══ 15 ══ binding the scale to a selection ════════════════════════════
  figma.currentPage.selection = [design];
  var bind = await send({ type: 'uikit-bind' });
  ok(bind.reply && bind.reply.type === 'uikit-done', 'binding the scale to a selection answers');

  // ══ 16 ══ build-everything, the wizard's last step ════════════════════
  freshQ();
  var spec = {
    preset: 'custom', breakpoints: BPS, spacing: 'grid8', radius: 'rounded', ratio: 1.25,
    elements: ['button', 'card'], families: {}
  };
  var build = await send({ type: 'uikit-build', spec: spec });
  var br = okReply(build, 'the wizard builds everything at once');
  if (br) {
    eq(br.builtSystem, true, 'and tells the UI the wizard is done');
    ok(br.result.tokens.created > 0, 'tokens created  (' + br.result.tokens.created + ')');
    ok(/One undo reverses all of it/.test(br.message), 'promising a single undo  ("' + br.message + '")');
  }
  eq(undoCount >= 2, true, 'the build opened and closed an undo group  (' + undoCount + ')');

  // ══ 17 ══ building from an existing file ══════════════════════════════
  freshQ();
  var ps = figma.createPaintStyle(); ps.name = 'Brand/Primary'; ps.paints = [solid('#2D5BFF')];
  var ps2 = figma.createPaintStyle(); ps2.name = 'Text/Body'; ps2.paints = [solid('#111111')];
  var ts = figma.createTextStyle(); ts.name = 'Heading/H1';
  ts.fontName = { family: 'Inter', style: 'Regular' }; ts.fontSize = 48;

  var sfile = await send({ type: 'uikit-survey-file' });
  var sfr = okReply(sfile, 'the file can be surveyed before committing to anything');
  if (sfr) {
    eq(sfr.result.paintStyles, 2, 'it counts the paint styles');
    eq(sfr.result.textStyles, 1, 'and the text styles');
    ok(/2 paint styles, 1 text styles/.test(sfr.message), 'and says so plainly  ("' + sfr.message + '")');
  }
  // Building from a file measures the frame the designer picked, so it needs
  // one — with nothing selected it asks for a frame instead of guessing.
  figma.currentPage.selection = [];
  var ffNone = await send({ type: 'uikit-from-file' });
  if (ffNone.reply && ffNone.reply.type === 'uikit-done') {
    eq(ffNone.reply.tone, 'warning', 'with nothing selected, building from the file warns');
    ok(/Select the frame/.test(ffNone.reply.message), 'and asks for a frame  ("' + ffNone.reply.message + '")');
  }
  figma.currentPage.selection = [makeDesign()];
  var ff = await send({ type: 'uikit-from-file' });
  var ffr = okReply(ff, 'a system is built from the file');
  if (ffr) {
    ok(!!ffr.result.measured, 'it measured the frame');
    ok(ffr.result.measured.canvasWidth > 0, 'recording its canvas width  (' + ffr.result.measured.canvasWidth + ')');
    ok(ffr.result.generated.created > 0, 'and wrote variables  (' + ffr.result.generated.created + ')');
    ok(ffr.result.paints.adopted > 0, 'colours adopted  (' + ffr.result.paints.adopted + ')');
    ok(ffr.result.paints.bound > 0, 'and the styles now follow their token  (' + ffr.result.paints.bound + ')');
    ok(ffr.result.texts.adopted > 0, 'text sizes adopted  (' + ffr.result.texts.adopted + ')');
    var named = (await localVariablesAllModes('COLOR')).map(function (v) { return v.variable.name; });
    ok(named.indexOf('color/brand/primary') !== -1, 'the token keeps the style name  (' + named.join(', ') + ')');
  }
  var ff2 = await send({ type: 'uikit-from-file' });
  if (ff2.reply && ff2.reply.result && ff2.reply.result.paints) {
    eq(ff2.reply.result.paints.adopted, 0, 'adopting twice adopts nothing new');
    eq(ff2.reply.result.generated.created, 0, 'and writes no new variables');
  }

  // ══ 18 ══ reading a documented scale off the canvas ═══════════════════
  freshQ();
  var doc = mkFrame({ name: 'Spacing — Desktop', width: 800, height: 400 });
  figma.currentPage.appendChild(doc);
  ['space/100 — 8px', 'space/200 — 16px', 'space/300 — 24px'].forEach(function (label) {
    doc.appendChild(mkText(label, 'L'));
  });
  figma.currentPage.selection = [doc];
  var parse = await send({ type: 'uikit-parse' });
  var par = okReply(parse, 'a documented scale is read off the canvas');
  if (par) {
    ok(par.result.rows.length > 0, 'rows read  (' + par.result.rows.length + ')');
    eq(par.state.tableFromFile, false, 'offered as a proposal, not as the file');
    eq(par.state.table.length, par.result.rows.length, 'and the state carries what was just read');
  }
  // a file with nothing to read must say so rather than inventing numbers
  freshQ();
  figma.currentPage.appendChild(mkFrame({ name: 'Just a frame', width: 100, height: 100 }));
  var parseNone = await send({ type: 'uikit-parse' });
  var pnr = parseNone.reply;
  if (pnr && pnr.type === 'uikit-done') {
    eq(pnr.tone, 'warning', 'nothing readable warns');
    eq(pnr.result.rows.length, 0, 'and proposes no rows rather than guessing');
  }

  // ══ 19 ══ reseed ══════════════════════════════════════════════════════
  freshQ();
  await send({ type: 'uikit-save-breakpoints', preset: 'custom', breakpoints: BPS });
  var rs = await send({ type: 'uikit-reseed', options: {} });
  var rsr = okReply(rs, 'the scale can be reseeded from the preset');
  if (rsr) {
    ok(rsr.result.rows.length > 0, 'it proposes rows  (' + rsr.result.rows.length + ')');
    ok(/Nothing is written/.test(rsr.message), 'and says nothing is written yet  ("' + rsr.message + '")');
    eq((await localVariablesAllModes('FLOAT')).length, 0, 'which is true — no variables were created');
  }

  // ══ 20 ══ adopt from a design with no system at all ═══════════════════
  freshQ();
  var d2 = makeDesign();
  figma.currentPage.selection = [d2];
  var fd = await send({ type: 'uikit-from-design' });
  var fdr = okReply(fd, 'a system can be built from a bare design');
  if (fdr) {
    ok(fdr.result.generated.created > 0, 'tokens generated  (' + fdr.result.generated.created + ')');
    ok(!!fdr.state.config, 'and breakpoints were set up to hold them');
  }

  // ══ 21 ══ every reply carries what the UI needs ═══════════════════════
  var everyType = ['uikit-scan', 'uikit-save-breakpoints', 'uikit-generate', 'uikit-parse',
    'uikit-reseed', 'uikit-infer', 'uikit-responsive', 'uikit-preview-table', 'uikit-build',
    'uikit-survey-file', 'uikit-from-file', 'uikit-from-design', 'uikit-survey', 'uikit-adopt',
    'uikit-fluid', 'uikit-starter', 'uikit-canvas', 'uikit-export', 'uikit-elements',
    'uikit-bind', 'uikit-preview'];
  freshQ();
  await send({ type: 'uikit-save-breakpoints', preset: 'custom', breakpoints: BPS });
  await send({ type: 'uikit-generate', table: defaultScaleTable(CFG, {}) });
  var d3 = makeDesign();
  var silent = [];
  for (var t = 0; t < everyType.length; t++) {
    figma.currentPage.selection = [d3];
    var any = await send({ type: everyType[t], breakpoint: 'Mobile', format: 'css', spec: spec, elements: ['button'], table: defaultScaleTable(CFG, {}), proposals: [], accepted: [] });
    if (!any.reply) { silent.push(everyType[t]); continue; }
    ok(!!any.reply.type, everyType[t] + ' replies');
    if (any.reply.type !== 'uikit-state') {
      eq(any.reply.requestId, any.id, everyType[t] + ' echoes the requestId');
      ok(typeof any.reply.message === 'string', everyType[t] + ' carries a message string');
      if (any.reply.type === 'uikit-done') {
        ok(!!any.reply.state, everyType[t] + ' carries fresh state');
        ok(any.reply.tone === 'success' || any.reply.tone === 'warning', everyType[t] + ' has a usable tone  (' + any.reply.tone + ')');
        ok(!/undefined|NaN/.test(any.reply.message), everyType[t] + ' summary has no undefined/NaN  ("' + any.reply.message + '")');
      }
    }
  }
  eq(silent.length, 0, 'no message type goes unanswered  (' + silent.join(', ') + ')');

  // ══ 22 ══ an unknown message must be ignored, not crash ═══════════════
  freshQ();
  var unknown = await send({ type: 'uikit-nonsense' });
  eq(unknown.reply, undefined, 'an unknown message type is ignored silently');

  print('');
  if (fail === 0) print('ALL PASS (' + pass + ' assertions)');
  else print(fail + ' FAILED, ' + pass + ' passed');
}
run().catch(function (e) { print('THREW: ' + (e && e.stack || e)); });
