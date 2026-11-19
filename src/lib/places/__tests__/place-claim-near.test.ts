/**
 * @fileoverview 🏆 **Το `near` της χειρονομίας `picked-osm-building`** — ταξιδεύει, αλλά δεν γίνεται ισχυρισμός (ADR-777 §8.104).
 *
 * | Άγκυρα | Μετάλλαξη που πιάνει |
 * |---|---|
 * | Ν1 με `near` ⇒ το αίτημα το κρατά | το zod το πετά σιωπηλά (ο διακομιστής ξαναπέφτει πάντα στον Overpass) |
 * | Ν2 χωρίς `near` (παλιός πελάτης) ⇒ δεκτό | υποχρεωτικό `near` σπάει κάθε ανοιχτή καρτέλα |
 * | Ν3 κακό `near` ⇒ μονοπάτι `claim.near.*` | σύμπτυξη σε «body» |
 * | Ν4 η προέλευση μένει `osm` — το `near` δεν την αλλάζει | προέλευση από πεδίο του πελάτη |
 */
import { placeResolveRequestFrom, provenanceOfClaim } from '../place-claim';

const CLAIM = { gesture: 'picked-osm-building', elementType: 'way', elementId: '980875811' } as const;

describe('picked-osm-building · near', () => {
  it('🔴 Ν1 — το `near` περνά το σύνορο', () => {
    const parsed = placeResolveRequestFrom({ claim: { ...CLAIM, near: { lat: 40.5609, lng: 23.0213 } }, target: 'building' });
    expect(parsed).toEqual({
      ok: true,
      request: { claim: { ...CLAIM, near: { lat: 40.5609, lng: 23.0213 } }, target: 'building' },
    });
  });

  it('🔑 Ν2 — χωρίς `near` μένει δεκτό', () => {
    expect(placeResolveRequestFrom({ claim: CLAIM, target: 'building' }).ok).toBe(true);
  });

  it('🔴 Ν3 — `near` που δεν είναι σημείο ⇒ ονομασμένο μονοπάτι', () => {
    const parsed = placeResolveRequestFrom({ claim: { ...CLAIM, near: { lat: 'x', lng: 23 } }, target: 'building' });
    expect(parsed).toEqual({ ok: false, malformed: ['claim.near.lat'] });
  });

  it('🔴 Ν4 — η προέλευση συνάγεται από τη χειρονομία, όχι από το `near`', () => {
    expect(provenanceOfClaim({ ...CLAIM, near: { lat: 0, lng: 0 } })).toBe('osm');
  });
});
