/**
 * # ΤΑ ΧΡΩΜΑΤΑ ΤΟΥ ΟΡΙΟΥ ΑΝΑΖΗΤΗΣΗΣ — ΕΝΑ ΛΕΞΙΛΟΓΙΟ, ΔΥΟ ΠΗΓΕΣ (ADR-883 · ADR-885)
 *
 * Το όριο δήμου (`AdminBoundaryLayer`) και το σχήμα που σχεδίασε ο επισκέπτης
 * (`DrawnAreaLayer`) είναι **το ίδιο πράγμα για τον άνθρωπο**: «εδώ ψάχνω». Ζωγραφίζονται
 * με τα **ίδια** χρώματα και κάθονται στο **ίδιο** σημείο της στοίβας — αλλιώς ο
 * επισκέπτης θα αναρωτιόταν γιατί η δική του περιοχή «μοιάζει άλλο πράγμα».
 *
 * | Ρόλος | Χρώμα | Γιατί |
 * |---|---|---|
 * | γραμμή | `--foreground` | μέγιστη αντίθεση με το υπόβαθρο του ίδιου θέματος |
 * | φωτοστέφανο | `--card` | ξεχωρίζει τη γραμμή από δρόμους, θάλασσα, δορυφόρο |
 * | μάσκα / γέμισμα | `--bg-overlay` | σκοτεινό **και στα δύο θέματα** |
 */

import { readRootCssVar } from '@/subapps/dxf-viewer/config/color-config';

/**
 * Το πρώτο επίπεδο των αγγελιών — το όριο ζωγραφίζεται **πριν** από αυτό (δες
 * `ResultsMapSources`). Πλαίσιο, όχι περιεχόμενο: πάνω από τις πινέζες θα έκλεβε κλικ.
 */
export const BELOW_LISTINGS = 'listing-outline-fill';

export interface BoundaryPaint {
  readonly line: string;
  readonly halo: string;
  readonly mask: string;
}

/** Διαβάζεται **τη στιγμή της απόδοσης**, ώστε η αλλαγή θέματος να φτάνει στον χάρτη. */
export function readBoundaryPaint(): BoundaryPaint {
  return {
    line: `hsl(${readRootCssVar('--foreground', '222 47% 11%')})`,
    halo: `hsl(${readRootCssVar('--card', '0 0% 100%')})`,
    mask: `hsl(${readRootCssVar('--bg-overlay', '220 26% 14%')})`,
  };
}

/** Πάχη γραμμής — κοινά ώστε σχέδιο και όριο να έχουν το ίδιο «βάρος». */
export const BOUNDARY_HALO_WIDTH = 6;
export const BOUNDARY_LINE_WIDTH = 2.5;
