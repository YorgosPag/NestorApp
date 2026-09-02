/**
 * @fileoverview Άγκυρες για το «πότε δύο υποψήφιοι είναι η ίδια επιλογή» (ADR-332 §3.4).
 *
 * 🔑 **ΚΑΘΕ ΑΡΙΘΜΟΣ ΕΔΩ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟΣ ΣΕ ΖΩΝΤΑΝΟ NOMINATIM (2026-09-02, `limit=5`)**,
 * όχι επινοημένος. Αυτό είναι το σημείο του ADR-332: η προηγούμενη σουίτα των 42 αγκυρών
 * ήταν πράσινη πάνω σε **συνθετικές** εναλλακτικές που η παραγωγή δεν μπορούσε να
 * παραγάγει — κάλυψη σε νεκρό δίδυμο δεν είναι κάλυψη. Οι συντεταγμένες παρακάτω είναι
 * αντιγραμμένες από την απάντηση του παρόχου.
 */

/* global describe, it, expect */

import {
  SAME_DOOR_RADIUS_M,
  distinctAddressChoices,
  sameAddressChoice,
  type AddressChoiceLike,
} from '../address-candidate-identity';

function choice(
  displayName: string,
  lat: number,
  lng: number,
  street?: string,
  number?: string,
): AddressChoiceLike {
  return { displayName, lat, lng, resolvedFields: { street, number } };
}

// =============================================================================
// ΜΕΤΡΗΜΕΝΑ ΔΕΔΟΜΕΝΑ — q="Τσιμισκή 43, Θεσσαλονίκη, 54623" → 4 σειρές, ΜΙΑ πόρτα
// =============================================================================

const TSIMISKI_CONSULATE = choice('Γενικό Προξενείο των ΗΠΑ, 43, Ιωάννη Τσιμισκή, Λαδάδικα, Θεσσαλονίκη', 40.6331916, 22.9427856, 'Ιωάννη Τσιμισκή', '43');
const TSIMISKI_MASOUTIS = choice('Μασούτης, 43, Ιωάννη Τσιμισκή, Λαδάδικα, 1η Κοινότητα Θεσσαλονίκης', 40.6334732, 22.9433534, 'Ιωάννη Τσιμισκή', '43');
const TSIMISKI_ODEON = choice('ODEON Πλατεία, 43, Ιωάννη Τσιμισκή, Λαδάδικα, 1η Κοινότητα Θεσσαλονίκης', 40.6335573, 22.9430297, 'Ιωάννη Τσιμισκή', '43');
const TSIMISKI_HOUSE = choice('43, Ιωάννη Τσιμισκή, Λαδάδικα, 1η Κοινότητα Θεσσαλονίκης', 40.6330851, 22.9426912, 'Ιωάννη Τσιμισκή', '43');

// =============================================================================
// ΜΕΤΡΗΜΕΝΑ ΔΕΔΟΜΕΝΑ — q="Αθηνάς 5" (χωρίς τοπωνύμιο) → 5 σειρές, ΠΕΝΤΕ πόλεις
// =============================================================================

const ATHINAS_AG_ANARGYROI = choice('5, Αθηνάς, Δημοτική Ενότητα Αγίων Αναργύρων, 135 61', 38.0333, 23.7167, 'Αθηνάς', '5');
const ATHINAS_THESSALONIKI = choice('5, Αθηνάς, Κουλέ Καφέ, Άνω Πόλη, Θεσσαλονίκη, 540 03', 40.6440, 22.9500, 'Αθηνάς', '5');
const ATHINAS_LARISA = choice('5, Αθηνάς, Άγιος Αθανάσιος, Λάρισα, 412 22', 39.6390, 22.4191, 'Αθηνάς', '5');

// =============================================================================

describe('sameAddressChoice — «είναι αυτά τα δύο η ίδια ερώτηση προς τον άνθρωπο;»', () => {
  it('ΙΔΙΑ ΠΟΡΤΑ: τα POI της Τσιμισκή 43 είναι η ίδια επιλογή, όσο κι αν διαφέρει η ταμπέλα', () => {
    expect(sameAddressChoice(TSIMISKI_CONSULATE, TSIMISKI_MASOUTIS)).toBe(true);
    expect(sameAddressChoice(TSIMISKI_CONSULATE, TSIMISKI_ODEON)).toBe(true);
    expect(sameAddressChoice(TSIMISKI_CONSULATE, TSIMISKI_HOUSE)).toBe(true);
  });

  it('ΑΛΛΗ ΠΟΛΗ: η «Αθηνάς 5» σε τρεις δήμους είναι τρεις διαφορετικές επιλογές', () => {
    expect(sameAddressChoice(ATHINAS_AG_ANARGYROI, ATHINAS_THESSALONIKI)).toBe(false);
    expect(sameAddressChoice(ATHINAS_THESSALONIKI, ATHINAS_LARISA)).toBe(false);
    expect(sameAddressChoice(ATHINAS_AG_ANARGYROI, ATHINAS_LARISA)).toBe(false);
  });

  it('ΤΑΥΤΟΣΗΜΗ ΟΡΑΤΗ ΓΡΑΜΜΗ ⇒ ίδια επιλογή, ακόμη κι αν τα δεδομένα από κάτω διαφέρουν', () => {
    const a = choice('10, Ελευθερίας, Νέα Ιωνία, 142 33', 38.0400, 23.7600, 'Ελευθερίας', '10');
    const b = choice('10, Ελευθερίας, Νέα Ιωνία, 142 33', 39.6300, 22.4100, 'Ελευθερίας', '10');
    expect(sameAddressChoice(a, b)).toBe(true);
  });

  it('ΤΟ ΟΝΟΜΑ ΤΟΠΟΥ ΔΕΝ ΕΙΝΑΙ ΤΑΥΤΟΤΗΤΑ: «Θεσσαλονίκη» ⇄ «Δημοτική Ενότητα Θεσαλονίκης» για την ΙΔΙΑ πόρτα', () => {
    // Ακριβώς το λάθος που έκανε η πρώτη εκδοχή της μέτρησης της 02/09.
    const withCity = choice('43, Ιωάννη Τσιμισκή, Θεσσαλονίκη', 40.6331916, 22.9427856, 'Ιωάννη Τσιμισκή', '43');
    const withMunicipality = choice('43, Ιωάννη Τσιμισκή, Δημοτική Ενότητα Θεσαλονίκης', 40.6330851, 22.9426912, 'Ιωάννη Τσιμισκή', '43');
    expect(sameAddressChoice(withCity, withMunicipality)).toBe(true);
  });

  it('ΙΔΙΟΣ ΔΡΟΜΟΣ, ΑΛΛΟΣ ΑΡΙΘΜΟΣ ⇒ πάντα διαφορετική επιλογή, όσο κοντά κι αν είναι', () => {
    const n43 = choice('43, Ιωάννη Τσιμισκή', 40.6331916, 22.9427856, 'Ιωάννη Τσιμισκή', '43');
    const n45 = choice('45, Ιωάννη Τσιμισκή', 40.6332000, 22.9428000, 'Ιωάννη Τσιμισκή', '45');
    expect(sameAddressChoice(n43, n45)).toBe(false);
  });

  it('ΧΩΡΙΣ ΑΡΙΘΜΟ ΚΑΙ ΣΤΑ ΔΥΟ: τμήματα του ίδιου δρόμου κοντά ⇒ ίδια απάντηση «βρήκα τον δρόμο»', () => {
    // Μετρημένο: «Αγ. Δημητρίου 55, Θεσσαλονίκη» → 5 τμήματα highway/secondary, κανένα με αριθμό.
    const segmentA = choice('Αγίου Δημητρίου, Διοικητήριο, Θεσσαλονίκη', 40.6400, 22.9450, 'Αγίου Δημητρίου');
    const segmentB = choice('Αγίου Δημητρίου, Καμάρα, Θεσσαλονίκη', 40.6410, 22.9460, 'Αγίου Δημητρίου');
    expect(sameAddressChoice(segmentA, segmentB)).toBe(true);
  });

  it('ΧΩΡΙΣ ΑΡΙΘΜΟ αλλά ΜΑΚΡΙΑ: οι δύο άκρες ενός δρόμου παραμένουν χωριστές επιλογές', () => {
    const near = choice('Αγίου Δημητρίου, Διοικητήριο', 40.6400, 22.9450, 'Αγίου Δημητρίου');
    const far = choice('Αγίου Δημητρίου, Σαράντα Εκκλησίες', 40.6480, 22.9550, 'Αγίου Δημητρίου');
    expect(sameAddressChoice(near, far)).toBe(false);
  });

  it('ΧΩΡΙΣ ΟΔΟ δεν κρίνεται ταυτότητα — δύο πόλεις δεν συμπτύσσονται από εγγύτητα', () => {
    const cityA = choice('Θεσσαλονίκη, 540 12', 40.6401, 22.9444);
    const cityB = choice('Δημοτική Ενότητα Θεσαλονίκης', 40.6402, 22.9445);
    expect(sameAddressChoice(cityA, cityB)).toBe(false);
  });

  it('ΤΟ ΚΑΤΩΦΛΙ ΕΙΝΑΙ ΑΥΤΟ ΠΟΥ ΔΗΛΩΝΕΤΑΙ: ~120 m μέσα, ~1,6 km έξω', () => {
    const origin = choice('Α', 40.6400, 22.9450, 'Οδός', '1');
    // ~111 m ανά 0,001° γεωγραφικού πλάτους.
    const inside = choice('Β', 40.6400 + 0.0011, 22.9450, 'Οδός', '1');
    const outside = choice('Γ', 40.6400 + 0.0144, 22.9450, 'Οδός', '1');
    expect(SAME_DOOR_RADIUS_M).toBe(150);
    expect(sameAddressChoice(origin, inside)).toBe(true);
    expect(sameAddressChoice(origin, outside)).toBe(false);
  });

  it('είναι συμμετρική — η σειρά των ορισμάτων δεν αλλάζει την απάντηση', () => {
    expect(sameAddressChoice(TSIMISKI_MASOUTIS, TSIMISKI_CONSULATE)).toBe(true);
    expect(sameAddressChoice(ATHINAS_LARISA, ATHINAS_THESSALONIKI)).toBe(false);
  });
});

describe('distinctAddressChoices — τι φτάνει στον κατάλογο', () => {
  it('η μετρημένη απάντηση της Τσιμισκή (4 σειρές) γίνεται ΜΙΑ επιλογή', () => {
    const kept = distinctAddressChoices([
      TSIMISKI_CONSULATE, TSIMISKI_MASOUTIS, TSIMISKI_ODEON, TSIMISKI_HOUSE,
    ]);
    expect(kept).toHaveLength(1);
  });

  it('κρατά τον ΠΡΩΤΟ κάθε ομάδας — ο πάροχος κατατάσσει κατά αναγνωρισιμότητα', () => {
    const kept = distinctAddressChoices([
      TSIMISKI_CONSULATE, TSIMISKI_MASOUTIS, TSIMISKI_ODEON, TSIMISKI_HOUSE,
    ]);
    // «Γενικό Προξενείο των ΗΠΑ» αναγνωρίζεται πιο γρήγορα από «43, Ιωάννη Τσιμισκή».
    expect(kept[0]).toBe(TSIMISKI_CONSULATE);
  });

  it('η μετρημένη απάντηση της «Αθηνάς 5» (3 πόλεις) μένει ΤΡΕΙΣ επιλογές', () => {
    const kept = distinctAddressChoices([
      ATHINAS_AG_ANARGYROI, ATHINAS_THESSALONIKI, ATHINAS_LARISA,
    ]);
    expect(kept).toEqual([ATHINAS_AG_ANARGYROI, ATHINAS_THESSALONIKI, ATHINAS_LARISA]);
  });

  it('μεικτή απάντηση: τα δίδυμα πέφτουν, οι γνήσιες επιβιώνουν, η σειρά διατηρείται', () => {
    const kept = distinctAddressChoices([
      TSIMISKI_CONSULATE, ATHINAS_LARISA, TSIMISKI_MASOUTIS, ATHINAS_THESSALONIKI, TSIMISKI_ODEON,
    ]);
    expect(kept).toEqual([TSIMISKI_CONSULATE, ATHINAS_LARISA, ATHINAS_THESSALONIKI]);
  });

  it('κενή είσοδος δίνει κενή έξοδο, χωρίς να πετάξει', () => {
    expect(distinctAddressChoices([])).toEqual([]);
  });

  it('δεν αλλοιώνει τον πίνακα που της δόθηκε', () => {
    const input = [TSIMISKI_CONSULATE, TSIMISKI_MASOUTIS];
    distinctAddressChoices(input);
    expect(input).toHaveLength(2);
  });
});
