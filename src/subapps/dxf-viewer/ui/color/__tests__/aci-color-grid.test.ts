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
  FILL_COLOR_GRID,
  colorGridFor,
} from '../aci-color-grid';
import { getAciColor, ACI_PALETTE } from '../../../settings/standards/aci';
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

/**
 * ADR-739 Φ.Ε/Φ4β — το **δεύτερο** πλέγμα.
 *
 * Το test που δεν είναι διακοσμητικό είναι το πρώτο: **αποδεικνύει τη μέτρηση** πάνω στην οποία
 * στηρίζεται ολόκληρη η απόφαση να φύγει η ουδέτερη στήλη από το ACI. Αν κάποτε η παλέτα
 * αποκτήσει ανοιχτά γκρι, αυτό το test γίνεται κόκκινο — και τότε η στήλη **πρέπει** να
 * ξαναγίνει καθαρό ACI. Δηλαδή δεν φυλάει την υλοποίηση· φυλάει τον **λόγο** της.
 */
describe('🔴 Η ΜΕΤΡΗΣΗ ΠΟΥ ΔΙΚΑΙΟΛΟΓΕΙ ΤΟ ΔΕΥΤΕΡΟ ΠΛΕΓΜΑ', () => {
  it('η παλέτα ACI ΔΕΝ έχει κανένα ανοιχτό γκρι — μόνο καθαρό λευκό, μετά #BEBEBE', () => {
    const light = Object.entries(ACI_PALETTE)
      .filter(([, hex]) => {
        const v = String(hex);
        const channels = [v.slice(1, 3), v.slice(3, 5), v.slice(5, 7)].map((c) => parseInt(c, 16));
        return Math.min(...channels) >= 0xd0;
      })
      .map(([index, hex]) => `${index}=${String(hex).toUpperCase()}`);

    // Μόνο τα δύο λευκά. Η λωρίδα κεφαλίδας (#F5F5F5…#DDDDDD) — δηλαδή ακριβώς η ζώνη όπου ζει
    // ένα γέμισμα πίνακα, και όπου ζει το δικό μας προεπιλεγμένο #EDEDED — ΔΕΝ ΥΠΑΡΧΕΙ.
    expect(light.sort()).toEqual(['255=#FFFFFF', '7=#FFFFFF']);
  });
});

describe('FILL_COLOR_GRID — το πλέγμα γεμίσματος', () => {
  it('έχει ΑΚΡΙΒΩΣ το ίδιο σχήμα με του μελανιού — 13 × 6', () => {
    expect(FILL_COLOR_GRID).toHaveLength(ACI_GRID_HUE_KEYS.length);
    for (const column of FILL_COLOR_GRID) {
      expect(column).toHaveLength(ACI_GRID_SHADE_KEYS.length);
    }
  });

  it('🔴 ΔΕΙΧΝΕΙ το λευκό — η ασυμμετρία που ολόκληρη η Φ4β υπάρχει για να σεβαστεί', () => {
    // Το φίλτρο μελανιού εδώ θα ήταν καταστροφικό: `print-color-policy` το λέει ρητά για τον
    // ρόλο `'fill'`. Χωρίς λευκό, ένας πίνακας δεν μπορεί να καλύψει ό,τι είναι από κάτω.
    const whites = FILL_COLOR_GRID.flat().filter((swatch) => swatch.hex === '#ffffff');
    expect(whites).toHaveLength(1);
    expect(whites[0].aci).toBe(255);
  });

  it('🔴 φτάνει στη ζώνη της κεφαλίδας — υπάρχει δείγμα ανοιχτότερο από το #BEBEBE του ACI', () => {
    const neutral = FILL_COLOR_GRID[0];
    const darkest = (hex: string): number => Math.min(
      parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16),
    );
    // Ανάμεσα στο καθαρό λευκό και στο #BEBEBE: αυτό ακριβώς που το ACI δεν έχει.
    const inHeaderBand = neutral.filter((s) => darkest(s.hex) > 0xbe && s.hex !== '#ffffff');
    expect(inHeaderBand.map((s) => s.hex)).toEqual(['#f2f2f2', '#d9d9d9']);
  });

  it('οι 12 στήλες αποχρώσεων είναι ΤΑΥΤΟΣΗΜΕΣ με του μελανιού — αλλάζει μόνο η ουδέτερη', () => {
    // Η μνήμη χεριού δεν επιτρέπεται να σπάσει ανάμεσα στα δύο μενού: «τρίτο από αριστερά,
    // δεύτερη σειρά» οφείλει να είναι το ίδιο χρώμα και στα δύο.
    expect(FILL_COLOR_GRID.slice(1)).toEqual(ACI_COLOR_GRID.slice(1));
    expect(FILL_COLOR_GRID[0]).not.toEqual(ACI_COLOR_GRID[0]);
  });

  it('τέσσερα από τα έξι ουδέτερα κρατούν δείκτη ACI — μόνο όσα το ACI δεν έχει τον χάνουν', () => {
    const withAci = FILL_COLOR_GRID[0].filter((swatch) => swatch.aci !== undefined);
    expect(withAci.map((swatch) => swatch.aci)).toEqual([255, 254, 253]);
    // …συν το μαύρο και τα δύο γκρι του Excel, που δεν υπάρχουν στην παλέτα.
    expect(FILL_COLOR_GRID[0].filter((s) => s.aci === undefined).map((s) => s.hex))
      .toEqual(['#f2f2f2', '#d9d9d9', '#000000']);
  });

  it('κάθε δείγμα με δείκτη ACI είναι ΑΚΡΙΒΩΣ το χρώμα της παλέτας', () => {
    for (const swatch of FILL_COLOR_GRID.flat()) {
      if (swatch.aci === undefined) continue;
      expect(swatch.hex).toBe(normalizeHexColor(getAciColor(swatch.aci)));
    }
  });

  it('όλα τα hex είναι κανονικοποιημένα σε πεζά `#rrggbb`', () => {
    for (const swatch of FILL_COLOR_GRID.flat()) {
      expect(swatch.hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('η ουδέτερη στήλη πάει ανοιχτό → σκούρο, μονότονα', () => {
    const darkest = (hex: string): number => Math.min(
      parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16),
    );
    const ladder = FILL_COLOR_GRID[0].map((swatch) => darkest(swatch.hex));
    for (let i = 1; i < ladder.length; i += 1) expect(ladder[i]).toBeLessThan(ladder[i - 1]);
  });
});

describe('colorGridFor — η αντιστοίχιση ρόλου → πλέγμα ζει σε ΕΝΑ σημείο', () => {
  it('`fill` δίνει το πλέγμα γεμίσματος, `ink` του μελανιού', () => {
    expect(colorGridFor('fill')).toBe(FILL_COLOR_GRID);
    expect(colorGridFor('ink')).toBe(ACI_COLOR_GRID);
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
