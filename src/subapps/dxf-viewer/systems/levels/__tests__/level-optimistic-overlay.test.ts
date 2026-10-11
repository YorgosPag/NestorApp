/**
 * ADR-914 §2.9 — το στρώμα πάνω στη λίστα της συνδρομής.
 *
 * Η ερώτηση: **βλέπει ο άνθρωπος αυτό που μόλις έκανε, πριν του το πει η συνδρομή — και φεύγει το
 * στρώμα μόλις του το πει;** Ένα στρώμα που δεν συμφιλιώνεται είναι δεύτερη πηγή αλήθειας.
 */

import type { Level } from '../config';
import {
  EMPTY_LEVEL_OVERLAY,
  applyLevelOverlay,
  isAwaitingEcho,
  settleLevelOverlay,
  withBornLevel,
  withLevelPatch,
  withoutLevel,
  withoutLevelPatch,
} from '../level-optimistic-overlay';

const level = (id: string, name: string, order: number, over: Partial<Level> = {}): Level => ({
  id, name, order, isDefault: false, visible: true, ...over,
});

const ground = level('lvl_ground', 'Ισόγειο', 0, { buildingId: 'bldg_A' });
const first = level('lvl_first', '1ος Όροφος', 1, { buildingId: 'bldg_A' });
const draft = level('lvl_draft', 'Πρόχειρο 1', 2);

describe('applyLevelOverlay — τι βλέπει ο viewer', () => {
  it('κενό στρώμα ⇒ η ΙΔΙΑ αναφορά: κανένα re-render από το τίποτα', () => {
    const base = [ground, first];
    expect(applyLevelOverlay(base, EMPTY_LEVEL_OVERLAY)).toBe(base);
  });

  it('🔑 το γεννημένο επίπεδο είναι στη λίστα ΠΡΙΝ το φέρει η συνδρομή', () => {
    const overlay = withBornLevel(EMPTY_LEVEL_OVERLAY, draft);
    expect(applyLevelOverlay([ground, first], overlay).map((l) => l.id)).toEqual([
      'lvl_ground', 'lvl_first', 'lvl_draft',
    ]);
  });

  it('το γεννημένο μπαίνει στη θέση της σειράς του, όχι πάντα στο τέλος', () => {
    const overlay = withBornLevel(EMPTY_LEVEL_OVERLAY, level('lvl_mid', 'Μεσοπάτωμα', 0.5));
    expect(applyLevelOverlay([ground, first], overlay).map((l) => l.id)).toEqual([
      'lvl_ground', 'lvl_mid', 'lvl_first',
    ]);
  });

  it('όταν το φέρει η συνδρομή ΔΕΝ διπλασιάζεται — η ηχώ κερδίζει', () => {
    const overlay = withBornLevel(EMPTY_LEVEL_OVERLAY, draft);
    const echoed = { ...draft, companyId: 'comp_1' };
    const view = applyLevelOverlay([ground, echoed], overlay);

    expect(view.filter((l) => l.id === 'lvl_draft')).toHaveLength(1);
    expect(view.find((l) => l.id === 'lvl_draft')).toBe(echoed);
  });

  it('η διόρθωση ονόματος φαίνεται αμέσως — και σε επίπεδο που περιμένει ακόμη την ηχώ του', () => {
    const overlay = withLevelPatch(withBornLevel(EMPTY_LEVEL_OVERLAY, draft), 'lvl_draft', { name: 'Μελέτη' });
    const patchedGround = withLevelPatch(overlay, 'lvl_ground', { name: 'Pilotis' });

    expect(applyLevelOverlay([ground], patchedGround).map((l) => l.name)).toEqual(['Pilotis', 'Μελέτη']);
    // Η βάση δεν μεταλλάσσεται.
    expect(ground.name).toBe('Ισόγειο');
  });
});

describe('settleLevelOverlay — το στρώμα δεν επιβιώνει της επιβεβαίωσής του', () => {
  it('το γεννημένο φεύγει μόλις αντηχήσει', () => {
    const overlay = withBornLevel(EMPTY_LEVEL_OVERLAY, draft);
    expect(settleLevelOverlay([ground], overlay)).toBe(overlay);
    expect(settleLevelOverlay([ground, draft], overlay).born).toEqual([]);
  });

  it('🔑 η διόρθωση μένει μέχρι η συνδρομή να πει ΤΟ ΙΔΙΟ — παλιότερη ηχώ δεν τη σβήνει', () => {
    const overlay = withLevelPatch(EMPTY_LEVEL_OVERLAY, 'lvl_ground', { name: 'Pilotis' });

    expect(settleLevelOverlay([ground], overlay)).toBe(overlay);
    expect(settleLevelOverlay([{ ...ground, name: 'Pilotis' }], overlay).patches).toEqual({});
  });

  it('η διόρθωση σε επίπεδο που περιμένει ηχώ μένει· μετά την ηχώ του παλιού ονόματος επίσης', () => {
    const overlay = withLevelPatch(withBornLevel(EMPTY_LEVEL_OVERLAY, draft), 'lvl_draft', { name: 'Μελέτη' });

    expect(settleLevelOverlay([ground], overlay)).toBe(overlay);
    const afterBirthEcho = settleLevelOverlay([ground, draft], overlay);
    expect(afterBirthEcho.born).toEqual([]);
    expect(afterBirthEcho.patches).toEqual({ lvl_draft: { name: 'Μελέτη' } });
    expect(applyLevelOverlay([ground, draft], afterBirthEcho)[1].name).toBe('Μελέτη');
  });

  it('διόρθωση για επίπεδο που δεν υπάρχει πια φεύγει — κανένα φάντασμα', () => {
    const overlay = withLevelPatch(EMPTY_LEVEL_OVERLAY, 'lvl_gone', { name: 'Χ' });
    expect(settleLevelOverlay([ground], overlay).patches).toEqual({});
  });
});

describe('αποτυχία και διαγραφή', () => {
  it('αποτυχημένη διόρθωση αποσύρεται — το παλιό όνομα ξαναφαίνεται', () => {
    const overlay = withLevelPatch(EMPTY_LEVEL_OVERLAY, 'lvl_ground', { name: 'Pilotis' });
    const reverted = withoutLevelPatch(overlay, 'lvl_ground', { name: 'Pilotis' });

    expect(applyLevelOverlay([ground], reverted)[0].name).toBe('Ισόγειο');
  });

  it('🔑 η αποτυχία της ΠΑΛΙΑΣ εγγραφής δεν αποσύρει νεότερη διόρθωση του ίδιου πεδίου', () => {
    const renamedTwice = withLevelPatch(
      withLevelPatch(EMPTY_LEVEL_OVERLAY, 'lvl_ground', { name: 'Pilotis' }),
      'lvl_ground',
      { name: 'Στάθμευση' },
    );
    const afterOldFailure = withoutLevelPatch(renamedTwice, 'lvl_ground', { name: 'Pilotis' });

    expect(applyLevelOverlay([ground], afterOldFailure)[0].name).toBe('Στάθμευση');
  });

  it('διαγραφή επιπέδου που περιμένει ηχώ το βγάζει από το στρώμα', () => {
    const overlay = withLevelPatch(withBornLevel(EMPTY_LEVEL_OVERLAY, draft), 'lvl_draft', { name: 'Μελέτη' });
    const forgotten = withoutLevel(overlay, 'lvl_draft');

    expect(forgotten).toEqual(EMPTY_LEVEL_OVERLAY);
    expect(withoutLevel(EMPTY_LEVEL_OVERLAY, 'lvl_x')).toBe(EMPTY_LEVEL_OVERLAY);
  });
});

describe('isAwaitingEcho', () => {
  it('αληθές μόνο όσο το γεννημένο δεν έχει αντηχήσει', () => {
    const overlay = withBornLevel(EMPTY_LEVEL_OVERLAY, draft);

    expect(isAwaitingEcho(overlay, 'lvl_draft')).toBe(true);
    expect(isAwaitingEcho(overlay, 'lvl_ground')).toBe(false);
    expect(isAwaitingEcho(settleLevelOverlay([draft], overlay), 'lvl_draft')).toBe(false);
  });

  it('το ίδιο επίπεδο δεν καταχωρείται δύο φορές', () => {
    const once = withBornLevel(EMPTY_LEVEL_OVERLAY, draft);
    expect(withBornLevel(once, draft)).toBe(once);
  });
});
