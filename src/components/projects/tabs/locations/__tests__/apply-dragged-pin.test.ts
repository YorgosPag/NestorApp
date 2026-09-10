/**
 * Άγκυρες του `applyDraggedPin` — του ΕΝΟΣ σημείου όπου ο πελάτης **δηλώνει** το σύρσιμο
 * (2026-09-10, ADR-332 D27).
 *
 * 🔴 Χωρίς τη δήλωση `source: 'dragged'`, ο διακομιστής αναγνώριζε ανθρώπινη πινέζα ΜΟΝΟ αν
 * το κείμενο έμενε ίδιο — και το σύρσιμο ξαναγράφει το κείμενο. Οι άγκυρες του διακομιστή
 * (Κ1γ-ε στο `address-position.test.ts`) αποδεικνύουν ότι η δήλωση **τιμάται**· αυτές εδώ ότι
 * **στέλνεται**.
 */

import type { ProjectAddress } from '@/types/project/addresses';
import { applyDraggedPin } from '../location-converters';

const DOOR = { lat: 40.6651, lng: 22.8989 };

const DECLARED: ProjectAddress = {
  id: 'addr_1',
  street: 'Σαμοθράκης',
  number: '16',
  city: 'Ελευθέριο-Κορδελιό',
  postalCode: '56334',
  country: 'Greece',
  municipality: 'Δήμος Κορδελιού - Ευόσμου',
  type: 'site',
  isPrimary: true,
  coordinates: { lat: 40.6643, lng: 22.8976 },
  source: 'geocoded',
};

/** Ό,τι φέρνει η αντίστροφη γεωκωδικοποίηση για την πόρτα: δρόμος, **χωρίς** αριθμό. */
const REVERSE = { street: 'Σαμοθράκης', city: 'Ελευθέριο-Κορδελιό', postalCode: '56334', coordinates: DOOR };

describe('applyDraggedPin — η δήλωση του συρσίματος', () => {
  it.each(['adopt-address', 'position-only'] as const)('%s ⇒ ΠΑΝΤΑ `source: dragged` + το νέο σημείο', (mode) => {
    const out = applyDraggedPin(DECLARED, REVERSE, mode);
    expect(out.source).toBe('dragged');
    expect(out.coordinates).toEqual(DOOR);
  });

  it('position-only ⇒ το κείμενο που δήλωσε ο άνθρωπος ΜΕΝΕΙ (ο αριθμός 16 δεν θυσιάζεται)', () => {
    const out = applyDraggedPin(DECLARED, REVERSE, 'position-only');
    expect(out.number).toBe('16');
    expect(out.municipality).toBe('Δήμος Κορδελιού - Ευόσμου');
  });

  it('ΠΑΡΟΝΟΜΑΣΤΗΣ: adopt-address ⇒ ο αριθμός ΣΒΗΝΕΤΑΙ (γι\' αυτό ο διάλογος πρέπει να το λέει)', () => {
    const out = applyDraggedPin(DECLARED, REVERSE, 'adopt-address');
    expect(out.number).toBeUndefined();
    expect(out.municipality).toBeUndefined();
    expect(out.street).toBe('Σαμοθράκης');
  });

  it('σύρσιμο χωρίς συντεταγμένες ⇒ το σημείο ΔΕΝ χάνεται', () => {
    const out = applyDraggedPin(DECLARED, { street: 'Σαμοθράκης' }, 'position-only');
    expect(out.coordinates).toEqual(DECLARED.coordinates);
  });
});
