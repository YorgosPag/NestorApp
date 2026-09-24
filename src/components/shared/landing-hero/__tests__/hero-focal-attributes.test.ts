/**
 * ⚓ ADR-881 §4.4 — **η εστίαση του ήρωα σε δύο άξονες**.
 *
 * 🔴 Η άγκυρα διαβάζει **τα δύο CSS Modules** που καταναλώνουν τα `data-fx`/`data-fy` (ο ήρωας και ο
 *    δείκτης του εργαλείου): κάθε τιμή που μπορεί να γράψει το `heroFocalAttributes` πρέπει να έχει
 *    κανόνα — αλλιώς ένα `data-fx="85"` χωρίς κανόνα θα έπεφτε σιωπηλά στην προεπιλογή, και ο άνθρωπος
 *    θα έβλεπε «η εστίαση δεν πιάνει».
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { HERO_FOCAL_STEP, heroFocalAttributes } from '../hero-focal-attributes';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const MODULES = [
  { path: 'src/components/shared/landing-hero/landing-hero-focal.module.css', cls: 'focal', x: '--hero-focal-x', y: '--hero-focal-y' },
  { path: 'src/components/admin/landing-heroes/hero-focal-picker.module.css', cls: 'marker', x: 'left', y: 'top' },
] as const;

function declaredValues(css: string, cls: string, axis: 'x' | 'y', prop: string): number[] {
  const escapedProp = prop.replace(/-/g, '\\-');
  const pattern = new RegExp(`\\.${cls}\\[data-f${axis}="(\\d+)"\\] \\{ ${escapedProp}: (\\d+)%; \\}`, 'g');
  return [...css.matchAll(pattern)].map((match) => {
    expect(match[1]).toBe(match[2]);
    return Number(match[1]);
  });
}

describe('κάθε CSS Module καλύπτει ΑΚΡΙΒΩΣ τα πολλαπλάσια του βήματος', () => {
  const expected = Array.from({ length: 100 / HERO_FOCAL_STEP + 1 }, (_, i) => i * HERO_FOCAL_STEP);
  const cases = MODULES.flatMap((module) => (['x', 'y'] as const).map((axis) => ({ module, axis })));

  it.each(cases)('$module.cls · άξονας $axis', ({ module, axis }) => {
    expect(declaredValues(read(module.path), module.cls, axis, module[axis])).toEqual(expected);
  });
});

describe('σημείο → χαρακτηριστικά', () => {
  it('η ιστορική `object-[100%_85%]` του /pro αναπαράγεται ακριβώς', () => {
    expect(heroFocalAttributes({ x: 1, y: 0.85 })).toEqual({ 'data-fx': '100', 'data-fy': '85' });
  });

  it('κβαντίζει στο πλησιέστερο βήμα', () => {
    expect(heroFocalAttributes({ x: 0.33, y: 0.67 })).toEqual({ 'data-fx': '35', 'data-fy': '65' });
  });

  it('σφηνώνει εκτός ορίων και NaN ⇒ ποτέ τιμή χωρίς κανόνα', () => {
    expect(heroFocalAttributes({ x: -1, y: 2 })).toEqual({ 'data-fx': '0', 'data-fy': '100' });
    expect(heroFocalAttributes({ x: Number.NaN, y: 0.5 })).toEqual({ 'data-fx': '50', 'data-fy': '50' });
  });
});
