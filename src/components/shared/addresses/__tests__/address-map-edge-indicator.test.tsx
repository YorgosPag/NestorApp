/**
 * @fileoverview **ΔΕΙΧΝΕΙ ΤΟ ΒΕΛΟΣ ΕΚΕΙ ΠΟΥ ΛΕΕΙ, ΚΑΙ ΤΟ ΒΛΕΠΕΙ ΚΑΝΕΙΣ;** — ADR-332 **D26**.
 * @related components/shared/addresses/address-map-edge-indicator
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ — ΔΥΟ ΕΛΑΤΤΩΜΑΤΑ ΠΟΥ ΕΖΗΣΑΝ ΔΙΠΛΑ ΣΕ 524 ΠΡΑΣΙΝΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το D26 παραδόθηκε με **524 πράσινες άγκυρες** και **18/18** κόκκινες μεταλλάξεις. Το
 * περπάτημα της οθόνης βρήκε **και τα δύο** ελαττώματα μέσα σε δέκα λεπτά:
 *
 * 1. Το βέλος έδειχνε **45° λάθος** σε **κάθε** υποψήφιο — επειδή το `Navigation` του
 *    `lucide` δείχνει **βορειοανατολικά**, όχι πάνω.
 * 2. Το βέλος ήταν **αόρατο** στο σκοτεινό θέμα — αντίθεση **1,06 : 1** πάνω στον χάρτη.
 *
 * 🔑 **Καμία υπάρχουσα άγκυρα δεν μπορούσε να τα δει, και ο λόγος είναι ο ίδιος και για
 * τα δύο**: οι 16 άγκυρες της γεωμετρίας έλεγχαν το `angleDeg` — **που ήταν σωστό**.
 * Το λάθος δεν ήταν στον αριθμό· ήταν στο **πώς αποδίδεται** ο αριθμός. Και αυτό ζούσε
 * μέσα σε αρχείο που εισάγει `maplibre-gl`, δηλαδή **δεν εκτελείται ποτέ** σε jsdom.
 *
 * ⚠️ **Άρα η άγκυρα εδώ δεν είναι «ένα test παραπάνω» — είναι το ερώτημα που κανείς δεν
 * μπορούσε να κάνει.** Γι' αυτό η όψη μετακόμισε σε αρχείο χωρίς χάρτη.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 📐 ΠΩΣ ΣΥΝΘΕΤΟΥΝ ΤΗΝ ΕΓΓΥΗΣΗ ΟΙ ΔΥΟ ΕΛΕΓΧΟΙ ΤΗΣ ΦΟΡΑΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το jsdom **δεν** εφαρμόζει `transform`, οπότε η τελική φορά δεν μετριέται εδώ. Την
 * εγγυώνται **δύο** ελέγχοι που πολλαπλασιάζονται:
 *
 * | Έλεγχος | Τι κλειδώνει |
 * |---|---|
 * | το πολύγωνο του εικονιδίου δείχνει **ακριβώς πάνω** | φυσική φορά = 0° |
 * | το `transform` είναι **ακριβώς** `rotate(angleDeg)` | καμία κρυφή αντιστάθμιση |
 *
 * Φορά = 0° + `angleDeg`. Σπάσε **οποιοδήποτε** από τα δύο και το γινόμενο κοκκινίζει.
 */

/* global describe, it, expect */

import React from 'react';
import { render } from '@testing-library/react';

import {
  CandidateBadge,
  edgeIndicatorForCandidate,
  EdgeIndicatorArrow,
  EDGE_INSET_PX,
  FIT_BUTTON_BOX,
  SIGN_CLEARANCE_PX,
  SIGN_MAX_HEIGHT_PX,
  SIGN_PAINT,
} from '../address-map-edge-indicator';
import { edgeIndicatorFor } from '@/lib/geo/offscreen-edge-indicator';

interface Vertex {
  readonly x: number;
  readonly y: number;
}

/** Οι κορυφές του πολυγώνου **όπως αποδόθηκαν**, χωρίς το κλείσιμο του σχήματος. */
function renderedPolygon(): Vertex[] {
  const { container } = render(<EdgeIndicatorArrow angleDeg={0} highlighted={false} />);
  const polygon = container.querySelector('polygon');
  expect(polygon).not.toBeNull();

  const numbers = (polygon?.getAttribute('points') ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  expect(numbers.length).toBeGreaterThanOrEqual(6);
  expect(numbers.every(Number.isFinite)).toBe(true);

  const all: Vertex[] = [];
  for (let i = 0; i < numbers.length; i += 2) all.push({ x: numbers[i], y: numbers[i + 1] });

  return all.filter(
    (vertex, index) => all.findIndex((other) => other.x === vertex.x && other.y === vertex.y) === index,
  );
}

function centroidOf(vertices: readonly Vertex[]): Vertex {
  return {
    x: vertices.reduce((sum, v) => sum + v.x, 0) / vertices.length,
    y: vertices.reduce((sum, v) => sum + v.y, 0) / vertices.length,
  };
}

/** Ο πρώτος `<token>` μιας κλάσης `prefix-<token>` — `null` όταν δεν υπάρχει. */
function tokenOf(classes: string, prefix: string): string | null {
  const match = classes.split(/\s+/).find((cls) => cls.startsWith(`${prefix}-`));
  return match ? match.slice(prefix.length + 1) : null;
}

describe('EdgeIndicatorArrow — η φυσική φορά του εικονιδίου', () => {
  /**
   * 🔴 **Η ΑΓΚΥΡΑ ΠΟΥ ΕΛΕΙΠΕ.** Διαβάζει το **ίδιο το πολύγωνο** που αποδόθηκε, όχι
   * αντίγραφό του: αν κάποιος γυρίσει σε `Navigation` *(κορυφή (22,2), κέντρο (12,25;
   * 11,75) ⇒ άξονας 45°)* ή αν μια αναβάθμιση του `lucide` αλλάξει το σχήμα, εδώ
   * κοκκινίζει **πριν** φτάσει σε ανθρώπινο μάτι.
   */
  it('🔴 η κορυφή του βέλους είναι ΑΚΡΙΒΩΣ πάνω από το κέντρο του — αλλιώς κάθε γωνία βγαίνει στραβή', () => {
    const vertices = renderedPolygon();
    const centroid = centroidOf(vertices);

    const distanceSquared = (v: Vertex) => (v.x - centroid.x) ** 2 + (v.y - centroid.y) ** 2;
    const tip = vertices.reduce((far, v) => (distanceSquared(v) > distanceSquared(far) ? v : far), vertices[0]);

    // Κατακόρυφος άξονας: η κορυφή δεν γέρνει ούτε δεξιά ούτε αριστερά.
    expect(tip.x).toBeCloseTo(centroid.x, 6);
    // Και δείχνει ΠΑΝΩ: στο SVG το `y` μεγαλώνει προς τα κάτω.
    expect(tip.y).toBeLessThan(centroid.y);
  });

  it('🔴 το σχήμα είναι ΣΥΜΜΕΤΡΙΚΟ ως προς τον κατακόρυφο άξονα — βέλος που γέρνει διαβάζεται στραβά', () => {
    const vertices = renderedPolygon();
    const centroid = centroidOf(vertices);

    for (const vertex of vertices) {
      const mirrored = vertices.some(
        (other) =>
          Math.abs(other.x - (2 * centroid.x - vertex.x)) < 1e-6 && Math.abs(other.y - vertex.y) < 1e-6,
      );
      expect(mirrored).toBe(true);
    }
  });

  it('🔴 η περιστροφή είναι ΑΚΡΙΒΩΣ η ζητούμενη γωνία — καμία κρυφή αντιστάθμιση', () => {
    for (const angleDeg of [0, 37.6888, 110.145, 180, 328.151]) {
      const { container } = render(<EdgeIndicatorArrow angleDeg={angleDeg} highlighted={false} />);
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('style')).toContain(`rotate(${angleDeg}deg)`);
    }
  });
});

describe('EdgeIndicatorArrow — γιατί το βλέπει κανείς', () => {
  /**
   * 🔴 **ΤΟ ΕΛΑΤΤΩΜΑ ΗΤΑΝ ΑΚΡΙΒΩΣ ΑΥΤΟ**: `fill: none` σημαίνει «δανείσου φόντο από ό,τι
   * βρεθεί από κάτω», και από κάτω είναι **ο χάρτης** — ανοιχτόχρωμος και στα δύο θέματα.
   */
  it('🔴 το βέλος ΒΑΦΕΙ δικό του φόντο — χωρίς `fill` δανείζεται τον χάρτη και εξαφανίζεται', () => {
    for (const state of ['resting', 'highlighted'] as const) {
      expect(tokenOf(SIGN_PAINT[state].arrow, 'fill')).not.toBeNull();
      expect(tokenOf(SIGN_PAINT[state].arrow, 'fill')).not.toBe('none');
    }
  });

  /**
   * 🔑 **Η ΤΑΜΠΕΛΑ ΕΙΧΕ ΗΔΗ ΤΗ ΛΥΣΗ, ΤΟ ΒΕΛΟΣ ΟΧΙ.** Δένοντάς τα στο **ίδιο** ζεύγος, η
   * απόκλιση παύει να είναι θέμα προσοχής: όποιος αλλάξει το ένα χωρίς το άλλο, κοκκινίζει.
   */
  it('🔴 βέλος και ταμπέλα ονομάζουν το ΙΔΙΟ δηλωμένο ζεύγος του θέματος', () => {
    for (const state of ['resting', 'highlighted'] as const) {
      expect(tokenOf(SIGN_PAINT[state].arrow, 'fill')).toBe(tokenOf(SIGN_PAINT[state].badge, 'bg'));
      expect(tokenOf(SIGN_PAINT[state].arrow, 'text')).toBe(tokenOf(SIGN_PAINT[state].badge, 'text'));
    }
  });

  it('🔴 καμία διαφάνεια στο μελάνι ή στην επιφάνεια — το `/70` ήταν το μισό ελάττωμα', () => {
    for (const state of ['resting', 'highlighted'] as const) {
      expect(tokenOf(SIGN_PAINT[state].arrow, 'fill')).not.toContain('/');
      expect(tokenOf(SIGN_PAINT[state].arrow, 'text')).not.toContain('/');
    }
  });

  it('η τονισμένη κατάσταση ΑΝΤΙΣΤΡΕΦΕΙ το ζεύγος — δεν εφευρίσκει τρίτο χρώμα', () => {
    expect(tokenOf(SIGN_PAINT.highlighted.arrow, 'fill')).toBe(tokenOf(SIGN_PAINT.resting.arrow, 'text'));
    expect(tokenOf(SIGN_PAINT.highlighted.arrow, 'text')).toBe(tokenOf(SIGN_PAINT.resting.arrow, 'fill'));
  });

  it('το βέλος αποδίδεται με το ζεύγος της κατάστασής του, όχι με σταθερό χρώμα', () => {
    const resting = render(<EdgeIndicatorArrow angleDeg={0} highlighted={false} />);
    const highlighted = render(<EdgeIndicatorArrow angleDeg={0} highlighted />);
    const classesOf = (r: { container: HTMLElement }) =>
      r.container.querySelector('svg')?.getAttribute('class') ?? '';

    expect(classesOf(resting)).toContain(SIGN_PAINT.resting.arrow.split(/\s+/)[0]);
    expect(classesOf(highlighted)).toContain(SIGN_PAINT.highlighted.arrow.split(/\s+/)[0]);
    expect(classesOf(resting)).not.toBe(classesOf(highlighted));
  });

  it('το βέλος είναι ΚΡΥΦΟ για τον αναγνώστη οθόνης — τη φορά τη λέει το `aria-label` του κουμπιού', () => {
    const { container } = render(<EdgeIndicatorArrow angleDeg={90} highlighted={false} />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('CandidateBadge — το σχήμα ξεχωρίζει πρόταση από δεδομένο, πριν καν το χρώμα', () => {
  it('η τονισμένη περνά από ΔΙΑΣΤΙΚΤΟ σε ΣΥΜΠΑΓΕΣ και μεγαλώνει', () => {
    const resting = render(<CandidateBadge position={3} highlighted={false} />);
    const highlighted = render(<CandidateBadge position={3} highlighted />);
    const classesOf = (r: { container: HTMLElement }) =>
      r.container.querySelector('span')?.getAttribute('class') ?? '';

    expect(classesOf(resting)).toContain('border-dashed');
    expect(classesOf(highlighted)).toContain('border-solid');
    expect(classesOf(highlighted)).toContain('scale-110');
  });

  it('ο αριθμός είναι ο ΠΟΣΤΟΣ της γραμμής — αυτός λύνει την αντιστοίχιση χωρίς χειρονομία', () => {
    const { container } = render(<CandidateBadge position={4} highlighted={false} />);
    expect(container.textContent).toBe('4');
  });
});

describe('τα περιθώρια τοποθέτησης κρατούν καθαρό το «Δες όλες τις πιθανές τοποθεσίες»', () => {
  /** Το κάδρο όπως μετρήθηκε ζωντανά στην οθόνη «Διευθύνσεις Έργου». */
  const FRAME = { width: 802, height: 1077 };

  /**
   * 🔴 **Η ΑΓΚΥΡΑ ΤΟΥ ΜΕΤΡΗΜΕΝΟΥ ΕΛΑΤΤΩΜΑΤΟΣ** *(επικάλυψη 15×23 px, «Άγιοι Ανάργυροι»)*.
   *
   * ⚠️ Ο έλεγχος είναι **κατακόρυφος**, επίτηδες: το πλάτος του κουμπιού εξαρτάται από τη
   * μετάφραση, άρα ένας οριζόντιος έλεγχος θα ίσχυε **μόνο στα ελληνικά** — δηλαδή θα
   * ήταν πράσινος και ψεύτικος στην αγγλική οθόνη.
   */
  it('🔴 ΚΑΝΕΝΑΣ δείκτης δεν ακουμπά τη ζώνη του κουμπιού, για 360 κατευθύνσεις', () => {
    const buttonTop = FRAME.height - FIT_BUTTON_BOX.bottomPx - FIT_BUTTON_BOX.heightPx;

    for (let deg = 0; deg < 360; deg += 1) {
      const radians = (deg * Math.PI) / 180;
      const indicator = edgeIndicatorForCandidate(
        {
          x: FRAME.width / 2 + Math.cos(radians) * 90000,
          y: FRAME.height / 2 + Math.sin(radians) * 90000,
        },
        FRAME,
      );

      expect(indicator).not.toBeNull();
      if (!indicator) continue;

      const signBottom = indicator.y + SIGN_MAX_HEIGHT_PX / 2;
      expect(signBottom).toBeLessThanOrEqual(buttonTop - SIGN_CLEARANCE_PX + 1e-9);
    }
  });

  it('🔴 με ΟΜΟΙΟΜΟΡΦΟ περιθώριο η επικάλυψη ΥΠΑΡΧΕΙ — ο παρονομαστής του ελέγχου από πάνω', () => {
    const buttonTop = FRAME.height - FIT_BUTTON_BOX.bottomPx - FIT_BUTTON_BOX.heightPx;
    const dueSouth = edgeIndicatorFor(
      { x: FRAME.width / 2, y: 90000 },
      FRAME,
      EDGE_INSET_PX,
    );

    expect(dueSouth).not.toBeNull();
    expect((dueSouth?.y ?? 0) + SIGN_MAX_HEIGHT_PX / 2).toBeGreaterThan(buttonTop);
  });
});
