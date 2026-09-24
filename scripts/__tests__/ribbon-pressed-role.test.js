/**
 * 🔴 **ΤΟ ΠΑΤΗΜΕΝΟ ΕΡΓΑΛΕΙΟ ΤΟΥ RIBBON ΦΑΙΝΕΤΑΙ** — ADR-770 §19.7 (εύρημα της επαλήθευσης ADR-777 §8.74, 2026-09-24).
 * @related src/subapps/dxf-viewer/ui/ribbon/styles/ribbon-tokens.css · scripts/lib/contrast/selection-control-role.js
 *
 * Μετρημένο σε browser: το ενεργό εργαλείο («Επιλογή») είχε γέμισμα `#1464A0` πάνω στο navy `#1D283A` = **2,37:1**,
 * κάτω από το 3:1 του WCAG 1.4.11. Ήταν δεύτερο μπλε «πατημένου», έξω από τον ρόλο της §17/§19, και καμία πύλη
 * δεν το έβλεπε: το ribbon δεν είναι primitive και δεν γράφει κλάσεις Tailwind.
 *
 * Τι ρωτά, με τους **ίδιους** μετρητές (`css-token-themes` + `wcag-contrast`), στα **δύο** θέματα:
 *   Ρ1 · το «πατημένο» του ribbon **είναι** ο ρόλος (`--control-accent` / `-foreground`), όχι δικό του χρώμα.
 *   Ρ2 · γέμισμα πατημένου πάνω στο σώμα του ribbon ≥ 3:1 · μελάνι πάνω στο γέμισμα ≥ 4,5:1.
 *   Ρ3 · κάθε κανόνας που βάφει `--ribbon-btn-active` και δηλώνει χρώμα, δηλώνει το **μελάνι του ρόλου** — ποτέ hex.
 *
 * ΜΕΤΑΛΛΑΞΕΙΣ: (1) ξανά `--ribbon-btn-active: #1464A0` στο σκοτεινό ⇒ Ρ1 + Ρ2 κόκκινες ·
 *              (2) ξανά `color: #FFFFFF` σε έναν κανόνα ενεργού ⇒ Ρ3 κόκκινη.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { readThemes, describeValue } = require('../lib/contrast/css-token-themes');
const { hslToRgb, contrastRatio } = require('../lib/contrast/wcag-contrast');

const RIBBON_CSS = path.join(process.cwd(), 'src/subapps/dxf-viewer/ui/ribbon/styles/ribbon-tokens.css');
const css = fs.readFileSync(RIBBON_CSS, 'utf8');
const themes = readThemes();

/** Το σώμα του ΠΡΩΤΟΥ μπλοκ με αυτόν τον επιλογέα (φωτεινό = `:root`, σκοτεινό = `.dark, [data-theme="dark"]`). */
function blockBody(selectorRe) {
  const match = selectorRe.exec(css);
  if (match === null) throw new Error(`ribbon-tokens.css: λείπει μπλοκ ${selectorRe}`);
  const open = css.indexOf('{', match.index);
  return css.slice(open + 1, css.indexOf('}', open));
}

const RIBBON_THEMES = {
  light: blockBody(/^:root\s*\{/m),
  dark: blockBody(/^\.dark,\s*\n\[data-theme="dark"\]\s*\{/m),
};

function declared(body, name) {
  const found = new RegExp(`${name}:\\s*([^;]+);`).exec(body);
  if (found === null) throw new Error(`ribbon-tokens.css: λείπει ${name}`);
  return found[1].trim();
}

/** hex · `hsl(var(--x))` (λύνεται από το `globals.css` του ίδιου θέματος) — αλλιώς fail-closed. */
function rgbOf(value, themeId) {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex !== null) return [0, 2, 4].map((at) => parseInt(hex[1].slice(at, at + 2), 16));
  const token = /^hsl\(var\((--[a-z0-9-]+)\)\)$/i.exec(value);
  if (token === null) throw new Error(`Άγνωστη μορφή χρώματος «${value}» — fail-closed.`);
  const described = describeValue(themes[themeId].get(token[1]) ?? '');
  if (described.kind !== 'literal') throw new Error(`${token[1]} (${themeId}) δεν είναι literal — fail-closed.`);
  return hslToRgb(described.hsl);
}

describe('ADR-770 §19.7 — το πατημένο του ribbon είναι ο ρόλος, και φαίνεται', () => {
  it.each(['light', 'dark'])('Ρ1 · %s: το «πατημένο» δείχνει στον ρόλο --control-accent', (themeId) => {
    const body = RIBBON_THEMES[themeId];
    expect(declared(body, '--ribbon-btn-active')).toBe('hsl(var(--control-accent))');
    expect(declared(body, '--ribbon-btn-active-foreground')).toBe('hsl(var(--control-accent-foreground))');
  });

  it.each(['light', 'dark'])('Ρ2 · %s: γέμισμα/σώμα ≥ 3:1 και μελάνι/γέμισμα ≥ 4,5:1', (themeId) => {
    const body = RIBBON_THEMES[themeId];
    const fill = rgbOf(declared(body, '--ribbon-btn-active'), themeId);
    const ink = rgbOf(declared(body, '--ribbon-btn-active-foreground'), themeId);
    const surface = rgbOf(declared(body, '--ribbon-bg'), themeId);
    expect(contrastRatio(fill, surface)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(ink, fill)).toBeGreaterThanOrEqual(4.5);
  });

  it('Ρ3 · κάθε κανόνας ενεργού που δηλώνει χρώμα, δηλώνει το μελάνι του ρόλου — ποτέ hex', () => {
    const offenders = [];
    for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const [, selector, body] = rule;
      const paintsActive = /background:\s*var\(--ribbon-btn-active\)/.test(body) || /\[data-active="true"\]\s+\S/.test(selector);
      const color = /(?:^|;|\s)color:\s*([^;]+);/.exec(body);
      if (paintsActive && color !== null && color[1].trim() !== 'var(--ribbon-btn-active-foreground)') {
        offenders.push(`${selector.trim()} → color: ${color[1].trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
