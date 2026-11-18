/**
 * ⚓ ADR-777 §8.102.1 — η ενεργειακή απάντηση **ακολουθεί** τη λειτουργική κατάσταση μέχρι να την πάρει ο άνθρωπος.
 *
 * Τρία συμβόλαια: (Α) παράγει μόνο ό,τι λέει ο νόμος για την κατάσταση · (Β) ποτέ πάνω σε απάντηση του ανθρώπου ή σε
 * κλάση ΠΕΑ · (Γ) χωρίς απώλειες — κάθε πήγαινε-έλα επιστρέφει ακριβώς την αρχική απάντηση, μαζί με την εκτίμηση ΜΕΑ.
 */

import { OPERATIONAL_STATUSES } from '@/constants/operational-statuses';

import { UNDECLARED_ENERGY_CERTIFICATE, readEnergyCertificate } from '../energy-certificate';
import { energyFollowingOperationalStatus, type EnergyLifecycleFollow } from '../energy-lifecycle-follow';

const PROJECTION = { class: 'A', scope: 'unit', sourceFileId: 'file_mea_1' } as const;
const UNDER_CONSTRUCTION = readEnergyCertificate({ absence: 'under-construction', projection: PROJECTION });
const CERTIFIED = readEnergyCertificate({ class: 'B' });

describe('Α — τι παράγεται', () => {
  it.each(['draft', 'under-construction'])('«%s» χωρίς απάντηση ⇒ «υπό κατασκευή», με λόγο not-completed', (status) => {
    const outcome = energyFollowingOperationalStatus(UNDECLARED_ENERGY_CERTIFICATE, status, null);
    expect(outcome.certificate.absence).toBe('under-construction');
    expect(outcome.follow).toEqual({ before: UNDECLARED_ENERGY_CERTIFICATE, reason: 'not-completed' });
  });

  it('«Έτοιμο» ενώ λέει «υπό κατασκευή» ⇒ «υπό έκδοση», και η εκτίμηση κρύβεται (κανόνας ορφανού)', () => {
    const outcome = energyFollowingOperationalStatus(UNDER_CONSTRUCTION, 'ready', null);
    expect(outcome.certificate.absence).toBe('pending');
    expect(outcome.certificate.projection).toBeNull();
    expect(outcome.follow).toEqual({ before: UNDER_CONSTRUCTION, reason: 'completed' });
  });

  it.each(['inspection', 'maintenance'])('«%s» ⇒ τίποτα: το κτήριο υπάρχει', (status) => {
    for (const current of [UNDECLARED_ENERGY_CERTIFICATE, UNDER_CONSTRUCTION]) {
      expect(energyFollowingOperationalStatus(current, status, null)).toEqual({ certificate: current, follow: null });
    }
  });

  it('άγνωστη κατάσταση ⇒ τίποτα', () => {
    expect(energyFollowingOperationalStatus(UNDECLARED_ENERGY_CERTIFICATE, 'nonsense', null).follow).toBeNull();
  });
});

describe('Β — ποτέ πάνω σε γεγονός', () => {
  it.each(OPERATIONAL_STATUSES)('κλάση ΠΕΑ + «%s» ⇒ αμετάβλητη', (status) => {
    expect(energyFollowingOperationalStatus(CERTIFIED, status, null)).toEqual({ certificate: CERTIFIED, follow: null });
  });

  it('«υπό έκδοση» / «εξαιρείται» του ανθρώπου + «υπό κατασκευή» ⇒ αμετάβλητα (μόνο η υπενθύμιση μιλά)', () => {
    for (const absence of ['pending', 'exempt'] as const) {
      const current = readEnergyCertificate({ absence });
      expect(energyFollowingOperationalStatus(current, 'under-construction', null).certificate).toEqual(current);
    }
  });
});

describe('Γ — χωρίς απώλειες', () => {
  it('Υπό κατασκευή → Έτοιμο → Υπό κατασκευή ⇒ ακριβώς η αρχική απάντηση, μαζί με την εκτίμηση της ΜΕΑ', () => {
    const toReady = energyFollowingOperationalStatus(UNDER_CONSTRUCTION, 'ready', null);
    const back = energyFollowingOperationalStatus(toReady.certificate, 'under-construction', toReady.follow);
    expect(back).toEqual({ certificate: UNDER_CONSTRUCTION, follow: null });
  });

  it('Ημιτελές → Έτοιμο (από κενό) ⇒ επιστρέφει στο κενό, όχι «υπό έκδοση» πάνω σε παραγόμενη τιμή', () => {
    const toDraft = energyFollowingOperationalStatus(UNDECLARED_ENERGY_CERTIFICATE, 'draft', null);
    const toReady = energyFollowingOperationalStatus(toDraft.certificate, 'ready', toDraft.follow);
    expect(toReady).toEqual({ certificate: UNDECLARED_ENERGY_CERTIFICATE, follow: null });
  });

  it('ξεκινά πάντα από το `before`, ποτέ από την παραγόμενη τιμή', () => {
    const follow: EnergyLifecycleFollow = { before: UNDECLARED_ENERGY_CERTIFICATE, reason: 'not-completed' };
    const derived = energyFollowingOperationalStatus(UNDECLARED_ENERGY_CERTIFICATE, 'draft', null).certificate;
    const again = energyFollowingOperationalStatus(derived, 'under-construction', follow);
    expect(again.follow?.before).toBe(UNDECLARED_ENERGY_CERTIFICATE);
  });
});
