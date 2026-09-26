/**
 * ADR-890 Φ0 — απόδοση διοικητικής περιοχής πάνω στα **πραγματικά** όρια του ADR-883.
 *
 * 🔑 Κανένα fixture: ο κριτής και ο αναγνώστης τρέχουν πάνω στα ίδια αρχεία που σερβίρονται
 * (`public/data/admin-boundaries/*`). Ένα συνθετικό όριο θα επιβεβαίωνε τη γεωμετρία, όχι ότι
 * τα **δεδομένα** έχουν το σχήμα που υποθέτει η κάθοδος (δήμοι χωρίς Δ.Ε., ρίζες εκτός ευρετηρίου).
 */

import { assignAdminArea } from '@/lib/geo/admin-area-of-point';
import { readAdminAreaLookup } from '../admin-boundaries.reader';

jest.setTimeout(30_000);

async function lookup() {
  const found = await readAdminAreaLookup();
  if (found === null) throw new Error('Το ευρετήριο περιοχών δεν διαβάστηκε');
  return found;
}

describe('assignAdminArea — πραγματικά όρια ADR-883', () => {
  it('Εύοσμος: Περιφέρεια → Π.Ε. → Δήμος Κορδελιού-Ευόσμου → Δ.Ε. → Κοινότητα', async () => {
    const area = await assignAdminArea({ lat: 40.6643, lng: 22.8976 }, 7, await lookup());
    expect(area).toMatchObject({
      regionId: 'region:112',
      regionalUnitId: 'regional_unit:07',
      municipalityId: 'municipality:0708',
    });
    expect(area?.municipalUnitId).toMatch(/^municipal_unit:0708\d{2}$/);
    expect(area?.communityId).toMatch(/^community:0708\d{4}$/);
    expect(area?.communityId?.slice('community:'.length, -2)).toBe(area?.municipalUnitId?.slice('municipal_unit:'.length));
  });

  // Μετρημένο 2026-09-26: 87 δήμοι χωρίς Δ.Ε.· από αυτούς 64 χωρίς ΚΑΝΕΝΑ παιδί με όριο
  // (ο δήμος είναι μία κοινότητα) και οι υπόλοιποι με κοινότητες κατευθείαν κάτω από τον δήμο.
  it('Σύνταγμα: ο Δήμος Αθηναίων δεν έχει παιδιά με όριο ⇒ ο δήμος είναι το βαθύτερο', async () => {
    const area = await assignAdminArea({ lat: 37.9755, lng: 23.7348 }, 7, await lookup());
    expect(area?.municipalityId).toBe('municipality:4501');
    expect(area?.municipalUnitId).toBeNull();
    expect(area?.communityId).toBeNull();
  });

  it('Λιμένας Θάσου: κοινότητα κατευθείαν κάτω από τον δήμο, χωρίς Δ.Ε.', async () => {
    const area = await assignAdminArea({ lat: 40.7745, lng: 24.7045 }, 7, await lookup());
    expect(area?.municipalityId).toBe('municipality:0401');
    expect(area?.municipalUnitId).toBeNull();
    expect(area?.communityId).toMatch(/^community:0401/);
  });

  it('το βάθος το ορίζει ο καλών: έως 5 ⇒ καμία Δ.Ε./κοινότητα', async () => {
    const area = await assignAdminArea({ lat: 40.6643, lng: 22.8976 }, 5, await lookup());
    expect(area?.municipalityId).toBe('municipality:0708');
    expect(area?.municipalUnitId).toBeNull();
    expect(area?.communityId).toBeNull();
  });

  it('ανοιχτή θάλασσα / εκτός Ελλάδας ⇒ null (ποτέ «κοντινότερος δήμος»)', async () => {
    await expect(assignAdminArea({ lat: 36.0, lng: 20.0 }, 7, await lookup())).resolves.toBeNull();
    await expect(assignAdminArea({ lat: 48.8566, lng: 2.3522 }, 7, await lookup())).resolves.toBeNull();
  });

  it('ντετερμινιστικό: ίδιο σημείο ⇒ ίδια απόδοση', async () => {
    const source = await lookup();
    const first = await assignAdminArea({ lat: 40.6401, lng: 22.9444 }, 7, source);
    const second = await assignAdminArea({ lat: 40.6401, lng: 22.9444 }, 7, source);
    expect(second).toEqual(first);
    expect(first?.municipalityId).not.toBeNull();
  });
});
