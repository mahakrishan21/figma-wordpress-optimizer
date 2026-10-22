// ── Export: CSS, theme.json, DTCG, Tailwind ───────────────────────────────
var ONMSG5 = figma.ui.onmessage;
function fresh5() { resetFigma(); figma.ui.onmessage = ONMSG5; globalThis.__posted = [];
                    figma._fonts = ['Inter|Regular', 'Inter|Medium', 'Inter|Semi Bold']; }
function posted5(t) { return (globalThis.__posted || []).filter(function (m) { return m.type === t; }); }

var pass = 0, fail = 0;
function ok(c, l) { if (c) pass++; else { fail++; print('  FAIL: ' + l); } }
function eq(a, b, l) { ok(a === b, l + '  (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }
function has(s, sub, l) { ok(String(s).indexOf(sub) !== -1, l + '  (missing "' + sub + '")'); }

var BPS = [{ name: 'Desktop', width: 1440 }, { name: 'Tablet', width: 768 }, { name: 'Mobile', width: 375 }];
var CFG = { preset: 'custom', breakpoints: BPS };

async function build() {
  fresh5();
  writeBreakpointConfig(CFG);
  await generateScaleVariables(CFG, defaultScaleTable(CFG, { brandHex: '#2563EB' }));
}

async function run() {
  // ── 1 ── nothing to export ────────────────────────────────────────────
  fresh5();
  var none = await exportDesignSystem('css');
  eq(none.empty, true, 'an empty file exports nothing');
  eq(none.text, '', 'with no text');

  // ── 2 ── CSS ──────────────────────────────────────────────────────────
  await build();
  var css = await exportDesignSystem('css');
  eq(css.format, 'css', 'format echoed');
  eq(css.filename, 'design-system.css', 'sensible filename');
  has(css.text, ':root {', 'opens a :root block');
  has(css.text, '--space-300: 24px;', 'spacing with a px unit');
  has(css.text, '--brand-500: #2563eb', 'colour as hex');
  has(css.text, '@media (max-width: 768px)', 'a media query per narrower canvas size');
  has(css.text, '@media (max-width: 375px)', 'including the narrowest');

  // the base block carries the WIDEST value, media queries carry the rest
  var rootBlock = css.text.slice(0, css.text.indexOf('@media'));
  has(rootBlock, '--text-size-h1:', 'h1 is in :root');
  var h1Desktop = /--text-size-h1:\s*(\d+)px/.exec(rootBlock);
  var tabletBlock = css.text.slice(css.text.indexOf('@media (max-width: 768px)'));
  var h1Tablet = /--text-size-h1:\s*(\d+)px/.exec(tabletBlock);
  ok(h1Desktop && h1Tablet && Number(h1Tablet[1]) < Number(h1Desktop[1]),
     'and gets smaller in the narrower query  (' + (h1Desktop && h1Desktop[1]) + ' -> ' + (h1Tablet && h1Tablet[1]) + ')');

  // unitless things stay unitless
  has(css.text, '--opacity-disabled: 0.4;', 'opacity has no unit');
  ok(css.text.indexOf('--grid-columns: 12px') === -1, 'a column count is not given a px unit');

  // ── 3 ── WordPress theme.json ─────────────────────────────────────────
  var wp = await exportDesignSystem('theme-json');
  eq(wp.filename, 'design-system.json', 'json filename');
  var parsed = JSON.parse(wp.text);
  eq(parsed.version, 3, 'theme.json version 3');
  has(parsed.$schema, 'schemas.wp.org', 'with the WordPress schema');
  ok(parsed.settings.color.palette.length > 10, 'a colour palette  (' + parsed.settings.color.palette.length + ')');
  ok(parsed.settings.color.palette[0].slug && parsed.settings.color.palette[0].color,
     'each palette entry has a slug and a colour');
  ok(parsed.settings.spacing.spacingSizes.length > 5, 'spacing sizes');

  // the four canvas sizes collapse into fluid typography — the whole point
  eq(parsed.settings.typography.fluid, true, 'fluid typography is on');
  var h1 = parsed.settings.typography.fontSizes.filter(function (f) { return f.slug === 'h1'; })[0];
  ok(!!h1, 'h1 is a font size');
  ok(!!h1.fluid, 'with a fluid range');
  ok(parseInt(h1.fluid.min, 10) < parseInt(h1.fluid.max, 10),
     'min from the narrowest canvas, max from the widest  (' + h1.fluid.min + ' -> ' + h1.fluid.max + ')');
  has(parsed.settings.layout.contentSize, 'px', 'content size comes from canvas/content');

  // ── 3b ── the DARK theme must survive the CSS export ──────────────────
  // The Theme collection holds a value per mode; emitting only the first
  // threw the dark theme away silently.
  has(css.text, '[data-theme="dark"]', 'a dark theme block is emitted');
  var darkBlock = css.text.slice(css.text.indexOf('[data-theme="dark"]'));
  darkBlock = darkBlock.slice(0, darkBlock.indexOf('}'));
  has(darkBlock, '--color-text-primary:', 'carrying the semantic colours');
  var lightText = /--color-text-primary:\s*([^;]+);/.exec(rootBlock);
  var darkText = /--color-text-primary:\s*([^;]+);/.exec(darkBlock);
  ok(lightText && darkText && lightText[1].trim() !== darkText[1].trim(),
     'and a DIFFERENT value to the light one  (' + (lightText && lightText[1].trim()) +
     ' vs ' + (darkText && darkText[1].trim()) + ')');

  // ── 4 ── DTCG ─────────────────────────────────────────────────────────
  var dt = await exportDesignSystem('dtcg');
  var d = JSON.parse(dt.text);
  ok(!!d.space && !!d.space['300'], 'nested by path: space.300');
  eq(d.space['300'].$type, 'dimension', 'typed as a dimension');
  eq(d.space['300'].$value, '24px', 'with its value');
  eq(d.brand['500'].$type, 'color', 'colours typed as color');
  eq(d.opacity.disabled.$type, 'number', 'opacity typed as number, not dimension');
  var dh1 = d.text.size.h1;
  ok(!!dh1.$extensions && !!dh1.$extensions['com.figma.modes'],
     'a responsive token carries every mode in $extensions');
  ok(!!dh1.$extensions['com.figma.modes'].Mobile, 'including Mobile');

  // ── 5 ── Tailwind ─────────────────────────────────────────────────────
  var tw = await exportDesignSystem('tailwind');
  eq(tw.filename, 'design-system.js', 'js filename');
  has(tw.text, 'module.exports', 'a config module');
  var json = tw.text.slice(tw.text.indexOf('{'), tw.text.lastIndexOf('}') + 1);
  var cfgObj = JSON.parse(json);
  eq(cfgObj.theme.extend.spacing['300'], '24px', 'spacing scale');
  ok(!!cfgObj.theme.extend.colors.brand, 'colours grouped by ramp');
  eq(cfgObj.theme.extend.colors.brand['500'], '#2563eb', 'brand/500 becomes colors.brand.500');
  ok(!!cfgObj.theme.extend.fontSize.h1, 'font sizes');
  // Tailwind screens are min-width, so they run the other way round
  var screenKeys = Object.keys(cfgObj.theme.extend.screens);
  eq(screenKeys[0], 'mobile', 'screens run narrowest first, the way Tailwind reads them');
  eq(cfgObj.theme.extend.screens.desktop, '1440px', 'with the canvas widths');

  // ── 6 ── through the handler ──────────────────────────────────────────
  await build();
  globalThis.__posted = [];
  await figma.ui.onmessage({ type: 'uikit-export', requestId: 'x1', format: 'theme-json' });
  var d2 = posted5('uikit-done')[0];
  ok(!!d2, 'export reports done');
  eq(d2.tone, 'success', 'and succeeds');
  has(d2.message, 'theme.json', 'naming the format: ' + d2.message);
  ok(d2.result.text.length > 100, 'and carries the text to the UI');

  // 6b ── exporting an empty file is a warning, not an error
  fresh5();
  globalThis.__posted = [];
  await figma.ui.onmessage({ type: 'uikit-export', requestId: 'x2', format: 'css' });
  var d3 = posted5('uikit-done')[0];
  eq(d3.tone, 'warning', 'empty file warns');
  has(d3.message, 'no design system', 'and says so');

  print('');
  print(fail === 0 ? ('ALL PASS (' + pass + ' assertions)') : (pass + ' passed, ' + fail + ' FAILED'));
}
run().catch(function (e) { print('THREW: ' + e + '\n' + (e && e.stack)); });
