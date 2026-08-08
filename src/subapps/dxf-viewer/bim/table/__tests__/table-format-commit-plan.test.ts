/**
 * 🔴 ADR-739 §63 — άγκυρες για την **απόφαση** «γράφεται αυτό το προσχέδιο;».
 *
 * ## Γιατί η μηχανή δοκιμάζεται ΧΩΡΙΣ σκηνή
 * Το πλάνο είναι καθαρή συνάρτηση επίτηδες (πρότυπο ADR-769): οι τρεις καταστάσεις που έκλεισαν
 * είναι **δομικές**, όχι οπτικές, και ένα test που θα έστηνε καμβά + όροφο + οντότητα για να τις
 * ρωτήσει θα δοκίμαζε τη σκηνή, όχι το κριτήριο. Η **καλωδίωση** ελέγχεται χωριστά, στο
 * `table-format-cells-dialog.test.tsx` (ο διάλογος) και στο `table-border-dialog.test.tsx` (ο
 * πλήρης βρόχος υποδοχή → store → ξενιστής → θύρα).
 *
 * ⚠️ Τα μοντέλα εδώ είναι **σκιώδη** (`{ tag } as unknown as PersistedTableModel`) και αυτό δεν
 * είναι ευκολία: το κριτήριο είναι σύγκριση **ταυτότητας** (`===`), άρα ένα «ρεαλιστικό» μοντέλο
 * θα πρόσθετε δεκάδες γραμμές στήσιμο χωρίς να αλλάξει τίποτα στην απάντηση — και θα έκρυβε ότι
 * η μηχανή **δεν κοιτάζει ποτέ περιεχόμενο**.
 *
 * @see bim/table/table-format-commit-plan.ts
 */

import { planTableFormatCommit } from '../table-format-commit-plan';
import type { PersistedTableModel } from '../../../types/table';

/** Μοντέλο με αναγνωρίσιμη ταυτότητα — η σύγκριση είναι by-reference, δες την κεφαλίδα. */
const model = (tag: string): PersistedTableModel =>
  ({ tag } as unknown as PersistedTableModel);

describe('§63 Κ1 — ο στόχος: υπάρχει ακόμη ο πίνακας που ρωτήθηκε;', () => {
  it('🔴 ο πίνακας ΕΦΥΓΕ ⇒ άρνηση με λόγο, ποτέ σιωπηλό no-op', () => {
    const base = model('base');
    expect(planTableFormatCommit({
      liveModel: null,
      baseModel: base,
      draftModel: model('draft'),
    })).toEqual({ status: 'refused', reason: 'target-missing' });
  });

  it('🔴 η απουσία στόχου κρίνεται ΠΡΙΝ από τα υπόλοιπα — ακόμη κι όταν το προσχέδιο είναι ίδιο', () => {
    // Αλλιώς η ίδια κατάσταση θα απαντούσε `unchanged`, δηλαδή «όλα καλά, δεν είχε τι να γράψει»
    // για πίνακα που **δεν υπάρχει**. Η σειρά των φρουρών είναι το συμβόλαιο.
    const base = model('base');
    expect(planTableFormatCommit({
      liveModel: null,
      baseModel: base,
      draftModel: base,
    })).toEqual({ status: 'refused', reason: 'target-missing' });
  });
});

describe('§63 Κ2 — η βάση: compare-and-swap', () => {
  it('🔴 ο πίνακας ΑΛΛΑΞΕ από το άνοιγμα ⇒ άρνηση· το προσχέδιο θα έσβηνε ό,τι μεσολάβησε', () => {
    expect(planTableFormatCommit({
      liveModel: model('γράφτηκε-στο-μεταξύ'),
      baseModel: model('όπως-άνοιξε'),
      draftModel: model('draft'),
    })).toEqual({ status: 'refused', reason: 'target-changed' });
  });

  it('🔴 Η ΜΠΑΓΙΑΤΙΚΗ ΒΑΣΗ ΝΙΚΑΕΙ ΤΟ «ΤΙΠΟΤΑ ΔΕΝ ΑΛΛΑΞΕ» — και αυτό είναι ΟΛΟΚΛΗΡΗ η σειρά', () => {
    // Το προσχέδιο είναι **ταυτόσημο** με ό,τι διάβασε ο διάλογος και **εντελώς άσχετο** με ό,τι
    // ισχύει τώρα. Με ανάποδη σειρά φρουρών η απάντηση θα ήταν `unchanged` — «ησυχία» που είναι
    // σύμπτωση (ADR-769 §4). Αν αυτή η άγκυρα γίνει κόκκινη, κάποιος αντέστρεψε τους δύο ελέγχους.
    const base = model('όπως-άνοιξε');
    expect(planTableFormatCommit({
      liveModel: model('γράφτηκε-στο-μεταξύ'),
      baseModel: base,
      draftModel: base,
    })).toEqual({ status: 'refused', reason: 'target-changed' });
  });

  it('η ταυτότητα κρίνει, ΠΟΤΕ το περιεχόμενο — δύο ίσα αντικείμενα δεν είναι το ίδιο μοντέλο', () => {
    // Ίδιο σχήμα, άλλη αναφορά: για την ουρά εντολών (`buildTableModelCommand`) είναι
    // **διαφορετικά** μοντέλα, άρα μια σύγκριση βάθους εδώ θα έλεγε «ίδια» για κάτι που το commit
    // θεωρεί αλλαγμένο — δεύτερη άποψη για την ισότητα μοντέλων.
    expect(planTableFormatCommit({
      liveModel: model('ίδιο'),
      baseModel: model('ίδιο'),
      draftModel: model('draft'),
    })).toEqual({ status: 'refused', reason: 'target-changed' });
  });
});

describe('§63 Κ3 — η αλλαγή', () => {
  it('«άνοιξα, πείραξα, το ξαναέφερα όπως ήταν, ΟΚ» ⇒ unchanged, κανένα βήμα αναίρεσης (§60)', () => {
    const base = model('base');
    expect(planTableFormatCommit({
      liveModel: base,
      baseModel: base,
      draftModel: base,
    })).toEqual({ status: 'unchanged' });
  });

  it('✅ ο κόσμος είναι όπως τον άφησε ο διάλογος ⇒ accepted, με ΤΟ μοντέλο μέσα στο πλάνο', () => {
    const base = model('base');
    const draft = model('draft');
    // Το πλάνο κουβαλά το μοντέλο ώστε ο εκτελεστής να γράφει **αυτούσιο** ό,τι εγκρίθηκε, αντί
    // να ξανασυνθέτει την απάντηση από τα ορίσματα (πρότυπο `fromPlan`).
    expect(planTableFormatCommit({
      liveModel: base,
      baseModel: base,
      draftModel: draft,
    })).toEqual({ status: 'accepted', model: draft });
  });
});
