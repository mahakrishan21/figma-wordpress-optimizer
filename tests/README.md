# Sandbox tests

```sh
./tests/run.sh
```

Runs every `tests/*tests.js` suite under JavaScriptCore, which ships with macOS —
no npm install, no network, nothing to keep up to date.

| File | What it covers |
|---|---|
| `mockfigma.js` | A minimal Figma sandbox: styles, variables, collections and modes, auto-layout nodes, plugin data. `figma._modeCap` sets the mode ceiling so both outcomes can be exercised. |
| `uikittests.js` | Mode plumbing, UI Kit collections, breakpoint config, the scale generator and its aliasing, binding, breakpoint preview, the canvas parser, and the message handler. |
| `dupgonetests.js` | Near-duplicate detection and merging across styles and variables. |
| `qatests.js` | Every design-system message driven through `figma.ui.onmessage`, the way the UI sends them — so routing, the `requestId` the UI correlates on, the undo boundary and the summary line are covered too. |
| `inbuilttests.js` | The features that shipped before the design-system tab: the audit's rules, ignoring and clearing issues, each automated fix, the copy collector, focus and the window clamp. |

Each suite is concatenated after the mock and `code.js`, because `code.js` is a
plain script with no module system — that is what the Figma sandbox gives it, so
the tests run it the same way.

`run.sh` also checks that `code.js` parses and holds to ES2017: the Figma sandbox
rejects `?.`, `??` and `\p{...}` property escapes.

**`jsc` exits 0 even when assertions fail**, so the runner decides from the
output. A suite that prints `FAIL`, `FAILED`, `THREW` or `Exception` fails the
run.

## The tab's own buttons

```sh
./tests/uiactions.sh
```

Drives every `data-act` on the **Build design system** tab and prints what each
one did; exits non-zero if any of them is missing, posts the wrong message or
leaves the screen where it should not. `tests/uiactions.html` loads `ui.html`
in a same-origin iframe and clicks the real buttons the real render produced,
so a button that stops being rendered fails the run rather than quietly
disappearing.

It uses the Chromium that Playwright already cached under
`~/Library/Caches/ms-playwright` and a `python3 -m http.server` it starts and
stops itself — nothing to install. If that cache is gone, point `SHELL_BIN` at
any Chrome with `--headless --dump-dom`.

Two outcomes are expected rather than broken, and the harness says so: the
export block is no longer rendered on the tab, so `uik-export` and `uik-copy`
cannot be reached.

These suites cannot prove anything that needs real Figma: undo grouping, how
`setExplicitVariableModeForCollection` behaves against the live API, or whether
a bound frame actually reflows on screen. Those are checked by hand in Figma
Desktop.
