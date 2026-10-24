// ── The self-test, tested ────────────────────────────────────────────────
//
// It exists to answer, inside Figma, the questions the mock cannot. That
// does not excuse it from being checked here: a diagnostic that builds
// frames and deletes them had better delete only its own, report honestly,
// and leave the file exactly as it found it.
var ONMSGS = figma.ui.onmessage;
function freshS() {
  resetFigma(); figma.ui.onmessage = ONMSGS; globalThis.__posted = [];
  figma._fonts = ['Inter|Regular', 'Inter|Medium', 'Inter|Semi Bold'];
}
function postedS(t) { return (globalThis.__posted || []).filter(function (m) { return m.type === t; }); }
var pass = 0, fail = 0;
function ok(c, l) { if (c) pass++; else { fail++; print('  FAIL: ' + l); } }
function eq(a, b, l) { ok(a === b, l + '  (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }

async function run() {
  // ── 1 ── it runs, and every check it claims is a real one ─────────────
  freshS();
  var r = await runSelfTest({});
  ok(r.checks.length >= 8, 'it makes a useful number of checks  (' + r.checks.length + ')');
  ok(r.checks.every(function (c) { return c.name && typeof c.pass === 'boolean'; }),
     'each check has a name and a verdict');
  eq(r.passed + r.failed, r.checks.length, 'the tally adds up');
  var names = r.checks.map(function (c) { return c.name; });
  ['Configuration can be stored', 'The frame is measured', 'Variables are written',
   'Binding changes nothing visually', 'Responsive frames are generated',
   'A second run creates no duplicates', 'An edited frame is protected']
    .forEach(function (want) {
      ok(names.indexOf(want) !== -1, 'it checks: ' + want + '  (' + names.join(' | ') + ')');
    });

  // ── 2 ── it leaves the file as it found it ────────────────────────────
  eq(figma.currentPage.children.length, 0, 'every frame it built is gone again');
  ok(r.cleaned > 0, 'and it says how many it removed  (' + r.cleaned + ')');
  eq(r.leftBehind.length, 0, 'nothing it made was left behind');

  // ── 3 ── it does not touch anything that was already there ────────────
  freshS();
  var mine = mkFrame({ name: 'My real design', width: 1440, height: 800 });
  mine.layoutMode = 'VERTICAL';
  figma.currentPage.appendChild(mine);
  var myCard = mkFrame({ name: 'My card', width: 400, height: 200 });
  mine.appendChild(myCard);
  var myText = mkText('Copy I wrote myself', 'Mine');
  myText.fontSize = 18;
  mine.appendChild(myText);
  var before = { kids: mine.children.length, w: mine.width, h: mine.height, fs: myText.fontSize };

  var r2 = await runSelfTest({});
  ok(figma.currentPage.children.indexOf(mine) !== -1, 'the design that was already there survives');
  eq(mine.children.length, before.kids, 'with the same children');
  eq(mine.width, before.w, 'the same width');
  eq(myText.fontSize, before.fs, 'and its text untouched');
  var strays = figma.currentPage.children.filter(function (c) { return c !== mine; });
  eq(strays.length, 0, 'and nothing of the test is left beside it  (' +
     strays.map(function (c) { return c.name; }).join(', ') + ')');

  // ── 4 ── the configuration is put back as it was ──────────────────────
  freshS();
  var mineCfg = { preset: 'custom', breakpoints: [
    { name: 'Wide', width: 1600 }, { name: 'Narrow', width: 600 }] };
  writeBreakpointConfig(mineCfg);
  await runSelfTest({});
  var after = readBreakpointConfig();
  ok(!!after, 'a configuration that was there is restored');
  eq(after.breakpoints.length, 2, 'with the same number of canvas sizes');
  eq(after.breakpoints[0].name, 'Wide', 'and the same names');
  eq(after.breakpoints[0].width, 1600, 'and the same widths');

  // a file that had none is left with none
  freshS();
  await runSelfTest({});
  eq(readBreakpointConfig(), null, 'a file that had no configuration still has none');

  // ── 5 ── a failure is reported, not swallowed ─────────────────────────
  freshS();
  var realWrite = figma.root.setPluginData;
  figma.root.setPluginData = function () { throw new Error('read-only file'); };
  var r3 = await runSelfTest({});
  figma.root.setPluginData = realWrite;
  var cfgCheck = r3.checks.filter(function (c) { return c.name === 'Configuration can be stored'; })[0];
  ok(!!cfgCheck && !cfgCheck.pass, 'a file that refuses plugin data fails that check');
  ok(r3.failed > 0, 'and the run reports a failure  (' + r3.failed + ' failed)');
  ok((cfgCheck.detail || '').length > 0, 'with a reason: "' + (cfgCheck && cfgCheck.detail) + '"');

  // ── 6 ── through the handler, as the button sends it ──────────────────
  freshS();
  globalThis.__posted = [];
  await figma.ui.onmessage({ type: 'uikit-selftest', requestId: 's1' });
  var d = postedS('uikit-done')[0];
  ok(!!d, 'the handler answers');
  if (d) {
    ok(d.message.indexOf('checks passed') !== -1, 'saying how many passed: "' + d.message + '"');
    ok(d.message.indexOf('removed again') !== -1, 'and that it cleaned up after itself');
    ok(!!d.result && !!d.result.checks, 'and carries the checks for the UI to show');
    ok(d.tone === 'success' || d.tone === 'warning', 'with a usable tone  (' + d.tone + ')');
  }

  print('');
  if (fail === 0) print('ALL PASS (' + pass + ' assertions)');
  else print(fail + ' FAILED, ' + pass + ' passed');
}
run().catch(function (e) { print('THREW: ' + (e && e.stack || e)); });
