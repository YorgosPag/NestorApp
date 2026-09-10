/**
 * Άγκυρα «η μύτη ΕΙΝΑΙ η άγκυρα» — ADR-332 D27 Β8.
 *
 * Κάθε πινέζα που δένεται σε `Marker` με `anchor="bottom"` πρέπει να έχει τη μύτη της **ακριβώς**
 * στο κάτω άκρο του κουτιού της: η μηχανή (MapLibre) βάζει εκεί το σημείο, και ο άνθρωπος
 * σέρνει τη **μύτη**. Αν διαφέρουν, ό,τι βλέπει δεν είναι ό,τι αποθηκεύεται.
 *
 * 🔑 Η μύτη **δεν** δίνεται στο test ως αριθμός: **υπολογίζεται** από τα δεδομένα του `path`
 * της αποδοσμένης πινέζας (ανώτατο y όλων των σημείων, απόλυτων και σχετικών εντολών), και
 * συγκρίνεται με το κάτω άκρο του `viewBox`. Ένα αλλαγμένο σχήμα ή viewBox κοκκινίζει μόνο του.
 *
 * ⚠️ Το jsdom δεν κάνει διάταξη· γι' αυτό ελέγχεται ότι **μόνο** το svg μένει στη ροή του κουτιού.
 * Η ζωντανή μέτρηση (μύτη ⇄ `project()` του σημείου) είναι γραμμένη στο ADR-332 D27 Β8.
 */

import React from 'react';
import { render } from '@testing-library/react';

import { DraggableMarkerPin } from '../address-map-config';
import { WorkerPin } from '@/components/projects/ika/components/WorkerPin';
import { GeofenceMarkerPin } from '@/components/projects/ika/components/GeofenceMarkerPin';

type Point = readonly [number, number];

/** Όλα τα σημεία (τελικά + ελέγχου) ενός SVG path με εντολές M/L/C/S/Q/Z, απόλυτες και σχετικές. */
function pathPoints(d: string): Point[] {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const arity: Record<string, number> = { m: 2, l: 2, c: 6, s: 4, q: 4, t: 2, z: 0 };
  const points: Point[] = [];
  let cx = 0;
  let cy = 0;
  let cmd = '';
  let i = 0;
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    const n = arity[cmd.toLowerCase()];
    if (n === undefined) throw new Error(`Εντολή path χωρίς υποστήριξη: ${cmd}`);
    if (n === 0) continue;
    const args = tokens.slice(i, i + n).map(Number);
    i += n;
    const relative = cmd === cmd.toLowerCase();
    for (let k = 0; k < n; k += 2) {
      points.push([relative ? cx + args[k] : args[k], relative ? cy + args[k + 1] : args[k + 1]]);
    }
    [cx, cy] = points[points.length - 1];
  }
  return points;
}

function measurePin(ui: React.ReactElement) {
  const { container } = render(ui);
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('Η πινέζα δεν αποδίδει svg');
  const [, minY, , vbHeight] = (svg.getAttribute('viewBox') ?? '').split(/\s+/).map(Number);
  const body = svg.querySelector('path');
  if (!body) throw new Error('Η πινέζα δεν έχει σώμα (path)');
  const tipY = Math.max(...pathPoints(body.getAttribute('d') ?? '').map(([, y]) => y));
  return { container, svg, tipY, boxBottom: minY + vbHeight };
}

const PINS: ReadonlyArray<[string, React.ReactElement]> = [
  ['διεύθυνση — κύρια με ετικέτα', <DraggableMarkerPin key="a" isPrimary label="Εργοτάξιο" />],
  ['διεύθυνση — υποκατάστημα', <DraggableMarkerPin key="b" label="Αποθήκη" />],
  ['διεύθυνση — σε επεξεργασία', <DraggableMarkerPin key="c" isPrimary isEditing label="Εργοτάξιο" />],
  ['διεύθυνση — νέα, κενή', <DraggableMarkerPin key="d" isPrimary pulsate />],
  ['ΙΚΑ — εργαζόμενος', <WorkerPin key="e" color="#16a34a" />],
  ['ΙΚΑ — γεωφράχτης', <GeofenceMarkerPin key="f" />],
];

describe('η μύτη της πινέζας ΕΙΝΑΙ το σημείο που αποθηκεύεται (anchor="bottom")', () => {
  it.each(PINS)('%s: το κάτω άκρο του viewBox = η μύτη του σχήματος', (_name, ui) => {
    const { tipY, boxBottom } = measurePin(ui);
    expect(boxBottom).toBeCloseTo(tipY, 6);
  });

  it.each(PINS.slice(0, 4))('%s: μόνο το svg μετρά στο κουτί — ό,τι άλλο είναι εκτός ροής', (_name, ui) => {
    const { svg } = measurePin(ui);
    const box = svg.parentElement as HTMLElement;
    // `flex` = το svg μπλοκοποιείται ⇒ κανένα κενό γραμμής βάσης κάτω από τη μύτη.
    expect(box.className).toMatch(/\bflex\b/);
    for (const child of Array.from(box.children)) {
      if (child === svg) continue;
      expect(child.className).toMatch(/\babsolute\b/);
    }
  });

  it.each(PINS.slice(0, 4))('%s: το σώμα της πινέζας ΔΕΝ κινείται — η ένδειξη ζει στο έδαφος', (_name, ui) => {
    const { svg } = measurePin(ui);
    const box = svg.parentElement as HTMLElement;
    for (const el of [box, svg, svg.querySelector('path')]) {
      expect(el?.getAttribute('class') ?? '').not.toMatch(/animate-/);
    }
  });

  it('η ένδειξη «επεξεργάζεσαι αυτή» είναι δακτύλιος κεντραρισμένος ΣΤΗ ΜΥΤΗ', () => {
    const { svg, tipY } = measurePin(<DraggableMarkerPin isPrimary isEditing />);
    const ring = svg.querySelector('[data-pin-ground-ring]');
    expect(ring).not.toBeNull();
    expect(Number(ring?.getAttribute('cy'))).toBe(tipY);
  });

  it('η σκιά εδάφους κάθεται στη μύτη, όχι κάτω από αυτήν', () => {
    const { svg, tipY } = measurePin(<DraggableMarkerPin isPrimary />);
    expect(Number(svg.querySelector('ellipse')?.getAttribute('cy'))).toBe(tipY);
    expect(svg.getAttribute('overflow')).toBe('visible');
  });
});
