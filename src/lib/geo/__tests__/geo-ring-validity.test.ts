/**
 * @fileoverview Άγκυρες για **εμβαδόν** και **απλότητα** δακτυλίου (ADR-777 §14.4).
 * @related lib/geo/geo-ring.ts · lib/places/place-claim-validation.ts
 *
 * ⚠️ Οι δύο αυτές συναρτήσεις κρίνουν τι μπαίνει στο **κοινό επίπεδο Α** — ό,τι
 * περάσει, το βλέπουν **όλοι** (§14.4). Γι' αυτό η άγκυρα του εμβαδού δεν συγκρίνει
 * με σταθερά βγαλμένη από τον ίδιο τύπο, αλλά με **ανεξάρτητη μέτρηση πλευρών**.
 */

import { distanceMeters } from '../geo-distance';
import { geoOutlineAreaSqm, isPointInGeoOutline, isSimpleGeoOutline } from '../geo-ring';
import type { GeoOutline } from '@/types/geo/coordinates';

/** Ορθογώνιο γύρω από τη Θεσσαλονίκη — δεξιόστροφο στη γραφή. */
const RECTANGLE: GeoOutline = [
  { lat: 40.6400, lng: 22.9400 },
  { lat: 40.6400, lng: 22.9420 },
  { lat: 40.6410, lng: 22.9420 },
  { lat: 40.6410, lng: 22.9400 },
];

describe('geoOutlineAreaSqm', () => {
  /**
   * 🔴 **ΔΕΥΤΕΡΗ ΦΩΝΗ**: το εμβαδόν ορθογωνίου είναι «πλευρά × πλευρά», και οι
   * πλευρές μετριούνται με τον **SSoT απόστασης** — μηχανή ανεξάρτητη από τη
   * shoelace που κρίνεται. Μια σταθερά υπολογισμένη με shoelace θα επικύρωνε τη
   * shoelace με τον εαυτό της.
   */
  it('Κ1 — ορθογώνιο: shoelace ≡ πλευρά × πλευρά (ανοχή 0,5 %)', () => {
    const width = distanceMeters(RECTANGLE[0], RECTANGLE[1]);
    const height = distanceMeters(RECTANGLE[1], RECTANGLE[2]);

    const viaSides = width * height;
    const viaShoelace = geoOutlineAreaSqm(RECTANGLE);

    expect(viaShoelace).toBeGreaterThan(0);
    expect(Math.abs(viaShoelace - viaSides) / viaSides).toBeLessThan(0.005);
  });

  it('Κ2 — η φορά διαγραφής ΔΕΝ αλλάζει το εμβαδόν (είναι γεγονός, όχι σύμβαση)', () => {
    const reversed = [...RECTANGLE].reverse();
    expect(geoOutlineAreaSqm(reversed)).toBeCloseTo(geoOutlineAreaSqm(RECTANGLE), 6);
  });

  it('Κ3 — συνευθειακές κορυφές ⇒ μηδέν', () => {
    const collinear: GeoOutline = [
      { lat: 40.64, lng: 22.94 },
      { lat: 40.65, lng: 22.95 },
      { lat: 40.66, lng: 22.96 },
    ];
    expect(geoOutlineAreaSqm(collinear)).toBeCloseTo(0, 6);
  });

  it('Κ4 — λιγότερες από 3 κορυφές ⇒ 0 (δύο σημεία δεν περικλείουν τίποτα)', () => {
    expect(geoOutlineAreaSqm([RECTANGLE[0], RECTANGLE[1]])).toBe(0);
    expect(geoOutlineAreaSqm([])).toBe(0);
  });
});

describe('isSimpleGeoOutline', () => {
  it('Κ5 — ορθογώνιο είναι απλό', () => {
    expect(isSimpleGeoOutline(RECTANGLE)).toBe(true);
  });

  /**
   * 🔴 **Η ΑΓΚΥΡΑ ΠΟΥ ΔΙΚΑΙΟΛΟΓΕΙ ΤΗ ΣΥΝΑΡΤΗΣΗ.** Το «παπιγιόν» προκύπτει από
   * αντιμετάθεση **δύο** κορυφών ορθογωνίου — δηλαδή από ένα σύρσιμο του δαχτύλου —
   * και **δεν φαίνεται λάθος**: έχει εμβαδόν, έχει κορυφές, και το
   * {@link isPointInGeoOutline} απαντά για αυτό **χωρίς παράπονο**. Ακριβώς εκεί
   * γεννιέται το ψέμα του `outside-area`.
   */
  it('Κ6 — «παπιγιόν» ΔΕΝ είναι απλό', () => {
    const bowtie: GeoOutline = [
      RECTANGLE[0],
      RECTANGLE[1],
      RECTANGLE[3],
      RECTANGLE[2],
    ];
    expect(isSimpleGeoOutline(bowtie)).toBe(false);
    // …και ιδού γιατί έχει σημασία: το ερώτημα «μέσα;» εξακολουθεί να απαντιέται.
    expect(typeof isPointInGeoOutline({ lat: 40.6405, lng: 22.941 }, bowtie)).toBe('boolean');
  });

  it('Κ7 — μη-κυρτό σχήμα Γ είναι απλό (η μη-κυρτότητα ΔΕΝ είναι αυτοτομή)', () => {
    const lShape: GeoOutline = [
      { lat: 40.6400, lng: 22.9400 },
      { lat: 40.6400, lng: 22.9420 },
      { lat: 40.6405, lng: 22.9420 },
      { lat: 40.6405, lng: 22.9410 },
      { lat: 40.6410, lng: 22.9410 },
      { lat: 40.6410, lng: 22.9400 },
    ];
    expect(isSimpleGeoOutline(lShape)).toBe(true);
  });

  it('Κ8 — τρίγωνο είναι πάντα απλό (δεν υπάρχει ζεύγος μη-γειτονικών τμημάτων)', () => {
    expect(
      isSimpleGeoOutline([
        { lat: 40.64, lng: 22.94 },
        { lat: 40.64, lng: 22.95 },
        { lat: 40.65, lng: 22.945 },
      ]),
    ).toBe(true);
  });

  /**
   * ⚠️ Επαναλαμβανόμενη κορυφή = «κούμπωμα» εργαλείου σχεδίασης, **όχι** παπιγιόν.
   * Ο έλεγχος είναι **γνήσιας** τομής ακριβώς γι' αυτό.
   */
  it('Κ9 — επαναλαμβανόμενη κορυφή δεν καταγγέλλεται ως αυτοτομή', () => {
    const repeated: GeoOutline = [...RECTANGLE, RECTANGLE[0]];
    expect(isSimpleGeoOutline(repeated)).toBe(true);
  });
});
