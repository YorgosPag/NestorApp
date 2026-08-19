/**
 * Άγκυρες — **ΠΟΤΕ ΑΞΙΖΕΙ ΝΑ ΤΟ ΠΟΥΜΕ** (ADR-777 Ε2 · SPEC-777B §12.6).
 *
 * Η πολιτική είναι **αντι-spam**, δηλαδή η αστοχία της είναι *«ο άνθρωπος έλαβε δέκα
 * email και έμαθε να τα αγνοεί»* — κάτι που **καμία** δοκιμή δεν θα δει αν ελέγχει
 * μόνο ότι «στάλθηκε ειδοποίηση». Άρα ελέγχεται το αντίθετο: **τι ΔΕΝ στέλνεται**.
 */

import {
  ANNOUNCEMENT_BANDS,
  announcementBand,
  announcementEventId,
} from '../demand-announcement';

describe('Ζ — οι ζώνες', () => {
  it('🔴 είναι γνησίως αύξουσες — η σειρά ΕΙΝΑΙ ο μηχανισμός', () => {
    const sorted = [...ANNOUNCEMENT_BANDS].sort((a, b) => a - b);
    expect([...ANNOUNCEMENT_BANDS]).toEqual(sorted);
    expect(new Set(ANNOUNCEMENT_BANDS).size).toBe(ANNOUNCEMENT_BANDS.length);
  });

  it('η πρώτη ζώνη είναι το 1 — «από τον 1ο», απόφαση Giorgio 2026-08-11', () => {
    expect(ANNOUNCEMENT_BANDS[0]).toBe(1);
  });

  it.each(ANNOUNCEMENT_BANDS)('κάθε ζώνη (%i) είναι προσεγγίσιμη από πραγματικό πλήθος', (band) => {
    expect(announcementBand(band)).toBe(band);
  });
});

describe('🔴 Σ — ΤΙ ΔΕΝ ΣΤΕΛΝΕΤΑΙ: η σιωπή είναι το χαρακτηριστικό', () => {
  it('κανένα άτομο ⇒ καμία είδηση', () => {
    expect(announcementBand(0)).toBeNull();
  });

  it('⚠️ λογοκριμένο πλήθος (`null`) ⇒ καμία είδηση — ΠΟΤΕ `count ?? 0`', () => {
    expect(announcementBand(null)).toBeNull();
  });

  it('🔑 το +1 ΔΕΝ είναι είδηση: 3→4→5→7 μένουν στην ΙΔΙΑ ζώνη', () => {
    const bands = [3, 4, 5, 6, 7].map(announcementBand);
    expect(new Set(bands).size).toBe(1);
    expect(bands[0]).toBe(3);
  });

  it('🔑 άρα και το ΚΛΕΙΔΙ είναι το ίδιο ⇒ το `create()` του orchestrator το κόβει', () => {
    const keys = [3, 4, 5, 6, 7].map((count) =>
      announcementEventId('ownp_1', announcementBand(count)!),
    );
    expect(new Set(keys).size).toBe(1);
  });

  it('⚠️ ο παρονομαστής: πέρασμα ΣΕ ΑΛΛΗ ζώνη αλλάζει το κλειδί — αλλιώς ο φρουρός θα ήταν σιωπητήριο', () => {
    expect(announcementEventId('ownp_1', announcementBand(3)!)).not.toBe(
      announcementEventId('ownp_1', announcementBand(8)!),
    );
  });

  it('δύο ακίνητα του ίδιου ανθρώπου ΔΕΝ μοιράζονται κλειδί', () => {
    expect(announcementEventId('ownp_1', 3)).not.toBe(announcementEventId('ownp_2', 3));
  });
});
