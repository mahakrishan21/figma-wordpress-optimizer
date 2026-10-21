// ── UI Kit: mode plumbing ───────────────────────────────────────────────────
// code.js assigns this at load; resetFigma() replaces the whole figma object,
// so hold on to the real dispatcher and put it back each time.
var ONMSG = figma.ui.onmessage;
function freshFile() { resetFigma(); figma.ui.onmessage = ONMSG; globalThis.__posted = []; }
function posted(type) { return (globalThis.__posted || []).filter(function (m) { return m.type === type; }); }

var pass = 0, fail = 0;
function ok(cond, label) { if (cond) { pass++; } else { fail++; print('  FAIL: ' + label); } }
function eq(a, b, label) { ok(a === b, label + '  (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }

var BPS = ['Desktop', 'Tablet Landscape', 'Tablet', 'Mobile'];

async function run() {
  // 1 ── fresh collection: placeholder renamed, rest added
  figma._modeCap = 4;
  var c = figma.variables.createVariableCollection('Responsive');
  eq(c.modes.length, 1, 'fresh collection starts with one mode');
  eq(c.modes[0].name, 'Mode 1', 'placeholder is named Mode 1');

  var r = await ensureModes(c, BPS);
  eq(c.modes.length, 4, 'four modes exist');
  eq(c.modes[0].name, 'Desktop', 'placeholder was RENAMED, not left beside the new ones');
  eq(r.capHit, false, 'no cap hit at exactly the ceiling');
  eq(Object.keys(r.nameToModeId).length, 4, 'every breakpoint mapped to a mode');
  eq(r.renamed.length, 1, 'exactly one rename');
  eq(r.created.length, 3, 'three modes created');
  ok(r.nameToModeId['Mobile'] !== r.nameToModeId['Desktop'], 'distinct mode ids');

  // 2 ── idempotency
  var before = c.modes.length;
  var r2 = await ensureModes(c, BPS);
  eq(c.modes.length, before, 'second run adds nothing');
  eq(r2.created.length, 0, 'second run creates nothing');
  eq(r2.renamed.length, 0, 'second run renames nothing');
  eq(r2.nameToModeId['Tablet'], r.nameToModeId['Tablet'], 'same mode id returned');

  // 3 ── cap hit rolls back cleanly
  var c2 = figma.variables.createVariableCollection('TooMany');
  var r3 = await ensureModes(c2, ['A', 'B', 'C', 'D', 'E']);
  eq(r3.capHit, true, 'cap hit reported');
  eq(c2.modes.length, 1, 'rolled back to the original single mode — nothing partially applied');
  eq(Object.keys(r3.nameToModeId).length, 0, 'no mapping handed back on cap hit');

  // 3b ── pre-existing modes are never removed by a rollback
  var c3 = figma.variables.createVariableCollection('Existing');
  await ensureModes(c3, ['Light', 'Dark']);
  eq(c3.modes.length, 2, 'two modes set up');
  var r4 = await ensureModes(c3, ['Light', 'Dark', 'X', 'Y', 'Z']);
  eq(r4.capHit, true, 'cap hit on the over-ask');
  eq(c3.modes.length, 2, 'the two it already had survive the rollback');
  eq(c3.modes[0].name, 'Light', 'and keep their names');

  // 4 ── value per mode, round trip
  var v = figma.variables.createVariable('space/inset/md', c, 'FLOAT');
  await setVarValue(v, c, 24, r.nameToModeId['Desktop']);
  await setVarValue(v, c, 20, r.nameToModeId['Tablet Landscape']);
  await setVarValue(v, c, 16, r.nameToModeId['Tablet']);
  await setVarValue(v, c, 12, r.nameToModeId['Mobile']);
  eq(await variableValue(v, r.nameToModeId['Desktop']), 24, 'Desktop reads 24');
  eq(await variableValue(v, r.nameToModeId['Tablet Landscape']), 20, 'Tablet Landscape reads 20');
  eq(await variableValue(v, r.nameToModeId['Tablet']), 16, 'Tablet reads 16');
  eq(await variableValue(v, r.nameToModeId['Mobile']), 12, 'Mobile reads 12');

  // 5 ── REGRESSION: no modeId still means the default mode
  eq(await variableValue(v), 24, 'no modeId falls back to the default mode (Desktop)');
  var v2 = figma.variables.createVariable('legacy', c, 'FLOAT');
  await setVarValue(v2, c, 99);
  eq(await variableValue(v2), 99, 'setVarValue with no modeId writes the default mode');
  eq(v2.valuesByMode[c.defaultModeId], 99, 'and it landed on defaultModeId specifically');
  eq(Object.keys(v2.valuesByMode).length, 1, 'writing without a modeId touches exactly one mode');

  // 6 ── alias follows the SAME mode within one collection
  var alias = figma.variables.createVariable('space/card/padding', c, 'FLOAT');
  var aliasVal = figma.variables.createVariableAlias(v);
  for (var i = 0; i < BPS.length; i++) await setVarValue(alias, c, aliasVal, r.nameToModeId[BPS[i]]);
  eq(await variableValue(alias, r.nameToModeId['Mobile']), 12, 'alias resolves in the SAME mode, not the default');
  eq(await variableValue(alias, r.nameToModeId['Desktop']), 24, 'alias resolves Desktop to 24');

  // 7 ── localVariablesAllModes
  var all = await localVariablesAllModes('FLOAT');
  var found = all.filter(function (e) { return e.variable.name === 'space/inset/md'; })[0];
  ok(!!found, 'localVariablesAllModes finds the token');
  eq(found.resolved[r.nameToModeId['Mobile']], 12, 'and carries its per-mode values');
  eq(found.modes.length, 4, 'and the collection modes');

  // ── 8 ── UI Kit collections ───────────────────────────────────────────
  resetFigma();
  var none = await getUiKitCollections(false);
  ok(!none.primitives && !none.theme && !none.responsive, 'nothing created when create=false');
  eq(none.created.length, 0, 'and nothing reported as created');

  var made = await getUiKitCollections(true);
  ok(!!made.primitives && !!made.theme && !!made.responsive, 'all three tiers created');
  eq(made.created.length, 3, 'three reported as created');
  eq(made.responsive.name, 'Responsive', 'named Responsive');

  var again = await getUiKitCollections(true);
  eq(again.created.length, 0, 'second call creates nothing');
  eq(again.responsive.id, made.responsive.id, 'and returns the same collection');

  // 8b ── an existing collection is adopted, never duplicated or renamed
  resetFigma();
  var mine = figma.variables.createVariableCollection('Responsive');
  var adopted = await getUiKitCollections(true);
  eq(adopted.responsive.id, mine.id, 'adopts a Responsive collection the file already had');
  eq(figma._cols.filter(function (c) { return c.name === 'Responsive'; }).length, 1, 'no duplicate created');

  // ── 9 ── breakpoint config round trip ─────────────────────────────────
  resetFigma();
  eq(readBreakpointConfig(), null, 'no config on a fresh file');
  writeBreakpointConfig({ preset: 'standard', breakpoints: BREAKPOINT_PRESETS.standard });
  var cfg = readBreakpointConfig();
  ok(!!cfg, 'config reads back');
  eq(cfg.preset, 'standard', 'preset survives');
  eq(cfg.breakpoints.length, 4, 'four breakpoints survive');
  eq(cfg.breakpoints[0].name, 'Desktop', 'widest first');
  eq(cfg.breakpoints[3].width, 375, 'widths survive');
  eq(breakpointNames(cfg).join('|'), 'Desktop|Tablet Landscape|Tablet|Mobile', 'names extracted in order');
  figma.root.setPluginData('uikit.breakpoints', 'not json at all');
  eq(readBreakpointConfig(), null, 'corrupt config reads as absent rather than throwing');

  // ── 10 ── getTokenCollection must ignore the UI Kit's collections ─────
  // Otherwise Typography would write a font size into Desktop only and
  // leave the other three breakpoints empty.
  resetFigma();
  function floatVar(col, name) {
    var v = figma.variables.createVariable(name, col, 'FLOAT');
    v.scopes = ['FONT_SIZE'];
    v.setValueForMode(col.defaultModeId, 16);
    return v;
  }
  var dt = figma.variables.createVariableCollection('Design Tokens');
  floatVar(dt, 'a'); floatVar(dt, 'b');
  var resp = figma.variables.createVariableCollection('Responsive');
  floatVar(resp, 'c'); floatVar(resp, 'd'); floatVar(resp, 'e'); floatVar(resp, 'f'); floatVar(resp, 'g');
  var picked = await getTokenCollection(true, 'text');
  eq(picked.name, 'Design Tokens', 'picks Design Tokens despite Responsive holding more variables');

  // 10b ── with ONLY a UI Kit collection present, it makes its own
  resetFigma();
  var only = figma.variables.createVariableCollection('Responsive');
  floatVar(only, 'x'); floatVar(only, 'y');
  var picked2 = await getTokenCollection(true, 'text');
  eq(picked2.name, 'Design Tokens', 'creates Design Tokens rather than adopting Responsive');
  ok(picked2.id !== only.id, 'and it is a different collection');

  // ── 11 ── generateScaleVariables ──────────────────────────────────────
  resetFigma();
  var gcfg = { preset: 'standard', breakpoints: BREAKPOINT_PRESETS.standard };
  var table = defaultScaleTable(gcfg);
  ok(table.length > 15, 'default table has a usable number of rows');
  ok(table.some(function (t) { return t.tier === 'primitive'; }), 'has primitive rows');
  ok(table.some(function (t) { return t.tier === 'responsive'; }), 'has responsive rows');

  var g = await generateScaleVariables(gcfg, table);
  eq(g.modes.capHit, false, 'four breakpoints fit');
  eq(g.created, table.length, 'every row created a variable');
  eq(g.reused, 0, 'nothing reused on a first run');
  eq(g.skipped, 0, 'nothing skipped');

  var gcols = await getUiKitCollections(false);
  ok(!!gcols.primitives && !!gcols.responsive, 'both collections exist after generate');
  eq(gcols.responsive.modes.length, 4, 'Responsive has four modes');
  eq(gcols.primitives.modes.length, 1, 'Primitives stays single-mode');

  // 11b ── idempotency
  var g2 = await generateScaleVariables(gcfg, table);
  eq(g2.created, 0, 'second run creates nothing');
  eq(g2.reused, table.length, 'second run reuses every row');
  var allFloat = await localVariablesAllModes('FLOAT');
  eq(allFloat.length, table.length, 'and the file still holds exactly one variable per row');

  // 11c ── aliasing: section/sm at Desktop is 64, and space/700 is 64
  var names4 = breakpointNames(gcfg);
  var m4 = await ensureModes(gcols.responsive, names4);
  var sectionSm = allFloat.filter(function (e) { return e.variable.name === 'space/section/sm'; })[0];
  ok(!!sectionSm, 'space/section/sm exists');
  var deskRaw = sectionSm.variable.valuesByMode[m4.nameToModeId['Desktop']];
  eq(deskRaw && deskRaw.type, 'VARIABLE_ALIAS', 'Desktop value is an ALIAS, not a raw number');
  eq(await variableValue(sectionSm.variable, m4.nameToModeId['Desktop']), 64,
     'and it resolves through the alias to 64');
  ok(g.aliased > 0, 'generate reports aliased writes');

  // 11d ── a responsive value with no matching primitive stays raw
  var container = allFloat.filter(function (e) { return e.variable.name === 'container/max'; })[0];
  ok(!!container, 'container/max exists');
  var cDesk = container.variable.valuesByMode[m4.nameToModeId['Desktop']];
  eq(typeof cDesk, 'number', 'container/max Desktop is a raw number — no primitive is 1376');
  eq(cDesk, 1376, 'and it is 1440 minus two 32px gutters');

  // 11e ── every breakpoint actually got a value
  var mobileVal = await variableValue(sectionSm.variable, m4.nameToModeId['Mobile']);
  eq(typeof mobileVal, 'number', 'Mobile resolves to a number');
  ok(mobileVal < 64, 'and it is smaller than Desktop');

  // ── 12 ── cap hit changes nothing at all ──────────────────────────────
  resetFigma();
  figma._modeCap = 2;
  var wideCfg = { preset: 'standard', breakpoints: BREAKPOINT_PRESETS.standard };
  var g3 = await generateScaleVariables(wideCfg, defaultScaleTable(wideCfg));
  eq(g3.modes.capHit, true, 'cap hit reported');
  eq(g3.created, 0, 'no variables created');
  ok(g3.reasons.length > 0 && g3.reasons[0].indexOf('2 modes') !== -1, 'the reason names the real ceiling');
  var after = await localVariablesAllModes('FLOAT');
  eq(after.length, 0, 'the file is untouched');
  figma._modeCap = 4;

  // ── 13 ── a row with no values is skipped WITH a reason ───────────────
  resetFigma();
  var badCfg = { preset: 'standard', breakpoints: BREAKPOINT_PRESETS.standard };
  var g4 = await generateScaleVariables(badCfg, [
    { name: 'space/ok', tier: 'primitive', scopes: [], values: (function () { var o = {}; o[UIKIT_VALUE_KEY] = 8; return o; })() },
    { name: 'space/empty', tier: 'responsive', scopes: [], values: {} }
  ]);
  eq(g4.skipped, 1, 'the empty row is skipped');
  ok(g4.reasons.join(' ').indexOf('space/empty') !== -1, 'and named in the reasons');
  eq(g4.created, 2, 'both variables still exist — the skip is about values, not the token');

  // ── 14 ── binding a selection to the scale ────────────────────────────
  resetFigma();
  var bcfg = { preset: 'standard', breakpoints: BREAKPOINT_PRESETS.standard };
  await generateScaleVariables(bcfg, defaultScaleTable(bcfg));
  var bcols = await getUiKitCollections(false);
  var bm = await ensureModes(bcols.responsive, breakpointNames(bcfg));

  // space/section/sm is 64 at Desktop; space/300 is 24 everywhere.
  var card = mkFrame({ name: 'Card', layoutMode: 'VERTICAL', paddingTop: 64, paddingLeft: 24, itemSpacing: 8 });
  figma.currentPage.selection = [card];
  var b = await bindScaleToSelection({});
  eq(b.layers, 1, 'one auto-layout layer visited');
  ok(b.bound >= 2, 'at least paddingTop and paddingLeft bound  (' + b.bound + ')');
  ok(!!card.boundVariables.paddingTop, 'paddingTop is bound');
  ok(!!card.boundVariables.paddingLeft, 'paddingLeft is bound');
  ok(!!card.boundVariables.itemSpacing, 'itemSpacing is bound to the 8px step');

  // 14b ── the SEMANTIC token wins over the primitive holding the same number
  var ptVar = figma._vars.filter(function (v) { return v.id === card.boundVariables.paddingTop.id; })[0];
  eq(ptVar.name, 'space/section/sm', 'paddingTop bound to the semantic token, not space/700');
  eq(ptVar.variableCollectionId, bcols.responsive.id, 'and it lives in Responsive');

  // 14c ── a second run rebinds nothing
  var b2 = await bindScaleToSelection({});
  eq(b2.bound, 0, 'second run binds nothing new');
  ok(b2.alreadyBound >= 3, 'and reports them as already bound  (' + b2.alreadyBound + ')');

  // 14d ── non-auto-layout is skipped, with a reason
  resetFigma();
  await generateScaleVariables(bcfg, defaultScaleTable(bcfg));
  var plain = mkFrame({ name: 'Plain', paddingTop: 24 });
  figma.currentPage.selection = [plain];
  var b3 = await bindScaleToSelection({});
  eq(b3.bound, 0, 'nothing bound on a frame without auto layout');
  eq(b3.layers, 0, 'and it was not counted as a visited layer');
  ok(b3.reasons.join(' ').indexOf('auto layout') !== -1, 'the reason says why');

  // 14e ── a locked layer is skipped, with a reason
  resetFigma();
  await generateScaleVariables(bcfg, defaultScaleTable(bcfg));
  var locked = mkFrame({ name: 'Locked', layoutMode: 'VERTICAL', paddingTop: 24 });
  locked.locked = true;
  figma.currentPage.selection = [locked];
  var b4 = await bindScaleToSelection({});
  eq(b4.bound, 0, 'nothing bound on a locked layer');
  eq(b4.skipped, 1, 'counted as skipped');
  ok(b4.reasons.join(' ').indexOf('locked') !== -1, 'the reason says locked');

  // 14f ── no tokens yet
  resetFigma();
  var orphan = mkFrame({ name: 'Orphan', layoutMode: 'VERTICAL', paddingTop: 24 });
  figma.currentPage.selection = [orphan];
  var b5 = await bindScaleToSelection({});
  eq(b5.bound, 0, 'nothing bound with no collections');
  ok(b5.reasons.join(' ').indexOf('generate the scale first') !== -1, 'and it says to generate first');

  // 14g ── nothing selected
  figma.currentPage.selection = [];
  var b6 = await bindScaleToSelection({});
  ok(b6.reasons.join(' ').indexOf('Select a frame') !== -1, 'empty selection asks for a selection');

  // ── 15 ── preview at a breakpoint ─────────────────────────────────────
  resetFigma();
  await generateScaleVariables(bcfg, defaultScaleTable(bcfg));
  var pcols = await getUiKitCollections(false);
  var pm = await ensureModes(pcols.responsive, breakpointNames(bcfg));
  var hero = mkFrame({ name: 'Hero', layoutMode: 'VERTICAL', paddingTop: 64 });
  figma.currentPage.selection = [hero];
  await bindScaleToSelection({});
  ok(!!hero.boundVariables.paddingTop, 'hero paddingTop bound at Desktop');

  var pv = await previewBreakpoint('Mobile');
  eq(pv.applied, 1, 'mode override applied to one frame');
  eq(hero.explicitModes[pcols.responsive.id], pm.nameToModeId['Mobile'], 'the override is the Mobile mode');

  // the bound token now resolves to the Mobile number, which is what reflows
  var heroVar = figma._vars.filter(function (v) { return v.id === hero.boundVariables.paddingTop.id; })[0];
  var deskN = await variableValue(heroVar, pm.nameToModeId['Desktop']);
  var mobN = await variableValue(heroVar, pm.nameToModeId['Mobile']);
  eq(deskN, 64, 'the same token is 64 at Desktop');
  ok(mobN < deskN, 'and smaller at Mobile  (' + mobN + ')');

  // 15b ── binding AFTER the override matches the Mobile values, not Desktop
  var second = mkFrame({ name: 'Second', layoutMode: 'VERTICAL', paddingTop: mobN });
  figma.currentPage.selection = [second];
  await previewBreakpoint('Mobile');
  var b7 = await bindScaleToSelection({});
  ok(b7.bound >= 1, 'bound against the overridden mode');
  var secVar = figma._vars.filter(function (v) { return v.id === second.boundVariables.paddingTop.id; })[0];
  eq(await variableValue(secVar, pm.nameToModeId['Mobile']), mobN, 'and the token really holds that Mobile value');

  // 15c ── an unknown breakpoint name is refused by name
  var pv2 = await previewBreakpoint('Watch');
  eq(pv2.applied, 0, 'unknown breakpoint applies nothing');
  ok(pv2.reasons.join(' ').indexOf('Watch') !== -1, 'and names it in the reason');

  // ── 16 ── the message handler, end to end ─────────────────────────────
  freshFile();
  await figma.ui.onmessage({ type: 'uikit-scan' });
  var st = posted('uikit-state')[0];
  ok(!!st, 'uikit-scan posts a state');
  eq(st.config, null, 'no config on a fresh file');
  eq(st.collections.responsive, false, 'no Responsive collection yet');
  ok(st.presetNames.indexOf('wordpress') !== -1, 'presets include wordpress');
  eq(st.table, null, 'no table until breakpoints are set up');

  // 16b ── set up breakpoints
  globalThis.__posted = [];
  await figma.ui.onmessage({
    type: 'uikit-save-breakpoints', requestId: 'r1',
    preset: 'standard', breakpoints: BREAKPOINT_PRESETS.standard
  });
  var d1 = posted('uikit-done')[0];
  ok(!!d1, 'save-breakpoints reports done');
  eq(d1.tone, 'success', 'and succeeds');
  eq(d1.requestId, 'r1', 'the requestId comes back');
  ok(!!d1.state.config, 'the fresh state carries the config');
  eq(d1.state.collections.responsiveModes.length, 4, 'four modes now exist');
  ok(!!d1.state.table, 'and a seed table is offered');
  eq(d1.state.tableFromFile, false, 'flagged as a seed, not read from the file');

  // 16c ── generate
  globalThis.__posted = [];
  await figma.ui.onmessage({ type: 'uikit-generate', requestId: 'r2', table: d1.state.table });
  var d2 = posted('uikit-done')[0];
  ok(!!d2, 'generate reports done');
  eq(d2.tone, 'success', 'and succeeds');
  ok(d2.message.indexOf('created') !== -1, 'the message says what happened: ' + d2.message);
  eq(d2.state.tableFromFile, true, 'the table now reads back from the file');
  ok(d2.state.table.length > 0, 'and has rows');

  // 16d ── generate before breakpoints is an error, not a crash
  freshFile();
  await figma.ui.onmessage({ type: 'uikit-generate', requestId: 'r3', table: [] });
  var err = posted('uikit-error')[0];
  ok(!!err, 'generate without breakpoints posts an error');
  ok(err.message.indexOf('breakpoints first') !== -1, 'with a message that says what to do');
  eq(err.requestId, 'r3', 'and the requestId');

  // 16e ── cap hit comes back as a warning, and writes no config
  freshFile();
  figma._modeCap = 2;
  await figma.ui.onmessage({
    type: 'uikit-save-breakpoints', requestId: 'r4',
    preset: 'standard', breakpoints: BREAKPOINT_PRESETS.standard
  });
  var d4 = posted('uikit-done')[0];
  eq(d4.tone, 'warning', 'cap hit is a warning, not a success');
  ok(d4.message.indexOf('2 modes') !== -1, 'naming the real ceiling: ' + d4.message);
  eq(readBreakpointConfig(), null, 'and no config was written, so nothing is half-set-up');
  figma._modeCap = 4;

  // 16f ── bind through the handler, with nothing selected
  freshFile();
  await figma.ui.onmessage({ type: 'uikit-bind', requestId: 'r5' });
  var d5 = posted('uikit-done')[0];
  eq(d5.tone, 'warning', 'binding nothing is a warning');
  ok(d5.message.indexOf('Select a frame') !== -1, 'and asks for a selection');

  // 16g ── an unrelated message type is ignored, posting nothing
  freshFile();
  await handleUiKitMessage({ type: 'something-else' });
  eq((globalThis.__posted || []).length, 0, 'an unknown uikit message posts nothing');

  // ── 17 ── reading a scale off the canvas ──────────────────────────────
  // Shaped after a real file: the spacing ramp is documented as a heading
  // TEXT ("Spacing/ Desktop") above label/value text pairs inside generically
  // named groups, while component padding puts the breakpoint in the FRAME
  // NAME and the label and value in one text run.
  freshFile();
  var pcfg = { preset: 'standard', breakpoints: BREAKPOINT_PRESETS.standard };
  writeBreakpointConfig(pcfg);

  function ramp(bpLabel, pairs) {
    var kids = [mkText(bpLabel, 'Spacing heading')];
    for (var i = 0; i < pairs.length; i++) {
      kids.push(mkFrame({ name: 'Frame ' + (90 + i), children: [mkText(String(pairs[i][0])), mkText(pairs[i][1] + 'px')] }));
    }
    return mkFrame({ name: 'Group 1', children: kids });
  }

  var kit = mkFrame({ name: 'Padding & Spacing', children: [
    ramp('Spacing/ Desktop', [[25, 2], [300, 24], [700, 64]]),
    ramp('Spacing/ Mobile', [[25, 2], [300, 16], [700, 40]]),
    mkFrame({ name: 'Component Padding - Desktop', children: [
      mkFrame({ name: 'Frame 34', children: [mkText('Component Padding - sm - 64px')] }),
      mkFrame({ name: 'Frame 35', children: [mkText('Component Padding - lg - 120px')] })
    ]}),
    mkFrame({ name: 'Component Padding - Mobile', children: [
      mkFrame({ name: 'Frame 36', children: [mkText('Component Padding - sm - 32px')] }),
      mkFrame({ name: 'Frame 37', children: [mkText('Component Padding - lg - 48px')] })
    ]}),
    mkFrame({ name: 'Notes', children: [mkText('Spacing is on a 4px grid'), mkText('see 1234px wide mock')] })
  ]});

  var parsed = await scanUiKit([kit], pcfg);
  var byName = {};
  for (var i = 0; i < parsed.rows.length; i++) byName[parsed.rows[i].name] = parsed.rows[i];

  ok(!!byName['spacing/300'], 'the heading TEXT named the group and the breakpoint: ' + Object.keys(byName).join(', '));
  if (byName['spacing/300']) {
    eq(byName['spacing/300'].tier, 'responsive', 'spacing/300 is responsive');
    eq(byName['spacing/300'].values['Desktop'], 24, 'Desktop 24 from the label/value pair');
    eq(byName['spacing/300'].values['Mobile'], 16, 'Mobile 16 from the second ramp');
  }

  ok(!!byName['component-padding/lg'], 'the FRAME NAME form parsed too, with the redundant prefix dropped');
  if (byName['component-padding/lg']) {
    eq(byName['component-padding/lg'].values['Desktop'], 120, 'Desktop 120');
    eq(byName['component-padding/lg'].values['Mobile'], 48, 'Mobile 48');
  }

  ok(parsed.parsed >= 10, 'all ten labelled values read  (' + parsed.parsed + ')');
  ok(parsed.unparsed.length >= 1, 'prose mentioning a px value is reported, not guessed at');
  ok(parsed.unparsed.join(' ').indexOf('1234px') !== -1, 'and it is the prose line: ' + parsed.unparsed.join(' | '));

  // 17b ── a value outside any breakpoint is a primitive
  freshFile();
  writeBreakpointConfig(pcfg);
  var loose = mkFrame({ name: 'Radius', children: [
    mkFrame({ name: 'Frame 1', children: [mkText('md'), mkText('8px')] })
  ]});
  var p2 = await scanUiKit([loose], pcfg);
  eq(p2.rows.length, 1, 'one row');
  eq(p2.rows[0].tier, 'primitive', 'no breakpoint anywhere makes it a primitive');
  eq(p2.rows[0].values[UIKIT_VALUE_KEY], 8, 'with its single value');
  eq(p2.rows[0].name, 'radius/md', 'named from the group frame');

  // 17c ── nothing to read is reported, not invented
  freshFile();
  writeBreakpointConfig(pcfg);
  var empty = await scanUiKit([mkFrame({ name: 'Nothing', children: [mkText('Hello')] })], pcfg);
  eq(empty.rows.length, 0, 'no rows invented from prose');
  eq(empty.parsed, 0, 'nothing counted as parsed');

  // 17d ── through the handler, the proposal reaches the UI state
  freshFile();
  writeBreakpointConfig(pcfg);
  figma.currentPage.selection = [kit];
  globalThis.__posted = [];
  await figma.ui.onmessage({ type: 'uikit-parse', requestId: 'r9' });
  var pd = posted('uikit-done')[0];
  ok(!!pd, 'parse reports done');
  ok(pd.state.table && pd.state.table.length > 0, 'the proposal is carried in the state');
  eq(pd.state.tableFromFile, false, 'and is flagged as a proposal, not read from the file');
  ok(pd.message.indexOf('Check the table') !== -1, 'the message tells you to check it: ' + pd.message);

  print('');
  print(fail === 0 ? ('ALL PASS (' + pass + ' assertions)') : (pass + ' passed, ' + fail + ' FAILED'));
}
run().catch(function (e) { print('THREW: ' + e + '\n' + (e && e.stack)); });
