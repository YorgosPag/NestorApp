/**
 * ADR-750 Φάση 3 — **το εικονίδιο δεν επιτρέπεται να διαφωνήσει με την εντολή του**.
 *
 * Αυτό είναι το test που δικαιολογεί ολόκληρη την απόφαση «παραγόμενα εικονίδια αντί για 13
 * SVG»: με χειρόγραφα σχέδια **δεν υπάρχει τίποτα να συγκριθεί** — ένα λάθος βέλος σε ένα
 * bitmap είναι αόρατο σε κάθε εργαλείο. Εδώ η συμφωνία ελέγχεται ως ιδιότητα, πάνω και στις 13.
 *
 * Οι δύο κλάσεις του σφάλματος που πιάνονται:
 *  1. εικονίδιο που δείχνει **λιγότερες** γραμμές από όσες γράφει η εντολή (ο χρήστης πατά
 *     «Όλα» και βλέπει σχέδιο «Εξωτερικά»)·
 *  2. εικονίδιο που δείχνει **περισσότερες** — η χειρότερη εκδοχή, γιατί υπόσχεται γραμμές που
 *     δεν θα εμφανιστούν ποτέ.
 */

import React from 'react';
import { render } from '@testing-library/react';
import { TableBorderIcon } from '../TableBorderIcon';
import {
  TABLE_BORDER_COMMANDS,
  tableBorderSideCrossings,
  tableBorderSideOrientation,
  type TableBorderCommand,
} from '../../../../bim/table/table-range-border-ops';

/** Τα ίδια όρια που χρησιμοποιεί το component: το εικονίδιο **είναι** πίνακας 2×2. */
const ICON_BOUNDS = { firstRow: 0, lastRow: 1, firstCol: 0, lastCol: 1 } as const;

/** Οι ενεργές (συμπαγείς) γραμμές όπως τις ζωγράφισε το component, ως σύνολο «H0 / V2 / …». */
function paintedActiveLines(command: TableBorderCommand): ReadonlySet<string> {
  const { container } = render(<TableBorderIcon command={command} />);
  const groups = container.querySelectorAll('g');
  // Δύο ομάδες: [0] το διάστικτο πλέγμα (συμφραζόμενο), [1] η ενέργεια.
  const active = groups[1];
  const painted = new Set<string>();

  for (const line of Array.from(active.querySelectorAll('line'))) {
    const x1 = Number(line.getAttribute('x1'));
    const y1 = Number(line.getAttribute('y1'));
    const x2 = Number(line.getAttribute('x2'));
    // Οριζόντια ⇒ σταθερό `y`· κατακόρυφη ⇒ σταθερό `x`.
    const horizontal = x1 !== x2;
    painted.add(`${horizontal ? 'H' : 'V'}${indexOf(horizontal ? y1 : x1)}`);
  }
  return painted;
}

/**
 * Συντεταγμένη viewBox ⇒ δείκτης πλέγματος 0–2.
 *
 * Στρογγυλοποιεί επίτηδες: η διπλή γραμμή ζωγραφίζεται ως δύο παράλληλες **εκατέρωθεν** του
 * άξονά της, οπότε καμία από τις δύο δεν κάθεται ακριβώς πάνω του — και οι δύο όμως ανήκουν
 * στην ίδια θέση πλέγματος, που είναι αυτό που ελέγχεται εδώ.
 */
function indexOf(coordinate: number): number {
  const PAD = 1.5;
  const STEP = (16 - 2 * PAD) / 2;
  return Math.round((coordinate - PAD) / STEP);
}

/** Οι γραμμές που **απαιτεί** το μητρώο — η ίδια ερώτηση που κάνει και ο εφαρμοστής. */
function expectedActiveLines(command: TableBorderCommand): ReadonlySet<string> {
  const expected = new Set<string>();
  for (const part of command.parts) {
    // Το αόρατο μολύβι δεν έχει τι να δείξει: «Χωρίς περίγραμμα» = σκέτο πλέγμα.
    if (part.pen === 'hidden') continue;
    for (const side of part.sides) {
      const orientation = tableBorderSideOrientation(side);
      for (const at of tableBorderSideCrossings(side, ICON_BOUNDS)) {
        expected.add(`${orientation}${at}`);
      }
    }
  }
  return expected;
}

describe('ADR-750 Φ3 — τα 13 εικονίδια παράγονται από το μητρώο', () => {
  it.each(TABLE_BORDER_COMMANDS.map((c) => [c.id, c] as const))(
    '«%s»: οι συμπαγείς γραμμές είναι ΑΚΡΙΒΩΣ οι ακμές της εντολής',
    (_id, command) => {
      expect([...paintedActiveLines(command)].sort()).toEqual(
        [...expectedActiveLines(command)].sort(),
      );
    },
  );

  it('το διάστικτο πλέγμα είναι το ΙΔΙΟ και στα 13 — αυτό δίνει τη θέση', () => {
    // §8.2: μια συμπαγής γραμμή σε κενό φόντο λέει «γραμμή», όχι «κάτω». Χωρίς σταθερό πλέγμα
    // τα 13 εικονίδια θα ήταν αδιάκριτα μεταξύ τους.
    for (const command of TABLE_BORDER_COMMANDS) {
      const { container } = render(<TableBorderIcon command={command} />);
      const grid = container.querySelectorAll('g')[0];
      expect(grid.querySelectorAll('line')).toHaveLength(6);
      expect(grid.getAttribute('stroke-dasharray')).toBeTruthy();
    }
  });

  it('«Χωρίς περίγραμμα» δείχνει ΜΟΝΟ το πλέγμα — καμία συμπαγής γραμμή', () => {
    const none = TABLE_BORDER_COMMANDS.find((c) => c.id === 'none');
    expect(none).toBeDefined();
    expect(paintedActiveLines(none!).size).toBe(0);
  });

  it('«Όλα τα περιγράμματα» δείχνει ΚΑΙ ΤΙΣ ΕΞΙ γραμμές του πλέγματος 2×2', () => {
    const all = TABLE_BORDER_COMMANDS.find((c) => c.id === 'all');
    expect(paintedActiveLines(all!).size).toBe(6);
  });

  it('🔴 «Εξωτερικά» ΔΕΝ δείχνει τις εσωτερικές — αλλιώς θα ήταν ίδιο με το «Όλα»', () => {
    // Α10: το «Εξωτερικά» δεν αγγίζει τις εσωτερικές ακμές. Αν το εικονίδιο τις έδειχνε, δύο
    // διαφορετικές εντολές θα είχαν ταυτόσημο σχέδιο — και ο χρήστης δεν θα μάθαινε ποτέ γιατί
    // το πλέγμα του δεν άλλαξε.
    const outside = TABLE_BORDER_COMMANDS.find((c) => c.id === 'outside');
    const painted = paintedActiveLines(outside!);
    expect(painted.has('H1')).toBe(false);
    expect(painted.has('V1')).toBe(false);
    expect(painted.size).toBe(4);
  });

  it('το «παχύ» ζωγραφίζεται πιο χοντρό από το κανονικό — η διαφορά είναι ΟΡΑΤΗ', () => {
    const width = (id: string): number => {
      const command = TABLE_BORDER_COMMANDS.find((c) => c.id === id);
      const { container } = render(<TableBorderIcon command={command!} />);
      const line = container.querySelectorAll('g')[1].querySelector('line');
      return Number(line?.getAttribute('stroke-width'));
    };
    expect(width('thickBottom')).toBeGreaterThan(width('bottom'));
  });

  it('η διπλή γραμμή είναι ΔΥΟ παράλληλες στην ίδια θέση, ποτέ μία διακεκομμένη (§6.4)', () => {
    const double = TABLE_BORDER_COMMANDS.find((c) => c.id === 'doubleBottom');
    const { container } = render(<TableBorderIcon command={double!} />);
    const lines = Array.from(container.querySelectorAll('g')[1].querySelectorAll('line'));
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(line.getAttribute('stroke-dasharray')).toBeNull();
    // Και οι δύο ανήκουν στην κάτω ακμή του πλέγματος 2×2.
    expect(paintedActiveLines(double!)).toEqual(new Set(['H2']));
  });

  it('το SVG είναι aria-hidden — το όνομα το δίνει το κουμπί (§9.2)', () => {
    const { container } = render(<TableBorderIcon command={TABLE_BORDER_COMMANDS[0]} />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
