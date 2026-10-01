/**
 * @fileoverview 🧭 **Η ΑΓΚΥΡΑ ΤΟΥ ΒΟΡΡΑ ΤΗΣ ΚΑΤΟΨΗΣ** — ανάγνωση, πρόταση κατεύθυνσης, εκτίμηση από πυξίδες (ADR-897 Φ5.2).
 * @related lib/listings/floorplan-north · lib/listings/capture-survey · lib/geometry/angle (`circularMeanRad`)
 *
 *   Β1 — ανάγνωση: κανονικοποίηση, σκουπίδι πέφτει μόνο του, δημόσιος αναγνώστης αυστηρός;
 *   Β2 — πρόταση κατεύθυνσης = βορράς + πυξίδα, με αναδίπλωση στο [0, 2π);
 *   Β3 — ο κυκλικός μέσος των 350° και 10° είναι 0°, ΟΧΙ 180°;
 *   Β4 — εκτίμηση: λίγα δείγματα ⇒ τίποτα · συμφωνία ⇒ βορράς · εξαίρεση πετιέται · διαφωνία ⇒ καμία πρόταση;
 *   Β5 — η αποτύπωση (σημεία + βορράς) συγκρίνεται και γίνεται σύρμα ΜΑΖΙ;
 *
 * ⛔ **ΜΕΤΑΛΛΑΞΕΙΣ**: (α) αριθμητικός μέσος αντί κυκλικού στο `circularMeanRad` ⇒ Β3/Β4 κοκκινίζουν · (β) χωρίς απόρριψη
 *   εξαίρεσης ⇒ Β4 «εξαίρεση» κοκκινίζει · (γ) `heading + compass` αντί `heading − compass` ⇒ Β4 κοκκινίζει.
 */

import { circularMeanRad, degToRad, normalizeAngleDiff, radToDeg } from '@/lib/geometry/angle';
import { captureSurveyWire, readCaptureSurvey, sameCaptureSurvey } from '@/lib/listings/capture-survey';
import {
  estimateNorthFromCompass,
  headingFromCompass,
  readDeclaredFloorplanNorth,
  readListingNorthRad,
  readNorthRad,
  type CompassSample,
} from '@/lib/listings/floorplan-north';

const deg = degToRad;
const offDeg = (a: number, b: number) => Math.abs(radToDeg(normalizeAngleDiff(a - b)));

/** Φωτογραφία που ο άνθρωπος έστρεψε στο `headingDeg` της εικόνας, με πυξίδα `compassDeg` από τον βορρά. */
const sample = (headingDeg: number, compassDeg: number): CompassSample =>
  ({ headingRad: deg(headingDeg), compassRad: deg(compassDeg) });

describe('Β1 — ανάγνωση', () => {
  it('κανονικοποιεί: −90° ≡ 270°', () => {
    expect(readNorthRad(deg(-90))).toBeCloseTo(deg(270));
  });

  it('άκυρη γραμμή πέφτει ΜΟΝΗ της', () => {
    const read = readDeclaredFloorplanNorth({ plan_a: 1, plan_b: 'x', plan_c: Number.NaN, ' ': 2 });
    expect([...read]).toEqual([['plan_a', 1]]);
  });

  it('δημόσιος αναγνώστης: εκτός [0, 2π) ή μη-αριθμός ⇒ κανένα βέλος', () => {
    expect(readListingNorthRad(1.5)).toBe(1.5);
    expect(readListingNorthRad(-0.1)).toBeNull();
    expect(readListingNorthRad(Math.PI * 2)).toBeNull();
    expect(readListingNorthRad('1')).toBeNull();
    expect(readListingNorthRad(undefined)).toBeNull();
  });
});

describe('Β2 — πρόταση κατεύθυνσης', () => {
  it('βορράς 300° + πυξίδα 90° (ανατολή) ⇒ 30° στην εικόνα', () => {
    expect(radToDeg(headingFromCompass(deg(300), deg(90)))).toBeCloseTo(30);
  });
});

describe('Β3 — κυκλικός μέσος', () => {
  it('350° και 10° ⇒ 0°, όχι 180°', () => {
    const mean = circularMeanRad([deg(350), deg(10)]);
    expect(mean).not.toBeNull();
    expect(offDeg(mean?.meanRad ?? Math.PI, 0)).toBeLessThan(1e-6);
  });

  it('αντίθετες κατευθύνσεις ⇒ ο μέσος δεν ορίζεται', () => {
    expect(circularMeanRad([0, Math.PI])).toBeNull();
  });
});

describe('Β4 — εκτίμηση βορρά από πυξίδες', () => {
  it('λιγότερα από δύο δείγματα ⇒ τίποτα', () => {
    expect(estimateNorthFromCompass([sample(40, 10)])).toBeNull();
  });

  it('δείγματα που συμφωνούν γύρω από το 0 ⇒ βορράς κοντά στο 0 (αναδίπλωση)', () => {
    // βορράς = κατεύθυνση − πυξίδα: 355°, 3°, 1°
    const result = estimateNorthFromCompass([sample(100, 105), sample(93, 90), sample(181, 180)]);
    expect(result?.kind).toBe('estimate');
    if (result?.kind !== 'estimate') return;
    expect(offDeg(result.northRad, 0)).toBeLessThan(3);
    expect(result.used).toBe(3);
  });

  it('μία πυξίδα δίπλα σε ψυγείο (+120°) πετιέται, οι άλλες αποφασίζουν', () => {
    const result = estimateNorthFromCompass([sample(60, 30), sample(150, 118), sample(250, 222), sample(10, 220)]);
    expect(result?.kind).toBe('estimate');
    if (result?.kind !== 'estimate') return;
    expect(result.used).toBe(3);
    expect(result.total).toBe(4);
    expect(offDeg(result.northRad, deg(30))).toBeLessThan(3);
  });

  it('πυξίδες που διαφωνούν ⇒ καμία πρόταση (ποτέ βορράς από θόρυβο)', () => {
    const result = estimateNorthFromCompass([sample(0, 0), sample(0, 70)]);
    expect(result?.kind).toBe('disagree');
  });
});

describe('Β5 — η αποτύπωση είναι ΜΙΑ δήλωση', () => {
  const spot = { floorplanFileId: 'plan_a', x: 0.5, y: 0.5, headingRad: 1, fovRad: 1.2 };

  it('ίδια σημεία, άλλος βορράς ⇒ ΔΙΑΦΟΡΕΤΙΚΗ αποτύπωση (η συμφιλίωση περιμένει και τα δύο)', () => {
    const a = readCaptureSurvey({ photo_1: spot }, { plan_a: 1 });
    const b = readCaptureSurvey({ photo_1: spot }, { plan_a: 2 });
    expect(sameCaptureSurvey(a, a)).toBe(true);
    expect(sameCaptureSurvey(a, b)).toBe(false);
  });

  it('το σύρμα έχει ΠΑΝΤΑ και τα δύο πεδία — και το κενό, ώστε να αποσύρεται ο τελευταίος βορράς', () => {
    expect(captureSurveyWire(readCaptureSurvey({ photo_1: spot }, undefined))).toEqual({
      spots: { photo_1: spot },
      north: {},
    });
  });
});
