/**
 * Άγκυρες για την **κρίση** που στέκεται ανάμεσα στη βάση και στον κόσμο
 * (ADR-842 Φ3 · `public-listing-attributes.ts`).
 *
 * 🔴 **ΤΟ ΕΡΩΤΗΜΑ ΔΕΝ ΕΙΝΑΙ «ΑΝΤΙΓΡΑΦΗΚΕ ΤΟ ΠΕΔΙΟ;» — ΕΙΝΑΙ «ΕΙΝΑΙ ΟΝΟΜΑΣΙΜΟ;».**
 * Το `ProjectableProperty` διαβάζει **ωμό έγγραφο Firestore**: μια τιμή `'Καλή'`
 * γραμμένη από παλιά φόρμα θα ταξίδευε αυτούσια σε κλειστό σχήμα, η οθόνη θα ζητούσε
 * `properties-enums:condition.Καλή`, και θα ζωγράφιζε **ωμό κλειδί στον ανώνυμο
 * επισκέπτη** — η οικογένεια σφάλματος που το repo έχει πληρώσει τέσσερις φορές
 * (CHECK 3.34 · 3.36 · 3.51).
 */

import { projectListingAttributes } from '../public-listing-attributes';
import type { ProjectableProperty } from '../public-listing-projection-types';

const BASE: ProjectableProperty = { id: 'prop_a0000001' };

function project(over: Partial<ProjectableProperty> = {}) {
  return projectListingAttributes({ ...BASE, ...over } as ProjectableProperty);
}

// ============================================================================
// Χ1 — ΤΙΠΟΤΑ ΔΕΝ ΕΦΕΥΡΙΣΚΕΤΑΙ: ΑΠΟΝ ΠΕΔΙΟ ⇒ `null`
// ============================================================================

describe('Χ1 — ακίνητο χωρίς χαρακτηριστικά δεν αποκτά χαρακτηριστικά', () => {
  it('κάθε πεδίο είναι `null` — ποτέ `0`, ποτέ `[]`, ποτέ `undefined`', () => {
    const attributes = project();
    for (const [key, value] of Object.entries(attributes)) {
      expect([key, value]).toEqual([key, null]);
    }
  });

  it('🔴 τα ΣΥΝΟΛΑ είναι `null` και ΟΧΙ `[]` — αλλιώς θα λέγαμε ψέματα για τον κάτοχο', () => {
    // `[]` σημαίνει «ο κάτοχος απάντησε: καμία». Παραγόμενο από απουσία, θα ήταν
    // ισχυρισμός για λογαριασμό ανθρώπου που δεν ρωτήθηκε ποτέ.
    expect(project().amenities).toBeNull();
    expect(project().flooring).toBeNull();
  });
});

// ============================================================================
// Χ2 — 🔴 Η ΚΡΙΣΗ ΤΟΥ ΛΕΞΙΛΟΓΙΟΥ
// ============================================================================

describe('Χ2 — μόνο ονομάσιμες τιμές φεύγουν δημόσια', () => {
  it('τιμή του λεξιλογίου ⇒ ταξιδεύει', () => {
    expect(project({ condition: 'good' }).condition).toBe('good');
    expect(project({ energy: { class: 'A+' } }).energyClass).toBe('A+');
    expect(project({ systemsOverride: { heatingType: 'autonomous' } }).heatingType).toBe(
      'autonomous'
    );
  });

  it('τιμή ΕΚΤΟΣ λεξιλογίου ⇒ `null`, όχι ωμό κλειδί στην οθόνη', () => {
    expect(project({ condition: 'Καλή' }).condition).toBeNull();
    expect(project({ energy: { class: 'A++++' } }).energyClass).toBeNull();
    expect(project({ systemsOverride: { heatingType: 'ξυλόσομπα' } }).heatingType).toBeNull();
  });

  it('μη συμβολοσειρά ⇒ `null`', () => {
    expect(project({ condition: 42 }).condition).toBeNull();
    expect(project({ condition: { class: 'good' } }).condition).toBeNull();
  });
});

// ============================================================================
// Χ3 — ΤΑ ΣΥΝΟΛΑ ΚΡΑΤΟΥΝ ΤΙΣ ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ
// ============================================================================

describe('Χ3 — τα σύνολα, και η τέταρτη είσοδος που είναι η ενδιαφέρουσα', () => {
  it('πίνακας με γνωστές τιμές ⇒ ταξιδεύει', () => {
    expect(project({ propertyAmenities: ['pool', 'gym'] }).amenities).toEqual(['pool', 'gym']);
  });

  it('ΚΕΝΟΣ πίνακας ⇒ `[]` — η απάντηση «καμία» διατηρείται', () => {
    expect(project({ propertyAmenities: [] }).amenities).toEqual([]);
  });

  it('μερική αναγνώριση ⇒ κρατά ό,τι σώθηκε', () => {
    expect(project({ finishes: { flooring: ['tiles', 'ξύλο'] } }).flooring).toEqual(['tiles']);
  });

  it('🔴 μη κενός πίνακας με ΚΑΜΙΑ γνωστή τιμή ⇒ `null`, ΠΟΤΕ `[]`', () => {
    // Το `[]` θα σήμαινε «ο κάτοχος είπε καμία» — ισχυρισμός για λογαριασμό του, και
    // **ψευδής**: ξέρουμε ότι δήλωσε κάτι, απλώς δεν μπορούμε να το ονομάσουμε.
    expect(project({ propertyAmenities: ['πισίνα'] }).amenities).toBeNull();
  });

  it('μη πίνακας ⇒ `null`', () => {
    expect(project({ propertyAmenities: 'pool' }).amenities).toBeNull();
  });
});

// ============================================================================
// Χ4 — ΤΟ `0` ΤΑΞΙΔΕΥΕΙ
// ============================================================================

describe('Χ4 — `0` είναι απάντηση, όχι κενό', () => {
  it('`wc: 0` και `balconies: 0` φτάνουν στην προβολή', () => {
    const attributes = project({ layout: { wc: 0, balconies: 0 } });
    expect(attributes.wc).toBe(0);
    expect(attributes.balconies).toBe(0);
  });

  it('`gardenAreaSqm: 0` — ακίνητο χωρίς κήπο που το ΕΙΠΕ', () => {
    expect(project({ areas: { gross: 90, garden: 0 } }).gardenAreaSqm).toBe(0);
  });

  it('`NaN` ⇒ `null` — δεν είναι αριθμός που μπορεί να ειπωθεί', () => {
    expect(project({ layout: { wc: Number.NaN } }).wc).toBeNull();
  });
});

// ============================================================================
// Χ5 — ⛔ ΚΑΝΕΝΑ ΕΓΓΡΑΦΟ, ΚΑΜΙΑ ΤΑΥΤΟΤΗΤΑ ΜΗΤΡΩΟΥ
// ============================================================================

describe('Χ5 — από την ενέργεια φεύγει η ΚΛΑΣΗ, ποτέ το πιστοποιητικό', () => {
  it('το `certificateId` δεν έχει καν θέση στην έξοδο', () => {
    const attributes = project({
      energy: { class: 'B', certificateId: 'ΠΕΑ-123456', validUntil: '2030-01-01' },
    } as Partial<ProjectableProperty>);

    expect(attributes.energyClass).toBe('B');
    expect(JSON.stringify(attributes)).not.toContain('ΠΕΑ-123456');
    expect(Object.keys(attributes)).not.toContain('energyCertificateId');
  });
});
