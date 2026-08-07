#!/usr/bin/env node
/**
 * CHECK 3.32 — Categorical chart palette gate (ADR-710 §10).
 *
 * Reads `--chart-1..8` and the chart surface (`--card`) straight out of
 * `src/app/globals.css` for BOTH themes and re-derives the accessibility numbers
 * that the tokens claim in their comments. Zero tolerance: any FAIL blocks.
 *
 * WHY THIS EXISTS
 * ---------------
 * The reports palette carried the comment "Okabe-Ito Color-Blind Safe (ADR-265)"
 * for years. Nobody had ever measured it on this app's surfaces. When finally run
 * through the checks it failed both themes — its yellow scored 1.11:1 contrast,
 * slot 8 was pure black, and in dark mode two adjacent slots sat at ΔE 11.8, below
 * the floor for FULL-colour vision. Meanwhile `--chart-1..5` failed dark mode
 * outright. Two palettes, both labelled safe, both broken, both invisible to every
 * gate in the repo.
 *
 * A palette without a gate is a comment, not a guarantee (the ADR-587 lesson: "an
 * anchor without a gate is not an anchor — it's a comment"). This is the gate.
 *
 * THE METHOD (categorical six checks; ΔE = Euclidean distance in OKLab ×100)
 *   1. fixed hue anchors ....... structural — the slot ORDER is the CVD mechanism
 *   2. lightness band .......... OKLCH L 0.43–0.77 light · 0.48–0.67 dark
 *   3. chroma floor ............ OKLCH C ≥ 0.10 (below it a hue reads as grey)
 *   4. CVD separation .......... adjacent pairs ΔE ≥ 8 under protanopia/deuteranopia
 *                                (Machado-Oliveira-Fernandes 2009, severity 1.0),
 *                                plus a normal-vision floor of ΔE ≥ 15
 *   5. contrast vs surface ..... ≥ 3:1 for every mark
 *   6. documented palette ...... structural — values live in globals.css only
 *
 * Checks 4 and 5 are why this cannot be eyeballed: "these look different to me" is
 * exactly the judgement that produced the two broken palettes.
 *
 * Usage:  node scripts/validate-chart-palette.js [--verbose]
 */

'use strict';

const fs = require('fs');
const path = require('path');

const CSS_PATH = path.join(__dirname, '..', 'src', 'app', 'globals.css');
const SLOTS = 8;
const BAND = { light: [0.43, 0.77], dark: [0.48, 0.67] };
const CHROMA_FLOOR = 0.1;
const CVD_TARGET = 8.0;
const NORMAL_FLOOR = 15.0;
const CONTRAST_MIN = 3.0;

// ── colour maths ────────────────────────────────────────────────────────────
// 🔴 ADR-771 Φ.1 — the Machado 2009 matrices and the OKLab distance USED to live
// here, privately. They now live in `scripts/lib/contrast/cvd.js` because a second
// gate (state-channel distinctness for the ADR-769 liveness marks) asks the very
// same question of a different colour family. Copying them would have been the
// textbook sibling clone CHECK 3.28 exists to catch — and worse, two copies of a
// simulation model drift silently, at which point two gates answer "are these two
// colours distinguishable?" differently. Values are unchanged: this is a MOVE.
const {
  hslToRgb,
  toHex,
  oklch,
  contrast,
  deltaE,
} = require('./lib/contrast/cvd');

// ── CSS extraction ──────────────────────────────────────────────────────────
/** Slice the body of the first rule whose selector line matches `selector`. */
function ruleBody(css, selector) {
  const at = css.indexOf(selector);
  if (at === -1) return null;
  const open = css.indexOf('{', at);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  return null;
}
/** Read `--name: H S% L%;` and return sRGB in 0..1, or null when absent/aliased. */
function readHsl(body, name) {
  const m = new RegExp(`--${name}\\s*:\\s*([^;]+);`).exec(body);
  if (!m) return null;
  const raw = m[1].trim();
  if (raw.startsWith('var(')) return null; // alias, not a value — resolved elsewhere
  const parts = raw.match(/(-?[\d.]+)\s+(-?[\d.]+)%\s+(-?[\d.]+)%/);
  if (!parts) return null;
  return hslToRgb(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
}

// ── the checks ──────────────────────────────────────────────────────────────
function validate(mode, palette, surface, verbose) {
  const [lo, hi] = BAND[mode];
  const rows = [];
  let ok = true;
  const fail = (name, msg) => { ok = false; rows.push(['FAIL', name, msg]); };
  const pass = (name, msg) => rows.push(['PASS', name, msg]);

  const off = palette.filter((p) => { const L = oklch(p.rgb)[0]; return L < lo || L > hi; });
  if (off.length) fail('Lightness band', `outside L ${lo}–${hi}: ${off.map((p) => `${p.name} ${p.hex} L=${oklch(p.rgb)[0].toFixed(3)}`).join(', ')}`);
  else pass('Lightness band', `all ${palette.length} inside L ${lo}–${hi}`);

  const grey = palette.filter((p) => oklch(p.rgb)[1] < CHROMA_FLOOR);
  if (grey.length) fail('Chroma floor', `reads grey: ${grey.map((p) => `${p.name} ${p.hex} C=${oklch(p.rgb)[1].toFixed(3)}`).join(', ')}`);
  else pass('Chroma floor', `all ${palette.length} >= ${CHROMA_FLOOR}`);

  let worst = null;
  for (const kind of ['protan', 'deutan']) {
    for (let i = 0; i < palette.length - 1; i++) {
      const d = deltaE(palette[i].rgb, palette[i + 1].rgb, kind);
      if (!worst || d < worst.d) worst = { d, kind, a: palette[i], b: palette[i + 1] };
    }
  }
  if (worst && worst.d < CVD_TARGET) fail('CVD separation', `worst adjacent ${worst.a.name}↔${worst.b.name} ΔE ${worst.d.toFixed(1)} (${worst.kind}) < ${CVD_TARGET}`);
  else if (worst) pass('CVD separation', `worst adjacent ${worst.a.name}↔${worst.b.name} ΔE ${worst.d.toFixed(1)} (${worst.kind})`);

  let nWorst = null;
  for (let i = 0; i < palette.length - 1; i++) {
    const d = deltaE(palette[i].rgb, palette[i + 1].rgb, null);
    if (!nWorst || d < nWorst.d) nWorst = { d, a: palette[i], b: palette[i + 1] };
  }
  if (nWorst && nWorst.d < NORMAL_FLOOR) fail('Normal-vision floor', `worst adjacent ${nWorst.a.name}↔${nWorst.b.name} ΔE ${nWorst.d.toFixed(1)} < ${NORMAL_FLOOR} — hard to tell apart even with full colour vision`);
  else if (nWorst) pass('Normal-vision floor', `worst adjacent ${nWorst.a.name}↔${nWorst.b.name} ΔE ${nWorst.d.toFixed(1)}`);

  const dim = palette.filter((p) => contrast(p.rgb, surface.rgb) < CONTRAST_MIN);
  if (dim.length) fail('Contrast vs surface', `below ${CONTRAST_MIN}:1 on ${surface.hex}: ${dim.map((p) => `${p.name} ${p.hex} ${contrast(p.rgb, surface.rgb).toFixed(2)}:1`).join(', ')}`);
  else pass('Contrast vs surface', `all ${palette.length} >= ${CONTRAST_MIN}:1 on ${surface.hex}`);

  console.log(`\n  ${mode.toUpperCase()} — surface ${surface.hex}`);
  for (const [state, name, msg] of rows) {
    const colour = state === 'PASS' ? '\x1b[32m' : '\x1b[31m';
    console.log(`    ${colour}[${state}]\x1b[0m ${name.padEnd(21)} ${msg}`);
  }
  if (verbose) console.log(`    palette: ${palette.map((p) => p.hex).join(', ')}`);
  return ok;
}

// ── main ────────────────────────────────────────────────────────────────────
function main() {
  const verbose = process.argv.includes('--verbose');
  let css;
  try {
    css = fs.readFileSync(CSS_PATH, 'utf8');
  } catch {
    console.error(`\x1b[31m✖ CHECK 3.32 — cannot read ${CSS_PATH}\x1b[0m`);
    process.exit(1);
  }

  console.log('\x1b[1mCHECK 3.32 — categorical chart palette (ADR-710 §10)\x1b[0m');
  let allOk = true;

  for (const [mode, selector] of [['light', ':root {'], ['dark', '.dark {']]) {
    const body = ruleBody(css, selector);
    if (!body) {
      console.error(`\x1b[31m✖ ${mode}: rule "${selector}" not found in globals.css\x1b[0m`);
      allOk = false;
      continue;
    }
    const surfaceRgb = readHsl(body, 'card');
    if (!surfaceRgb) {
      console.error(`\x1b[31m✖ ${mode}: --card (chart surface) not found — contrast cannot be judged\x1b[0m`);
      allOk = false;
      continue;
    }
    const palette = [];
    const missing = [];
    for (let i = 1; i <= SLOTS; i++) {
      const rgb = readHsl(body, `chart-${i}`);
      if (!rgb) missing.push(`--chart-${i}`);
      else palette.push({ name: `chart-${i}`, rgb, hex: toHex(rgb) });
    }
    if (missing.length) {
      console.error(`\x1b[31m✖ ${mode}: missing token(s) ${missing.join(', ')} — the palette must define all ${SLOTS} slots in both themes\x1b[0m`);
      allOk = false;
      continue;
    }
    if (!validate(mode, palette, { rgb: surfaceRgb, hex: toHex(surfaceRgb) }, verbose)) allOk = false;
  }

  if (allOk) {
    console.log('\n\x1b[32m✓ CHECK 3.32 PASS — the palette clears every gate in both themes.\x1b[0m');
    process.exit(0);
  }
  console.log('\n\x1b[31m✖ CHECK 3.32 FAILED — commit blocked.\x1b[0m');
  console.log('  These are measurements, not opinions. Do NOT relax the thresholds to get green:');
  console.log('  re-step the offending slot (hold its hue, move its lightness/chroma) until it passes.');
  console.log('  The slot ORDER is the colour-blind-safety mechanism — reordering to "look nicer" voids it.');
  console.log('  Full rationale + the derivation procedure: ADR-710 §10.');
  process.exit(1);
}

main();
