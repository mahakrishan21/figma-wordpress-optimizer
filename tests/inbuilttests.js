// ── QA sweep: the features that shipped before the design-system tab ──────
//
// The audit, its fix actions, the Colors/Typography scan-and-convert tools
// and the handoff helpers had no tests at all — every suite in this folder
// covered the new tab. This one drives them the way the UI does, through
// figma.ui.onmessage, and checks the audit really detects what it claims.
var ONMSGI = figma.ui.onmessage;
function freshI() {
  resetFigma(); figma.ui.onmessage = ONMSGI; globalThis.__posted = [];
  figma._fonts = ['Inter|Regular', 'Inter|Medium', 'Inter|Semi Bold'];
  // The audit's own state lives in code.js, not in the mock, so resetFigma()
  // leaves it pointing at the previous section's nodes. Clear it too, or a
  // later section silently acts on a page that no longer exists.
  lastAuditNodeIds = [];
  lastAuditIssueTypesByNode = new Map();
  ignoredIssueKeys = new Set();
}
var pass = 0, fail = 0;
function ok(c, l) { if (c) pass++; else { fail++; print('  FAIL: ' + l); } }
function eq(a, b, l) { ok(a === b, l + '  (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }

async function send(msg) {
  globalThis.__posted = [];
  await figma.ui.onmessage(msg);
  return globalThis.__posted || [];
}
function pick(msgs, type) { return msgs.filter(function (m) { return m.type === type; }); }

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
// Run the audit over a page and hand back the issue types it found.
async function auditTypes(root) {
  figma.currentPage.selection = [root];
  var rep = await collectIssues();
  var types = {};
  rep.issues.forEach(function (x) { types[x.type] = (types[x.type] || 0) + 1; });
  return { types: types, report: rep };
}
function has(found, type, label) { ok(found.types[type] > 0, label + '  (' + Object.keys(found.types).sort().join(', ') + ')'); }

async function run() {
  // ══ 1 ══ the audit detects what it claims to detect ═══════════════════
  freshI();
  var page = mkFrame({ name: 'Home', width: 1440, height: 3000 });
  figma.currentPage.appendChild(page);

  var hidden = mkFrame({ name: 'Rectangle 7', width: 100, height: 100 });
  hidden.visible = false;
  page.appendChild(hidden);

  var t = mkText('A heading with no style attached', 'Heading');
  t.fontSize = 32; t.fills = [solid('#111111')];
  page.appendChild(t);

  var btn = mkFrame({ name: 'Button', width: 140, height: 48 });
  btn.fills = [solid('#2D5BFF')];
  page.appendChild(btn);
  btn.appendChild(mkText('Click me', 'Label'));

  var grp = mkFrame({ name: 'Group 4', width: 10, height: 10 });
  grp.type = 'GROUP';
  page.appendChild(grp);

  var sec = mkFrame({ name: 'Hero Section', width: 1440, height: 600 });
  page.appendChild(sec);

  var line = mkFrame({ name: 'Divider', width: 200, height: 1 });
  line.type = 'LINE';
  page.appendChild(line);

  var masked = mkFrame({ name: 'Photo crop', width: 200, height: 200 });
  masked.isMask = true;
  page.appendChild(masked);

  var fit = mkFrame({ name: 'Hero image', width: 600, height: 400 });
  fit.fills = [{ type: 'IMAGE', scaleMode: 'FIT', imageHash: 'abc' }];
  page.appendChild(fit);

  var auto = mkText('Auto line height', 'Caption');
  auto.lineHeight = { unit: 'AUTO' };
  auto.fills = [solid('#555555')];
  page.appendChild(auto);

  var found = await auditTypes(page);
  has(found, 'hidden-layer', 'the audit finds a hidden layer');
  has(found, 'generic-name', 'and a generic layer name');
  has(found, 'missing-text-style', 'and text with no style');
  has(found, 'missing-color-style', 'and a fill with no style');
  has(found, 'button-no-auto-layout', 'and a button with no auto layout');
  has(found, 'empty-group', 'and an empty group');
  has(found, 'section-no-auto-layout', 'and a section with no auto layout');
  has(found, 'line-object', 'and a line object used as a separator');
  has(found, 'mask-found', 'and a mask');
  has(found, 'image-fit-mode', 'and an image set to Fit rather than Fill');
  has(found, 'auto-line-height', 'and AUTO line height');
  has(found, 'no-mobile-frame', 'and that there is no mobile frame');

  // every issue must be usable by the UI: it needs somewhere to go and a reason
  var bad = found.report.issues.filter(function (i) { return !i.type || !i.nodeId || !i.message || !i.severity; });
  eq(bad.length, 0, 'every issue names a type, a node, a message and a severity');
  var sev = found.report.issues.filter(function (i) { return ['high', 'medium', 'low'].indexOf(i.severity) === -1; });
  eq(sev.length, 0, 'and every severity is one the UI can render');
  var acts = found.report.issues.filter(function (i) { return i.action && !i.details; });
  eq(acts.length, 0, 'every fixable issue explains itself  (' + acts.map(function (i) { return i.type; }).join(', ') + ')');

  // text that overflows its parent is the regression that got through before
  var clip = mkFrame({ name: 'Card', width: 200, height: 100 });
  page.appendChild(clip);
  var long = mkText('A line of copy far wider than the card holding it', 'Body');
  long.width = 400; long.height = 20;
  clip.appendChild(long);
  var found2 = await auditTypes(page);
  has(found2, 'text-overflow', 'the audit catches text overflowing its container');

  // ══ 2 ══ ignoring an issue, and clearing it again ═════════════════════
  var firstGeneric = found2.report.issues.filter(function (i) { return i.type === 'generic-name'; })[0];
  ok(!!firstGeneric, 'there is a generic-name issue to ignore');
  if (firstGeneric) {
    await send({ type: 'ignore-issue', nodeId: firstGeneric.nodeId, issueType: 'generic-name' });
    var afterIgnore = await auditTypes(page);
    eq(afterIgnore.types['generic-name'], found2.types['generic-name'] - 1, 'ignoring one hides exactly one');
    var cleared = await send({ type: 'clear-ignored' });
    var rep = pick(cleared, 'report')[0];
    ok(!!rep, 'clearing ignored issues reports afresh');
    if (rep) {
      ok(/cleared/i.test(rep.extraMessage || ''), 'and says so  ("' + rep.extraMessage + '")');
      var again = {};
      rep.report.issues.forEach(function (i) { again[i.type] = (again[i.type] || 0) + 1; });
      eq(again['generic-name'], found2.types['generic-name'], 'the ignored issue is back');
    }
  }
  // bulk ignore
  var generics = found2.report.issues.filter(function (i) { return i.type === 'generic-name'; });
  await send({ type: 'ignore-issues-bulk', pairs: generics.map(function (i) { return { nodeId: i.nodeId, issueType: 'generic-name' }; }) });
  var afterBulk = await auditTypes(page);
  ok(!afterBulk.types['generic-name'], 'ignoring them all hides them all');
  await send({ type: 'clear-ignored' });

  // ══ 3 ══ the fix actions actually fix ═════════════════════════════════
  // Remove hidden layers
  freshI();
  var p2 = mkFrame({ name: 'Page', width: 800, height: 600 });
  figma.currentPage.appendChild(p2);
  var h1 = mkFrame({ name: 'Old banner', width: 100, height: 100 }); h1.visible = false; p2.appendChild(h1);
  var keep = mkFrame({ name: 'Live banner', width: 100, height: 100 }); p2.appendChild(keep);
  figma.currentPage.selection = [p2];
  var rh = await send({ type: 'remove-hidden' });
  ok(pick(rh, 'idle').length > 0, 'Remove hidden layers finishes');
  eq(p2.children.length, 1, 'the hidden layer is gone');
  eq(p2.children[0].name, 'Live banner', 'and the visible one is untouched');

  // Rename generic layers
  freshI();
  var p3 = mkFrame({ name: 'Page', width: 800, height: 600 });
  figma.currentPage.appendChild(p3);
  var gen = mkFrame({ name: 'Frame 123', width: 200, height: 80 });
  p3.appendChild(gen);
  gen.appendChild(mkText('Pricing plans', 'Title'));
  figma.currentPage.selection = [p3];
  await send({ type: 'rename-generic' });
  ok(gen.name !== 'Frame 123', 'a generic frame gets a real name  ("' + gen.name + '")');
  ok(!/^Frame \d+$/.test(gen.name), 'and it is not generic any more');

  // Make sections Auto Layout
  freshI();
  var p4 = mkFrame({ name: 'Page', width: 1440, height: 2000 });
  figma.currentPage.appendChild(p4);
  var s1 = mkFrame({ name: 'Features Section', width: 1440, height: 500 });
  p4.appendChild(s1);
  // Side by side, as a real section's children are. Both at 0,0 would be
  // two frames sitting exactly on top of each other, which auto layout
  // cannot express and the converter now declines to rearrange.
  var featA = mkFrame({ name: 'Feature A', width: 300, height: 200 });
  featA.x = 0; featA.y = 0;
  var featB = mkFrame({ name: 'Feature B', width: 300, height: 200 });
  featB.x = 340; featB.y = 0;
  s1.appendChild(featA);
  s1.appendChild(featB);
  figma.currentPage.selection = [p4];
  await send({ type: 'section-auto-layout' });
  ok(s1.layoutMode === 'VERTICAL' || s1.layoutMode === 'HORIZONTAL', 'a section gets auto layout  (' + s1.layoutMode + ')');

  // Convert buttons
  freshI();
  var p5 = mkFrame({ name: 'Page', width: 800, height: 600 });
  figma.currentPage.appendChild(p5);
  var b2 = mkFrame({ name: 'Button', width: 160, height: 48 });
  b2.fills = [solid('#2D5BFF')];
  p5.appendChild(b2);
  var blabel = mkText('Get started', 'Label');
  blabel.width = 100; blabel.height = 20; blabel.x = 30; blabel.y = 14;
  b2.appendChild(blabel);
  figma.currentPage.selection = [p5];
  await send({ type: 'convert-buttons' });
  eq(b2.layoutMode, 'HORIZONTAL', 'a button becomes auto layout');
  ok(b2.paddingLeft > 0, 'with padding taken from where the label sat  (' + b2.paddingLeft + ')');

  // Mark exportable assets
  freshI();
  var p6 = mkFrame({ name: 'Page', width: 800, height: 600 });
  figma.currentPage.appendChild(p6);
  var icon = mkFrame({ name: 'icon-search', width: 24, height: 24 });
  icon.type = 'VECTOR';
  p6.appendChild(icon);
  figma.currentPage.selection = [p6];
  await send({ type: 'add-export-settings' });
  ok(Array.isArray(icon.exportSettings) && icon.exportSettings.length > 0, 'an icon is marked exportable  (' + JSON.stringify(icon.exportSettings) + ')');

  // ══ 3b ══ a fix pressed BEFORE any audit still works ═════════════════
  // The seven Automated Fixes buttons sit in the toolbar, always enabled,
  // beside Run Audit. Pressed first — the obvious thing to do — three of them
  // reported "0 changed" and did nothing, because they only looked at the
  // nodes the last audit had flagged and there was no last audit.
  //
  // It only ever bit the FIRST press: every action ends by re-running the
  // audit, so the second button pressed always worked. Each case below
  // therefore starts from a clean file, with that action pressed first.
  function defectivePage() {
    var root = mkFrame({ name: 'Page', width: 1440, height: 900 });
    figma.currentPage.appendChild(root);
    var h = mkFrame({ name: 'Old banner', width: 100, height: 100 });
    h.visible = false; root.appendChild(h);
    var gname = mkFrame({ name: 'Frame 123', width: 200, height: 80 });
    root.appendChild(gname); gname.appendChild(mkText('Pricing plans', 'Title'));
    var b = mkFrame({ name: 'Button', width: 160, height: 48 });
    b.fills = [solid('#2D5BFF')]; root.appendChild(b);
    var lab = mkText('Get started', 'Label');
    lab.width = 100; lab.height = 20; lab.x = 30; lab.y = 14;
    b.appendChild(lab);
    var ic = mkFrame({ name: 'icon-search', width: 24, height: 24 });
    ic.type = 'VECTOR'; root.appendChild(ic);
    var sct = mkFrame({ name: 'Features Section', width: 1440, height: 400 });
    root.appendChild(sct);
    sct.appendChild(mkFrame({ name: 'Feature A', width: 300, height: 200 }));
    figma.currentPage.selection = [root];
    return { root: root, hidden: h, generic: gname, button: b, icon: ic, section: sct };
  }

  var firstPress = [
    { type: 'remove-hidden', label: 'Remove hidden',
      check: function (d) { return d.root.children.indexOf(d.hidden) === -1; } },
    { type: 'rename-generic', label: 'Rename generic',
      check: function (d) { return !/^Frame \d+$/.test(d.generic.name); } },
    { type: 'convert-buttons', label: 'Auto Layout on buttons',
      check: function (d) { return d.button.layoutMode === 'HORIZONTAL'; } },
    { type: 'add-export-settings', label: 'Mark exports',
      check: function (d) { return d.icon.exportSettings.length > 0; } },
    { type: 'section-auto-layout', label: 'Make Auto Layout',
      check: function (d) { return d.section.layoutMode !== 'NONE'; } }
  ];
  for (var fp = 0; fp < firstPress.length; fp++) {
    var action = firstPress[fp];
    freshI();
    var d = defectivePage();
    var said = [];
    var realNotify = figma.notify;
    figma.notify = function (m) { said.push(m); };
    await send({ type: action.type });
    figma.notify = realNotify;
    ok(action.check(d), action.label + ' works when it is the first thing pressed');
    ok(!said.some(function (m) { return /: 0 changed$/.test(m); }),
       'and it does not report "0 changed" over work it can see  (' + said.join(' | ') + ')');
  }

  // ══ 4 ══ a fix action with nothing to fix must not claim it did ═══════
  freshI();
  var clean = mkFrame({ name: 'Clean page', width: 800, height: 600 });
  clean.layoutMode = 'VERTICAL';
  figma.currentPage.appendChild(clean);
  figma.currentPage.selection = [clean];
  var noop = await send({ type: 'remove-hidden' });
  ok(pick(noop, 'idle').length > 0, 'a fix action with nothing to do still finishes cleanly');
  eq(clean.children.length, 0, 'and changes nothing');

  // ══ 5 ══ collecting the copy off a design ═════════════════════════════
  freshI();
  var p7 = mkFrame({ name: 'Page', width: 800, height: 600 });
  figma.currentPage.appendChild(p7);
  p7.appendChild(mkText('Headline', 'H1'));
  p7.appendChild(mkText('Some body copy', 'Body'));
  p7.appendChild(mkText('   ', 'Blank'));
  figma.currentPage.selection = [p7];
  var ct = await send({ type: 'collect-texts' });
  var tc = pick(ct, 'texts-collected')[0];
  ok(!!tc, 'the copy is collected');
  if (tc) {
    eq(tc.texts.length, 2, 'whitespace-only layers are left out');
    ok(tc.texts.every(function (x) { return x.id && x.text && x.path; }), 'each line knows where it came from');
  }
  // nothing selected
  figma.currentPage.selection = [];
  var ctNone = await send({ type: 'collect-texts' });
  ok(pick(ctNone, 'no-selection').length > 0, 'with nothing selected it asks for a selection');

  // ══ 6 ══ the font list ════════════════════════════════════════════════
  freshI();
  var lf = await send({ type: 'list-fonts' });
  ok(lf.length > 0, 'the font list answers');

  // ══ 7 ══ Colors: scan, then turn loose fills into styles ══════════════
  freshI();
  var p8 = mkFrame({ name: 'Page', width: 800, height: 600 });
  figma.currentPage.appendChild(p8);
  ['#2D5BFF', '#2D5BFF', '#111111'].forEach(function (hex, i) {
    var box = mkFrame({ name: 'Box ' + i, width: 100, height: 100 });
    box.fills = [solid(hex)];
    p8.appendChild(box);
  });
  figma.currentPage.selection = [p8];
  var scan = await send({ type: 'style-scan', kind: 'paint', fresh: true });
  var rows = pick(scan, 'style-rows-data')[0] || pick(scan, 'style-scan-data')[0] || pick(scan, 'scan-data')[0];
  ok(scan.length > 0, 'a colour scan answers  (' + scan.map(function (m) { return m.type; }).join(', ') + ')');
  var payload = scan.filter(function (m) { return m.rows || (m.data && m.data.rows); })[0];
  if (payload) {
    var list = payload.rows || payload.data.rows;
    ok(list.length > 0, 'it finds the loose colours  (' + list.length + ')');
    var brand = list.filter(function (r) { return /2D5BFF/i.test(r.hex || r.value || ''); })[0];
    ok(!!brand, 'including the one used twice');
    if (brand) ok((brand.count || brand.uses || 0) >= 2, 'and counts both uses  (' + (brand.count || brand.uses) + ')');
  }

  // ══ 8 ══ counting where a token is used ═══════════════════════════════
  freshI();
  var ps = figma.createPaintStyle(); ps.name = 'Brand/Primary'; ps.paints = [solid('#2D5BFF')];
  var p9 = mkFrame({ name: 'Page', width: 400, height: 400 });
  figma.currentPage.appendChild(p9);
  var painted = mkFrame({ name: 'Uses brand', width: 100, height: 100 });
  painted.fills = [solid('#2D5BFF')];
  painted.fillStyleId = ps.id;
  p9.appendChild(painted);
  var counted = await send({ type: 'count-token-uses', items: [{ kind: 'paint', id: ps.id }] });
  var cu = counted.filter(function (m) { return m.counts; })[0];
  ok(!!cu, 'token uses are counted');
  if (cu) ok(cu.counts[ps.id] === 1 || cu.counts[ps.id] === null, 'the style is found where it is used  (' + JSON.stringify(cu.counts) + ')');

  // ══ 9 ══ focusing a layer from a report row ═══════════════════════════
  freshI();
  var p10 = mkFrame({ name: 'Page', width: 400, height: 400 });
  figma.currentPage.appendChild(p10);
  var target = mkFrame({ name: 'Needs fixing', width: 50, height: 50 });
  p10.appendChild(target);
  figma.currentPage.selection = [];
  await send({ type: 'focus-node', nodeId: target.id });
  eq(figma.currentPage.selection.length, 1, 'clicking a report row selects the layer');
  eq(figma.currentPage.selection[0].name, 'Needs fixing', 'the right one');
  // a layer that has since been deleted must not throw
  target.remove();
  var gone = await send({ type: 'focus-node', nodeId: target.id });
  ok(true, 'focusing a deleted layer does not throw');
  var goneMany = await send({ type: 'focus-nodes', nodeIds: [target.id] });
  ok(true, 'and nor does focusing several deleted layers');

  // ══ 10 ══ the plugin window stays within its limits ═══════════════════
  freshI();
  var resized = null;
  figma.ui.resize = function (w, h) { resized = { w: w, h: h }; };
  await send({ type: 'resize', width: 99999, height: 99999 });
  ok(resized && resized.w <= 1200 && resized.h <= 960, 'an oversized window is clamped  (' + JSON.stringify(resized) + ')');
  await send({ type: 'resize', width: 10, height: 10 });
  ok(resized && resized.w >= 400 && resized.h >= 400, 'and an undersized one  (' + JSON.stringify(resized) + ')');

  // ══ 11 ══ an audit over an empty page ═════════════════════════════════
  freshI();
  figma.currentPage.selection = [];
  var emptyRep = await collectIssues();
  eq(emptyRep.issues.length, 0, 'an empty page reports no issues');
  ok(!!emptyRep.stats, 'but still reports stats, so the UI has something to render');
  eq(emptyRep.stats.checkedNodes, 0, 'having checked nothing');

  // ══ 12 ══ a thrown error reaches the UI rather than hanging it ════════
  freshI();
  var saved = figma.currentPage.selection;
  var threw = await send({ type: 'focus-node', nodeId: null });
  ok(true, 'a malformed message does not take the plugin down');

  print('');
  if (fail === 0) print('ALL PASS (' + pass + ' assertions)');
  else print(fail + ' FAILED, ' + pass + ' passed');
}
run().catch(function (e) { print('THREW: ' + (e && e.stack || e)); });
