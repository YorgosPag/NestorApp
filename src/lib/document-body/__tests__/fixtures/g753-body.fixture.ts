/**
 * @fileoverview Το **πραγματικό** σχέδιο ως είσοδος του Λ1β — fixture (ADR-759 Φ4).
 *
 * ΠΑΡΑΓΟΜΕΝΟ από το αρχείο που παρέδωσε ο τοπογράφος:
 *   «G753_ergasia F.dxf» · 941.160 bytes · AC1032 (AutoCAD 2018) · UTF-8
 *   **574 κείμενα** (266 MTEXT + 308 TEXT) σε **20 layers** — δηλαδή **όλα** όσα φέρει το
 *   φύλλο, όχι δείγμα. Το JSON δίπλα κρατά λαβή, layer, θέση, ύψος και **ωμό** περιεχόμενο.
 *
 * 🔴 **ΓΙΑΤΙ ΟΛΑ ΚΑΙ ΟΧΙ ΜΟΝΟ ΤΑ ΤΕΣΣΕΡΑ ΕΓΓΡΑΦΑ.** Το ερώτημα που πρέπει να απαντά η σουίτα
 * δεν είναι «διαβάζεις σωστά αυτό το κείμενο;» αλλά **«ξεχωρίζεις τα έγγραφα μέσα σε ολόκληρο
 * το σχέδιο;»**. Με fixture μόνο των εγγράφων, ένας σαρωτής που δέχεται **τα πάντα** θα
 * φαινόταν εξίσου σωστός. Μετρημένο: το layer `ΠΕΡΙΓΡΑΦΗ` έχει **79** κείμενα και **2**
 * έγγραφα· τα υπόλοιπα 77 είναι διαστάσεις («5.00»), λεζάντες («κράσπεδο») και ονόματα οδών.
 *
 * 🔴 **ΜΗΝ «διορθώσεις» τίποτα εδώ.** Κάθε παραδοξότητα είναι ΜΕΤΡΗΜΕΝΗ:
 *   · «A ΟΡΟΙ ΔΟΜΗΣΗΣ» ξεκινά με **λατινικό A** και δεν έχει τελεία, σε αντίθεση με τα Β–Ι
 *   · «EΜΒΑΔΟΝ ΓΕΩΤΕΜΑΧΙΟΥ» ξεκινά με **λατινικό E**
 *   · «κατά NΟΚ» έχει **λατινικό N**
 *   · η ενότητα Ζ γράφει «ΑΦΕΤΕΡΙΑΣ» — ορθογραφικό **του σχεδίου**
 *   · το «1.364,05» είναι σπασμένο σε **τρία** format runs (`1.364` + `,0` + `5`)
 *   · το «19040150900»+«1» (ΚΑΕΚ) σε δύο· το «0,8»+«+0,5 = 1,3» σε τρία
 *   · τα `Παρέκλιση` / `Σύστημα` / `ΟΡΟΦΟΙ` / `Ε. ΕΚΤΟΣ ΑΝΑΣΤΟΛΗΣ` είναι **κενά** — δεδομένο
 *
 * @see ADR-759 §2β — η μέτρηση ολόκληρου του αρχείου
 */

import { documentSourceFromCell } from '@/subapps/dxf-viewer/text-engine/document-body/scene-document-bodies';
import type { DocumentBodyReading, DocumentTextSource } from '@/types/document-body-reading';
import { readDocumentBodies } from '../../read-document-body';
import rows from './g753-texts.fixture.json';

/** Μία γραμμή του JSON — ό,τι κρατά ο DXF για ένα κείμενο. */
export interface G753TextRow {
  readonly type: string;
  /** Λαβή DXF (κωδ. 5) — η ΠΡΑΓΜΑΤΙΚΗ του αρχείου. */
  readonly handle: string;
  readonly layer: string;
  readonly x: number;
  readonly y: number;
  /** Ονομαστικό ύψος (κωδ. 40) — η **μονάδα** των απόλυτων `\H`. */
  readonly height: number;
  readonly raw: string;
}

export const G753_TEXT_ROWS: readonly G753TextRow[] = rows;

/**
 * Όλα τα κείμενα του σχεδίου, αποκωδικοποιημένα **από τον πραγματικό αποκωδικοποιητή**.
 *
 * ⚠️ Περνά από τον `mtextToSegments` του subapp επίτηδες: εκεί ζει το ξεγύμνωμα των κωδικών
 * MTEXT, δηλαδή ακριβώς το σημείο όπου το πραγματικό αρχείο σπάει τους αριθμούς σε κομμάτια.
 * Ένα fixture με «καθαρές» γραμμές θα απέδειχνε ότι δουλεύει ο αναγνώστης σε κείμενο **που
 * γράψαμε εμείς**.
 */
export function g753DocumentSources(): DocumentTextSource[] {
  return G753_TEXT_ROWS.map((row) =>
    documentSourceFromCell(
      { handle: row.handle, x: row.x, y: row.y, height: row.height, raw: row.raw },
      row.layer,
    ),
  );
}

/** Τα έγγραφα του σχεδίου, όπως τα βλέπει ο Λ1β. */
export function g753DocumentReadings(): DocumentBodyReading[] {
  return readDocumentBodies(g753DocumentSources());
}
