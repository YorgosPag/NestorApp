/**
 * =============================================================================
 * ΑΓΚΥΡΕΣ ΤΟΥ ΣΥΝΟΡΟΥ ΑΝΑΓΝΩΣΗΣ ΤΟΥ ΔΟΧΕΙΟΥ (ADR-862 Φ0 · άγκυρα Α17)
 * =============================================================================
 *
 * ⚠️ **Η ΒΑΘΜΟΝΟΜΗΣΗ ΕΙΝΑΙ ΤΟ ΚΕΝΤΡΟ** *(δόγμα `authority.test.ts`)*. Οι είσοδοι
 * **δεν είναι επινοημένες** — είναι τα σχήματα που **μετρήθηκαν στη ζωντανή βάση
 * στις 2026-09-16**, πριν γραφτεί γραμμή θεματοφύλακα:
 *
 * | μέτρηση | τιμή | τι σημαίνει εδώ |
 * |---|---|---|
 * | σύνολο `files` | **35** | ο παρονομαστής |
 * | `cdeState` = WIP · SHARED · PUBLISHED | **0 · 0 · 0** | καμία κατάσταση δεν είναι «ζωντανή» ακόμη |
 * | `cdeState` = SUPERSEDED | **2** | 🔴 και **χωρίς** πράξη απόσυρσης — τα έγραψε ο `supersedeFileRecord` **πριν** τη Φ0 |
 * | `iso19650Source.filledBy` = ai·user·derived·skipped | **0 · 0 · 0 · 0** | ο AI δεν έγραψε **ποτέ** |
 *
 * 🔴 **ΓΙΑΤΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΥΠΑΡΧΕΙ**: αν ο θεματοφύλακας απαιτούσε πράξη
 * απόσυρσης για κάθε `SUPERSEDED`, τα **δύο υπαρκτά** έγγραφα θα γίνονταν
 * `unreadable` — δηλαδή **αόρατα σε παραγωγή**. Η ομάδα `Μ` το καρφώνει.
 *
 * @see lib/files/file-record-read — ο θεματοφύλακας
 * @see ADR-787 Κ-4 · ADR-862 §5.4.1.γ
 */

import { describe, it, expect } from '@jest/globals';

import {
  containerFactsOf,
  deriveSuitability,
  readContainerActs,
  readContainerState,
  readFileRecord,
} from '../file-record-read';

// =============================================================================
// ΤΟ ΕΛΑΧΙΣΤΟ ΕΓΚΥΡΟ ΕΓΓΡΑΦΟ — ό,τι απαιτεί ο φρουρός σχήματος `isFileRecord`
// =============================================================================

const BASE_DOC: Record<string, unknown> = {
  id: 'file_anchor',
  entityType: 'project',
  entityId: 'proj_1',
  domain: 'construction',
  category: 'floorplans',
  storagePath: 'companies/c1/files/file_anchor.pdf',
  displayName: 'Κάτοψη Ισογείου',
  originalFilename: 'katopsi.pdf',
  ext: 'pdf',
  contentType: 'application/pdf',
  status: 'ready',
  createdBy: 'uid_author',
  companyId: 'comp_1',
  revision: 3,
};

const act = (by: string, revision: number, extra: Record<string, unknown> = {}) => ({
  by,
  at: '2026-09-16T10:00:00.000Z',
  revision,
  ...extra,
});

// =============================================================================
// Α — Η ΑΠΟΥΣΙΑ ΕΙΝΑΙ ΟΝΟΜΑΣΜΕΝΗ ΚΑΤΑΣΤΑΣΗ, ΟΧΙ ΠΡΟΕΠΙΛΟΓΗ
// =============================================================================

describe('Α — η απουσία κατάστασης', () => {
  it('Α1: έγγραφο χωρίς cdeState και χωρίς πράξεις ⇒ pre-cde (τα 35 της παραγωγής)', () => {
    expect(readContainerState(BASE_DOC)).toEqual({ phase: 'pre-cde' });
  });

  it('Α2: το pre-cde ΔΕΝ διαβάζεται ως WIP (θα έκρυβε ό,τι φαίνεται σήμερα)', () => {
    expect(readContainerState(BASE_DOC).phase).not.toBe('WIP');
  });

  it('Α3: το pre-cde ΔΕΝ διαβάζεται ως PUBLISHED (θα το έδινε σε συνεργείο/πελάτη)', () => {
    expect(readContainerState(BASE_DOC).phase).not.toBe('PUBLISHED');
  });

  it('Α4: πράξη ΧΩΡΙΣ δηλωμένη κατάσταση ⇒ unreadable (μισοτελειωμένη γραφή)', () => {
    const state = readContainerState({ ...BASE_DOC, cdeSeal: act('uid_author', 3) });
    expect(state).toEqual({ phase: 'unreadable', why: 'act-without-declared-state' });
  });
});

// =============================================================================
// Β — FAIL-CLOSED: Ο,ΤΙ ΔΕΝ ΚΑΤΑΛΑΒΑΙΝΟΥΜΕ ΔΕΝ ΜΑΝΤΕΥΕΤΑΙ
// =============================================================================

describe('Β — κατάσταση εκτός λεξιλογίου', () => {
  it('Β1: τιμή εκτός των τεσσάρων ⇒ unreadable', () => {
    expect(readContainerState({ ...BASE_DOC, cdeState: 'APPROVED' })).toEqual({
      phase: 'unreadable',
      why: 'state-outside-vocabulary',
    });
  });

  it('Β2: μη-συμβολοσειρά ⇒ unreadable, ΠΟΤΕ «απουσία»', () => {
    expect(readContainerState({ ...BASE_DOC, cdeState: 42 }).phase).toBe('unreadable');
  });
});

// =============================================================================
// Γ — ΤΑ ΔΥΟ ΣΚΑΛΟΠΑΤΙΑ (Ε-12) · Η ΑΓΚΥΡΑ Α17
// =============================================================================

describe('Γ — το PUBLISHED απαιτεί ΔΥΟ πράξεις στην ΙΔΙΑ αναθεώρηση', () => {
  it('Γ1: χειρόγραφο PUBLISHED χωρίς καμία πράξη ⇒ unreadable (Α17ε: η δεύτερη αλήθεια δεν πληρώνει)', () => {
    expect(readContainerState({ ...BASE_DOC, cdeState: 'PUBLISHED' })).toEqual({
      phase: 'unreadable',
      why: 'published-without-seal',
    });
  });

  it('Γ2: απελευθέρωση ΧΩΡΙΣ σφραγίδα δημιουργού ⇒ unreadable (Α17γ)', () => {
    const state = readContainerState({
      ...BASE_DOC,
      cdeState: 'PUBLISHED',
      cdeRelease: act('uid_coordinator', 3),
    });
    expect(state).toEqual({ phase: 'unreadable', why: 'published-without-seal' });
  });

  it('Γ3: σφραγίδα ΧΩΡΙΣ απελευθέρωση συντονιστή ⇒ unreadable', () => {
    const state = readContainerState({
      ...BASE_DOC,
      cdeState: 'PUBLISHED',
      cdeSeal: act('uid_author', 3),
    });
    expect(state).toEqual({ phase: 'unreadable', why: 'published-without-release' });
  });

  it('Γ4: 🔴 σφραγίδα στην P01, το αρχείο στην P03 ⇒ unreadable (Α17α — η ύπουλη μετάλλαξη)', () => {
    const state = readContainerState({
      ...BASE_DOC,
      cdeState: 'PUBLISHED',
      cdeSeal: act('uid_author', 1),
      cdeRelease: act('uid_coordinator', 1),
    });
    expect(state).toEqual({ phase: 'unreadable', why: 'published-revision-moved' });
  });

  it('Γ5: και τα δύο σκαλοπάτια στην ΤΡΕΧΟΥΣΑ αναθεώρηση ⇒ PUBLISHED', () => {
    const state = readContainerState({
      ...BASE_DOC,
      cdeState: 'PUBLISHED',
      cdeTeamId: 'team_arch',
      cdeSeal: act('uid_author', 3),
      cdeRelease: act('uid_coordinator', 3),
    });
    expect(state).toEqual({ phase: 'PUBLISHED', teamId: 'team_arch', revision: 3 });
  });
});

// =============================================================================
// Δ — Η ΠΑΡΑΔΟΣΗ ΕΙΝΑΙ ΠΡΑΞΗ (ADR-787 Α5)
// =============================================================================

describe('Δ — το SHARED απαιτεί πράξη παράδοσης', () => {
  it('Δ1: χειρόγραφο SHARED χωρίς πράξη ⇒ unreadable', () => {
    expect(readContainerState({ ...BASE_DOC, cdeState: 'SHARED' })).toEqual({
      phase: 'unreadable',
      why: 'shared-without-share-act',
    });
  });

  it('Δ2: με πράξη παράδοσης ⇒ SHARED', () => {
    const state = readContainerState({
      ...BASE_DOC,
      cdeState: 'SHARED',
      cdeTeamId: 'team_struct',
      cdeShare: act('uid_author', 3),
    });
    expect(state).toEqual({ phase: 'SHARED', teamId: 'team_struct' });
  });
});

// =============================================================================
// Ε — ΤΟ WIP ΕΙΝΑΙ ΚΑΤΑΣΤΑΣΗ ΓΕΝΝΗΣΗΣ — ΔΕΝ ΤΟ ΠΑΡΑΓΕΙ ΠΡΑΞΗ
// =============================================================================

describe('Ε — WIP', () => {
  it('Ε1: WIP χωρίς πράξεις είναι έγκυρο (η γέννηση δεν είναι μετάβαση)', () => {
    const state = readContainerState({ ...BASE_DOC, cdeState: 'WIP', cdeTeamId: 'team_arch' });
    expect(state).toEqual({ phase: 'WIP', teamId: 'team_arch' });
  });

  it('Ε2: WIP χωρίς ομάδα διαβάζεται — το «ποιος το βλέπει» το κρίνει ο κριτής, όχι ο αναγνώστης', () => {
    expect(readContainerState({ ...BASE_DOC, cdeState: 'WIP' })).toEqual({
      phase: 'WIP',
      teamId: null,
    });
  });
});

// =============================================================================
// Μ — 🔴 Η ΜΕΤΡΗΜΕΝΗ ΜΕΤΑΝΑΣΤΕΥΣΗ: ΤΑ ΔΥΟ ΖΩΝΤΑΝΑ SUPERSEDED
// =============================================================================

describe('Μ — η απόσυρση πριν τη Φ0 (2 έγγραφα, μετρημένα 2026-09-16)', () => {
  it('Μ1: SUPERSEDED χωρίς πράξη ΑΛΛΑ με διάδοχο ⇒ έγκυρο — αλλιώς τα 2 υπαρκτά γίνονταν αόρατα', () => {
    const state = readContainerState({
      ...BASE_DOC,
      cdeState: 'SUPERSEDED',
      supersededByFileId: 'file_newer',
    });
    expect(state).toEqual({ phase: 'SUPERSEDED', teamId: null });
  });

  it('Μ2: SUPERSEDED με ρητή πράξη απόσυρσης ⇒ έγκυρο (η διαδρομή της Φ0)', () => {
    const state = readContainerState({
      ...BASE_DOC,
      cdeState: 'SUPERSEDED',
      cdeWithdrawal: act('uid_coordinator', 3, { reason: 'αντικαταστάθηκε από νεότερη' }),
    });
    expect(state).toEqual({ phase: 'SUPERSEDED', teamId: null });
  });

  it('Μ3: SUPERSEDED ΧΩΡΙΣ καμία απόδειξη ⇒ unreadable (ετικέτα χωρίς γεγονός)', () => {
    expect(readContainerState({ ...BASE_DOC, cdeState: 'SUPERSEDED' })).toEqual({
      phase: 'unreadable',
      why: 'superseded-without-evidence',
    });
  });
});

// =============================================================================
// Σ — Η ΚΑΤΑΛΛΗΛΟΤΗΤΑ ΠΑΡΑΓΕΤΑΙ, ΔΕΝ ΔΙΑΒΑΖΕΤΑΙ
// =============================================================================

describe('Σ — deriveSuitability', () => {
  it('Σ1: 🔴 αποθηκευμένο suitabilityCode ΑΓΝΟΕΙΤΑΙ — αλλιώς ο φρουρός παρακάμπτεται με μία λέξη σε ένα JSON', () => {
    const raw = { ...BASE_DOC, cdeState: 'WIP', suitabilityCode: 'IFC' };
    const state = readContainerState(raw);
    expect(deriveSuitability(state, readContainerActs(raw))).toBeNull();
  });

  it('Σ2: SHARED ⇒ IFR (fixed relationship του προτύπου)', () => {
    const raw = { ...BASE_DOC, cdeState: 'SHARED', cdeShare: act('uid_author', 3) };
    expect(deriveSuitability(readContainerState(raw), readContainerActs(raw))).toBe('IFR');
  });

  it('Σ3: PUBLISHED ⇒ IFC όταν ο δημιουργός δεν δήλωσε άλλη χρήση', () => {
    const raw = {
      ...BASE_DOC,
      cdeState: 'PUBLISHED',
      cdeSeal: act('uid_author', 3),
      cdeRelease: act('uid_coordinator', 3),
    };
    expect(deriveSuitability(readContainerState(raw), readContainerActs(raw))).toBe('IFC');
  });

  it('Σ4: PUBLISHED τιμά τη ΔΗΛΩΣΗ του δημιουργού μέσα στη σφραγίδα του', () => {
    const raw = {
      ...BASE_DOC,
      cdeState: 'PUBLISHED',
      cdeSeal: act('uid_author', 3, { suitabilityCode: 'ASB' }),
      cdeRelease: act('uid_coordinator', 3),
    };
    expect(deriveSuitability(readContainerState(raw), readContainerActs(raw))).toBe('ASB');
  });
});

// =============================================================================
// Θ — Ο ΦΡΟΥΡΟΣ ΤΟΥ ΣΥΝΟΡΟΥ
// =============================================================================

describe('Θ — readFileRecord', () => {
  it('Θ1: έγκυρο έγγραφο ⇒ record + κατάσταση', () => {
    const read = readFileRecord(BASE_DOC, 'file_anchor');
    expect(read.outcome).toBe('record');
    if (read.outcome !== 'record') throw new Error('unreachable');
    expect(read.state).toEqual({ phase: 'pre-cde' });
    expect(read.record.displayName).toBe('Κάτοψη Ισογείου');
  });

  it('Θ2: 🔒 κατάσταση που δεν διαβάζεται ΔΕΝ επιστρέφεται ως έγγραφο', () => {
    const read = readFileRecord({ ...BASE_DOC, cdeState: 'PUBLISHED' }, 'file_anchor');
    expect(read).toEqual({ outcome: 'unreadable', fileId: 'file_anchor', why: 'published-without-seal' });
  });

  it('Θ3: σκουπίδι ⇒ unreadable, ποτέ ρίψη', () => {
    expect(readFileRecord(null, 'file_x').outcome).toBe('unreadable');
    expect(readFileRecord('όχι αντικείμενο', 'file_x').outcome).toBe('unreadable');
  });

  it('Θ4: έγγραφο που αποτυγχάνει στον φρουρό σχήματος ⇒ unreadable', () => {
    const { createdBy: _omitted, ...withoutCreator } = BASE_DOC;
    expect(readFileRecord(withoutCreator, 'file_anchor')).toEqual({
      outcome: 'unreadable',
      fileId: 'file_anchor',
      why: 'shape-guard-rejected',
    });
  });

  it('Θ5: containerFactsOf — κενό companyId γίνεται null («το κενό δεν είναι tenant»)', () => {
    const read = readFileRecord({ ...BASE_DOC, companyId: '   ' }, 'file_anchor');
    if (read.outcome !== 'record') throw new Error('unreachable');
    expect(containerFactsOf(read.record, read.state).companyId).toBeNull();
  });
});
