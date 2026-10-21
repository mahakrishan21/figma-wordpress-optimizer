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

Each suite is concatenated after the mock and `code.js`, because `code.js` is a
plain script with no module system — that is what the Figma sandbox gives it, so
the tests run it the same way.

`run.sh` also checks that `code.js` parses and holds to ES2017: the Figma sandbox
rejects `?.`, `??` and `\p{...}` property escapes.

**`jsc` exits 0 even when assertions fail**, so the runner decides from the
output. A suite that prints `FAIL`, `FAILED`, `THREW` or `Exception` fails the
run.

These suites cannot prove anything that needs real Figma: undo grouping, how
`setExplicitVariableModeForCollection` behaves against the live API, or whether
a bound frame actually reflows on screen. Those are checked by hand in Figma
Desktop.
