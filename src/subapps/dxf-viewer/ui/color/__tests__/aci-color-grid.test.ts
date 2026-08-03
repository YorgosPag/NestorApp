/**
 * ADR-739 Φ.Ε/Φ4 — το πλέγμα χρωμάτων.
 *
 * Τα δύο tests που **δεν** είναι διακοσμητικά είναι το «κάθε δείγμα είναι ακριβής τιμή ACI»
 * (η εγγύηση απώλειας-μηδέν στην εξαγωγή) και το «κανένα λευκό» (το ελάττωμα που θα έβαφε
 * λευκό κείμενο σε λευκό φύλλο). Τα υπόλοιπα φυλάνε το σχήμα.
 */

import {
  ACI_COLOR_GRID,
  ACI_GRID_HUE_KEYS,
  ACI_GRID_SHADE_KEYS,
} from '../aci-color-grid';
import { getAciColor } from '../../../settings/standards/aci';
import { normalizeHexColor } from '../../../config/color-math';
import { survivesAsInk } from '../../../config/print-color-policy';

describe('ACI_COLOR_GRID — σχήμα', () => {
  it('έχει μία στήλη ανά απόχρωση και έξι σειρές σε καθεμία', () => {
    expect(ACI_COLOR_GRID).toHaveLength(ACI_GRID_HUE_KEYS.length);
    for (const column of ACI_COLOR_GRID) {
      expect(column).toHaveLength(ACI_GRID_SHADE_KEYS.length);
    }
  });

  it('κάθε στήλη φέρει τη δική της απόχρωση και τις σειρές με τη σειρά τους', () => {
    ACI_COLOR_GRID.forEach((column, columnIndex) => {
      for (const [rowIndex, swatch] of column.entries()) {
        expect(swatch.hue).toBe(ACI_GRID_HUE_KEYS[columnIndex]);
        expect(swatch.shade).toBe(ACI_GRID_SHADE_KEYS[rowIndex]);
      }
    });
  });

  it('η ουδέτερη στήλη είναι πρώτη — όπως στο Excel', () => {
    expect(ACI_COLOR_GRID[0][0].hue).toBe('neutral');
  });
});

describe('ACI_COLOR_GRID — η εγγύηση εξαγωγής', () => {
  it('κάθε δείγμα με δείκτη ACI είναι ΑΚΡΙΒΩΣ το χρώμα της παλέτας', () => {
    // Αυτό είναι το test που κάνει το πλέγμα καλύτερο από του Excel: ό,τι διαλέγει ο χρήστης
    // επιβιώνει ακέραιο και στο DXF group 420 και στο 62, χωρίς κβάντιση.
    for (const column of ACI_COLOR_GRID) {
      for (const swatch of column) {
        if (swatch.aci === undefined) continue;
        expect(swatch.hex).toBe(normalizeHexColor(getAciColor(swatch.aci)));
      }
    }
  });

  it('το μαύρο είναι το ΜΟΝΟ δείγμα χωρίς δείκτη ACI', () => {
    // Η παλέτα ACI δεν έχει καθαρό μαύρο· το ACI 7 λέγεται «White».
    const withoutAci = ACI_COLOR_GRID.flat().filter((swatch) => swatch.aci === undefined);
    expect(withoutAci).toHaveLength(1);
    expect(withoutAci[0].hex).toBe('#000000');
  });

  it('όλα τα hex είναι κανονικοποιημένα σε πεζά `#rrggbb`', () => {
    for (const swatch of ACI_COLOR_GRID.flat()) {
      expect(swatch.hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('ACI_COLOR_GRID — τίποτα αόρατο σε λευκό χαρτί', () => {
  it('κανένα δείγμα δεν είναι λευκό ή σχεδόν λευκό', () => {
    // 🔴 Αν σπάσει αυτό, η παλέτα προσφέρει «μαύρο» που γράφεται λευκό στο αρχείο.
    for (const swatch of ACI_COLOR_GRID.flat()) {
      expect(survivesAsInk(swatch.hex, swatch.aci ?? null)).toBe(true);
    }
  });

  it('το ACI 7 (η λευκή/μαύρη πένα) δεν εμφανίζεται πουθενά', () => {
    expect(ACI_COLOR_GRID.flat().some((swatch) => swatch.aci === 7)).toBe(false);
  });

  it('το ACI 255 (καθαρό λευκό) δεν εμφανίζεται πουθενά', () => {
    expect(ACI_COLOR_GRID.flat().some((swatch) => swatch.aci === 255)).toBe(false);
  });
});

describe('ACI_COLOR_GRID — οι αποχρώσεις διαβάζονται, δεν υπολογίζονται', () => {
  it('η στήλη του κόκκινου είναι η δεκάδα 10 της παλέτας', () => {
    const red = ACI_COLOR_GRID[ACI_GRID_HUE_KEYS.indexOf('red')];
    expect(red.map((swatch) => swatch.aci)).toEqual([11, 10, 12, 14, 16, 18]);
    expect(red.map((swatch) => swatch.hex)).toEqual([
      '#ff7f7f', '#ff0000', '#cc0000', '#990000', '#7f0000', '#4c0000',
    ]);
  });

  it('περιέχει τις βάσεις και των έξι ονομαστικών χρωμάτων ACI 1-6', () => {
    // Κόκκινο 10 · κίτρινο 50 · πράσινο 90 · κυανό 130 · μπλε 170 · ματζέντα 210.
    const indices = new Set(ACI_COLOR_GRID.flat().map((swatch) => swatch.aci));
    for (const base of [10, 50, 90, 130, 170, 210]) expect(indices.has(base)).toBe(true);
  });

  it('κάθε στήλη απόχρωσης σκουραίνει μονότονα κάτω από τη βάση', () => {
    for (const column of ACI_COLOR_GRID) {
      if (column[0].hue === 'neutral') continue;
      const belowBase = column.slice(1).map((swatch) => swatch.aci ?? 0);
      for (let i = 1; i < belowBase.length; i += 1) {
        expect(belowBase[i]).toBeGreaterThan(belowBase[i - 1]);
      }
    }
  });
});
