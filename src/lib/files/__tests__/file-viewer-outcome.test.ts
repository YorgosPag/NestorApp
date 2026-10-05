/**
 * 🔗 Η ΑΓΚΥΡΑ ΤΩΝ ΕΚΒΑΣΕΩΝ ΤΟΥ ΘΕΑΤΗ (ADR-899 §9 θέμα 10, 2026-10-05).
 *
 * Η διεύθυνση `/files?file=<id>` μπορεί να ζητήσει οποιαδήποτε ταυτότητα. Μεταλλάξεις που πρέπει να πιάσει:
 * - Ε1: χάνεται ο έλεγχος κατόχου ⇒ εγγραφή ξένου χώρου (που ρόλος ευρείας ανάγνωσης ΔΙΑΒΑΖΕΙ) δείχνεται.
 * - Ε2: αρχείο του Κάδου δείχνεται, ή ξένο αρχείο του Κάδου αποκαλύπτει «υπάρχει, στον κάδο».
 * - Ε3: το φίλτρο «εξαφανίζει» το αρχείο αντί να το δείξει με ένδειξη.
 * - Ε4: κάθε εκκρεμές αρχείο περνά για εισερχόμενο (ανέβασμα σε εξέλιξη χωρίς bytes).
 * - Ε5: το «ψάχνουμε» ανακοινώνεται ως «δεν βρέθηκε».
 */

import type { EntitySelection } from '@/hooks/entity-selection-state';

import { fileShownBy, fileViewerOutcomeOf, type FileViewerSubject } from '../file-viewer-outcome';

const MINE = 'comp_mine';
const ready = (over: Partial<FileViewerSubject> = {}): FileViewerSubject => ({
  id: 'file_1', companyId: MINE, status: 'ready', domain: 'construction', lifecycleState: 'active', isDeleted: false, ...over,
});
const selected = (item: FileViewerSubject): EntitySelection<FileViewerSubject> => ({ kind: 'selected', item });
const context = (visible: readonly string[] = ['file_1']) => ({ companyId: MINE, visibleIds: new Set(visible) });

describe('fileViewerOutcomeOf', () => {
  test('ενεργό αρχείο του χώρου, ορατό στη λίστα ⇒ shown χωρίς ένδειξη', () => {
    const file = ready();
    expect(fileViewerOutcomeOf(selected(file), context())).toEqual({ kind: 'shown', file, hiddenByFilters: false });
  });

  test('🔴 Ε3 το κρύβουν τα φίλτρα ⇒ ΔΕΙΧΝΕΤΑΙ, με ένδειξη', () => {
    const outcome = fileViewerOutcomeOf(selected(ready()), context([]));
    expect(outcome).toMatchObject({ kind: 'shown', hiddenByFilters: true });
    expect(fileShownBy(outcome)).not.toBeNull();
  });

  test('🔴 Ε1 εγγραφή άλλου χώρου ⇒ not-found, ό,τι κι αν επέτρεψε η ανάγνωση', () => {
    expect(fileViewerOutcomeOf(selected(ready({ companyId: 'comp_other' })), context())).toEqual({ kind: 'not-found' });
  });

  test('🔴 Ε1 προσωπικό αρχείο · χωρίς κάτοχο · κενός χώρος σελίδας ⇒ not-found (το κενό δεν ταιριάζει ποτέ)', () => {
    expect(fileViewerOutcomeOf(selected(ready({ companyId: undefined, userId: 'u1' })), context()).kind).toBe('not-found');
    expect(fileViewerOutcomeOf(selected(ready({ companyId: undefined })), context()).kind).toBe('not-found');
    expect(fileViewerOutcomeOf(selected(ready({ companyId: '' })), { companyId: '', visibleIds: new Set() }).kind).toBe('not-found');
  });

  test('🔴 Ε2 Κάδος — από τη λίστα του κάδου ή από τη μορφή της εγγραφής ⇒ trashed, ΚΑΜΙΑ προβολή', () => {
    const fromList = fileViewerOutcomeOf({ kind: 'archived', item: ready() }, context());
    const byFlag = fileViewerOutcomeOf(selected(ready({ isDeleted: true })), context());
    const byState = fileViewerOutcomeOf(selected(ready({ lifecycleState: 'trashed' })), context());
    for (const outcome of [fromList, byFlag, byState]) {
      expect(outcome).toEqual({ kind: 'trashed' });
      expect(fileShownBy(outcome)).toBeNull();
    }
  });

  test('🔴 Ε2 ξένο αρχείο του Κάδου ⇒ not-found, όχι «υπάρχει, στον κάδο»', () => {
    expect(fileViewerOutcomeOf({ kind: 'archived', item: ready({ companyId: 'comp_other' }) }, context())).toEqual({ kind: 'not-found' });
    expect(fileViewerOutcomeOf(selected(ready({ companyId: 'comp_other', isDeleted: true })), context())).toEqual({ kind: 'not-found' });
  });

  test('αρχειοθετημένο ⇒ archived · εκκαθαρισμένο ⇒ not-found', () => {
    expect(fileViewerOutcomeOf(selected(ready({ lifecycleState: 'archived' })), context())).toEqual({ kind: 'archived' });
    expect(fileViewerOutcomeOf(selected(ready({ lifecycleState: 'purged' })), context())).toEqual({ kind: 'not-found' });
  });

  test('🔴 Ε4 εκκρεμές ΕΙΣΕΡΧΟΜΕΝΟ ⇒ inbox (δείχνεται) · άλλο εκκρεμές ή αποτυχημένο ⇒ not-found', () => {
    const inbox = ready({ status: 'pending', domain: 'ingestion' });
    const outcome = fileViewerOutcomeOf(selected(inbox), context([]));
    expect(outcome).toEqual({ kind: 'inbox', file: inbox });
    expect(fileShownBy(outcome)).toBe(inbox);
    expect(fileViewerOutcomeOf(selected(ready({ status: 'pending' })), context()).kind).toBe('not-found');
    expect(fileViewerOutcomeOf(selected(ready({ status: 'failed', domain: 'ingestion' })), context()).kind).toBe('not-found');
  });

  test('🔴 Ε5 none · resolving · not-found περνούν αυτούσια — το «ψάχνουμε» δεν γίνεται ποτέ «δεν βρέθηκε»', () => {
    expect(fileViewerOutcomeOf({ kind: 'none' }, context())).toEqual({ kind: 'none' });
    expect(fileViewerOutcomeOf({ kind: 'resolving', requestedId: 'x' }, context())).toEqual({ kind: 'resolving' });
    expect(fileViewerOutcomeOf({ kind: 'not-found', requestedId: 'x' }, context())).toEqual({ kind: 'not-found' });
  });
});
