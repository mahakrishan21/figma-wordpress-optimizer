// ── Adopt an existing design into the system ──────────────────────────────
var ONMSG8 = figma.ui.onmessage;
function fresh8() { resetFigma(); figma.ui.onmessage = ONMSG8; globalThis.__posted = [];
                    figma._fonts = ['Inter|Regular', 'Inter|Medium', 'Inter|Semi Bold']; }
function posted8(t) { return (globalThis.__posted || []).filter(function (m) { return m.type === t; }); }

var pass = 0, fail = 0;
function ok(c, l) { if (c) pass++; else { fail++; print('  FAIL: ' + l); } }
function eq(a, b, l) { ok(a === b, l + '  (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }

var BPS = [{ name: 'Desktop', width: 1440 }, { name: 'Mobile', width: 375 }];
var CFG = { preset: 'custom', breakpoints: BPS };

function solid(hex, opacity) {
  var n = parseInt(hex.replace('#', ''), 16);
  return { type: 'SOLID', color: { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 },
           opacity: opacity === undefined ? 1 : opacity };
}
function propsFor(survey, kind, field) {
  return survey.proposals.filter(function (p) { return p.kind === kind && p.field === field; });
}

async function system() {
  fresh8();
  writeBreakpointConfig(CFG);
  await generateScaleVariables(CFG, defaultScaleTable(CFG, { brandHex: '#2563EB' }));
}

async function run() {
  // ── 1 ── no system yet ────────────────────────────────────────────────
  fresh8();
  var f0 = mkFrame({ name: 'Old', layoutMode: 'VERTICAL', paddingTop: 24 });
  figma.currentPage.selection = [f0];
  var s0 = await surveyAdoption([f0], {});
  eq(s0.proposals.length, 0, 'nothing proposed with no system');
  ok(s0.reasons.join(' ').indexOf('build one first') !== -1, 'and it says to build one');

  // ── 2 ── a hand-built design, slightly off the scale ──────────────────
  await system();
  var card = mkFrame({ name: 'Card', layoutMode: 'VERTICAL',
    paddingTop: 23, paddingLeft: 24, itemSpacing: 15, cornerRadius: 8, width: 320 });
  card.fills = [solid('#2563EB')];                       // exactly brand/500
  var heading = mkText('Heading');
  heading.fontSize = 24;
  heading.fills = [solid('#111828')];                    // a shade off a neutral
  card.appendChild(heading);
  figma.currentPage.appendChild(card);

  var sv = await surveyAdoption([card], {});
  ok(sv.proposals.length > 0, 'a hand-built design yields proposals  (' + sv.proposals.length + ')');
  ok(sv.exact > 0, 'some are exact  (' + sv.exact + ')');
  ok(sv.near > 0, 'and some are near misses  (' + sv.near + ')');

  // 23px padding should propose the 24px token, flagged as NOT exact
  var pad = propsFor(sv, 'space', 'paddingTop')[0];
  ok(!!pad, 'the 23px padding is matched');
  eq(pad.tokenName, 'space/300', 'to space/300');
  eq(pad.exact, false, 'and marked as a near miss, not an exact match');
  eq(pad.delta, 1, 'one pixel away');

  // 24px padding is exact
  var padL = propsFor(sv, 'space', 'paddingLeft')[0];
  eq(padL.exact, true, 'the 24px padding IS exact');
  eq(padL.delta, 0, 'zero away');

  // the brand fill matches exactly
  var fillProp = sv.proposals.filter(function (p) { return p.kind === 'color' && p.nodeName === 'Card'; })[0];
  ok(!!fillProp, 'the card fill is matched');
  eq(fillProp.tokenName, 'brand/500', 'to brand/500');
  eq(fillProp.exact, true, 'exactly');

  // 15px gap has no token within 2px of it... space/200 is 16, so it DOES
  var gap = propsFor(sv, 'space', 'itemSpacing')[0];
  ok(!!gap, 'the 15px gap finds the 16px step');
  eq(gap.exact, false, 'as a near miss');

  // ── 3 ── applying only the exact ones ─────────────────────────────────
  var accepted = {};
  sv.proposals.forEach(function (p) { if (!p.exact) accepted[p.key] = false; });
  var ap = await applyAdoption(sv.proposals, accepted);
  ok(ap.bound > 0, 'the exact matches bound  (' + ap.bound + ')');
  ok(ap.skipped > 0, 'the near misses were left alone  (' + ap.skipped + ')');
  eq(ap.failed, 0, 'nothing failed');

  ok(!!card.boundVariables.paddingLeft, 'the 24px padding is now bound');
  ok(!card.boundVariables.paddingTop, 'the 23px padding was NOT touched — it was unticked');
  eq(card.paddingTop, 23, 'and its value is unchanged');
  ok(card.fills[0].boundVariables && card.fills[0].boundVariables.color, 'the fill is bound to a colour token');

  // ── 4 ── a second survey sees what is already bound ───────────────────
  var sv2 = await surveyAdoption([card], {});
  ok(sv2.alreadyBound > 0, 'the bound ones are reported as already bound  (' + sv2.alreadyBound + ')');
  eq(propsFor(sv2, 'space', 'paddingLeft').length, 0, 'and not proposed again');
  ok(propsFor(sv2, 'space', 'paddingTop').length > 0, 'while the unticked one is still offered');

  // ── 5 ── tolerance is respected ───────────────────────────────────────
  await system();
  var odd = mkFrame({ name: 'Odd', layoutMode: 'VERTICAL', paddingTop: 37 });
  figma.currentPage.appendChild(odd);
  var tight = await surveyAdoption([odd], { spaceDelta: 1 });
  eq(propsFor(tight, 'space', 'paddingTop').length, 0, '37px finds nothing within 1px');
  ok(tight.unmatched.length > 0, 'and is reported as unmatched');
  var loose = await surveyAdoption([odd], { spaceDelta: 8 });
  ok(propsFor(loose, 'space', 'paddingTop').length > 0, 'but does within 8px');

  // ── 6 ── zero is left alone ───────────────────────────────────────────
  await system();
  var zero = mkFrame({ name: 'Zero', layoutMode: 'VERTICAL', paddingTop: 0, paddingLeft: 24 });
  figma.currentPage.appendChild(zero);
  var zs = await surveyAdoption([zero], {});
  eq(propsFor(zs, 'space', 'paddingTop').length, 0, 'a zero padding is a choice, not a token to snap');
  ok(propsFor(zs, 'space', 'paddingLeft').length > 0, 'while a real value still matches');

  // ── 7 ── typography ───────────────────────────────────────────────────
  await system();
  var txt = mkText('Hello');
  txt.fontSize = 24;
  var holder = mkFrame({ name: 'Holder', layoutMode: 'VERTICAL', children: [txt] });
  figma.currentPage.appendChild(holder);
  var ts = await surveyAdoption([holder], { fontDelta: 6 });
  var typeProps = propsFor(ts, 'type', 'fontSize');
  ok(typeProps.length > 0, 'a text size is matched to the type scale');
  ok(typeProps[0].tokenName.indexOf('text/size/') === 0, 'to a text/size token: ' + typeProps[0].tokenName);
  var ta = await applyAdoption(typeProps, {});
  eq(ta.bound, typeProps.length, 'and binds');

  // ── 7b ── one bound field must not hide the rest of the layer ─────────
  await system();
  var t2 = mkText('Hello');
  t2.fontSize = 24;
  t2.lineHeight = { unit: 'PERCENT', value: 150 };
  var box = mkFrame({ name: 'Box', layoutMode: 'VERTICAL', children: [t2] });
  figma.currentPage.appendChild(box);

  var before7 = await surveyAdoption([box], { fontDelta: 6 });
  ok(propsFor(before7, 'type', 'fontSize').length > 0, 'font size is offered');
  ok(propsFor(before7, 'type', 'lineHeight').length > 0, 'and so is line height');

  // bind ONLY the font size, then survey again
  var sizeOnly = propsFor(before7, 'type', 'fontSize');
  await applyAdoption(sizeOnly, {});
  ok(!!t2.boundVariables.fontSize, 'font size is now bound');

  var after7 = await surveyAdoption([box], { fontDelta: 6 });
  eq(propsFor(after7, 'type', 'fontSize').length, 0, 'the bound font size is not offered again');
  ok(propsFor(after7, 'type', 'lineHeight').length > 0,
     'but the UNBOUND line height still is — one bound field no longer hides the layer');
  ok(after7.alreadyBound > 0, 'and the bound one is counted');

  // ── 8 ── through the handler ──────────────────────────────────────────
  await system();
  var live = mkFrame({ name: 'Live', layoutMode: 'VERTICAL', paddingTop: 24, cornerRadius: 8 });
  live.fills = [solid('#2563EB')];
  figma.currentPage.appendChild(live);
  figma.currentPage.selection = [live];
  globalThis.__posted = [];
  await figma.ui.onmessage({ type: 'uikit-survey', requestId: 'a1' });
  var d = posted8('uikit-done')[0];
  ok(!!d, 'survey reports done');
  ok(d.result.proposals.length > 0, 'with proposals for the UI');
  ok(d.message.indexOf('Review before applying') !== -1, 'telling you to review: ' + d.message);

  globalThis.__posted = [];
  await figma.ui.onmessage({ type: 'uikit-adopt', requestId: 'a2',
                             proposals: d.result.proposals, accepted: {} });
  var d2 = posted8('uikit-done')[0];
  eq(d2.tone, 'success', 'applying succeeds');
  ok(d2.result.bound > 0, 'and binds');
  ok(!!live.boundVariables.paddingTop, 'the layer really is on the system now');

  // 8b ── nothing selected
  figma.currentPage.selection = [];
  globalThis.__posted = [];
  await figma.ui.onmessage({ type: 'uikit-survey', requestId: 'a3' });
  var d3 = posted8('uikit-done')[0];
  eq(d3.tone, 'warning', 'no selection warns');
  ok(d3.message.indexOf('Select a frame') !== -1, 'and asks for one');

  // ── 9 ── a styled layer must be LEFT ALONE ────────────────────────────
  // Writing node.fills on a layer painted by a style silently detaches the
  // style, so proposing a binding there would unpick the file's own styles.
  await system();
  var styled = mkFrame({ name: 'Styled', layoutMode: 'VERTICAL', paddingTop: 24 });
  styled.fills = [solid('#2563EB')];
  styled.fillStyleId = 'S:somestyle';
  figma.currentPage.appendChild(styled);
  var ss = await surveyAdoption([styled], {});
  eq(ss.proposals.filter(function (p) { return p.kind === 'color'; }).length, 0,
     'no colour binding is proposed onto a styled paint');
  ok(ss.styled > 0, 'and it is counted as left to its style  (' + ss.styled + ')');
  ok(ss.reasons.join(' ').indexOf('detach the style') !== -1, 'with the reason spelled out');
  ok(ss.proposals.filter(function (p) { return p.kind === 'space'; }).length > 0,
     'while its spacing is still offered — only the paint is off limits');

  // 9b ── a text layer using a text style keeps it
  await system();
  var st = mkText('Hello');
  st.fontSize = 24;
  st.textStyleId = 'T:sometextstyle';
  var holder2 = mkFrame({ name: 'Holder', layoutMode: 'VERTICAL', children: [st] });
  figma.currentPage.appendChild(holder2);
  var ts2 = await surveyAdoption([holder2], { fontDelta: 6 });
  eq(propsFor(ts2, 'type', 'fontSize').length, 0, 'no font size binding onto a styled text layer');
  ok(ts2.styled > 0, 'counted as styled');

  // ── 10 ── generate FROM a design and bind back INTO it, in one action ──
  fresh8();
  var kit = mkFrame({ name: 'Padding & Spacing', children: [
    mkFrame({ name: 'Group 1', children: [
      mkText('Spacing/ Desktop', 'heading'),
      mkFrame({ name: 'Frame 1', children: [mkText('300'), mkText('24px')] })
    ]})
  ]});
  var design = mkFrame({ name: 'Page', layoutMode: 'VERTICAL', paddingTop: 24, cornerRadius: 8,
                         children: [kit] });
  design.fills = [solid('#2563EB')];
  figma.currentPage.appendChild(design);
  figma.currentPage.selection = [design];

  eq(readBreakpointConfig(), null, 'nothing set up to begin with');
  var fd = await adoptFromDesign({});
  ok(!!readBreakpointConfig(), 'breakpoints were seeded');
  eq(fd.seededBreakpoints, true, 'and reported as seeded');
  ok(fd.generated.created > 0, 'tokens were generated  (' + fd.generated.created + ')');
  ok(!!fd.applied, 'and an apply ran');
  ok(fd.applied.bound > 0, 'binding values back INTO the design  (' + fd.applied.bound + ')');
  ok(!!design.boundVariables.paddingTop, 'the design itself is now on the system');

  // 10b ── exactOnly leaves the near misses alone
  fresh8();
  var d2 = mkFrame({ name: 'Page2', layoutMode: 'VERTICAL', paddingTop: 23, paddingLeft: 24 });
  figma.currentPage.appendChild(d2);
  figma.currentPage.selection = [d2];
  var fd2 = await adoptFromDesign({ exactOnly: true });
  ok(fd2.applied.skipped > 0, 'the near misses are skipped under exactOnly');
  eq(d2.paddingTop, 23, 'so a 23px padding is untouched');
  ok(!!d2.boundVariables.paddingLeft, 'while the exact 24px one is bound');

  // 10c ── nothing selected
  figma.currentPage.selection = [];
  var fd3 = await adoptFromDesign({});
  ok(fd3.reasons.join(' ').indexOf('Select the design') !== -1, 'it asks for a selection');

  // 10d ── through the handler
  fresh8();
  var d3 = mkFrame({ name: 'Page3', layoutMode: 'VERTICAL', paddingTop: 24 });
  figma.currentPage.appendChild(d3);
  figma.currentPage.selection = [d3];
  globalThis.__posted = [];
  await figma.ui.onmessage({ type: 'uikit-from-design', requestId: 'g1' });
  var gd = posted8('uikit-done')[0];
  ok(!!gd, 'the action reports done');
  ok(gd.message.indexOf('bound into the design') !== -1, 'saying it wired it up: ' + gd.message);

  print('');
  print(fail === 0 ? ('ALL PASS (' + pass + ' assertions)') : (pass + ' passed, ' + fail + ' FAILED'));
}
run().catch(function (e) { print('THREW: ' + e + '\n' + (e && e.stack)); });
