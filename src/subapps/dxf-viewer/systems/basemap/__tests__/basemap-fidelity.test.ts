/**
 * Άγκυρες `Β` — **ADR-782 §27.9: «μπορεί η προβολή να αποδώσει αυτό το πλακίδιο;»**
 *
 * Το ερώτημα δεν είναι «πού είναι το έργο» (`Φ`) ούτε «ακουμπά ο ζωγράφος σωστά» (`Ψ`). Είναι
 * το τρίτο: *το πλέγμα παραμόρφωσης υπόσχεται σφάλμα κάτω από {@link WARP_TOLERANCE_PX} — **το
 * τηρεί**;* Μέχρι το §27.9 κανείς δεν ρωτούσε, και η `chooseDivisions` αθετούσε σιωπηλά μόλις
 * χτυπούσε το ταβάνι υποδιαίρεσης: CHECK 3.45 αυτούσιο.
 *
 * ## 🔴 Τι κρατούν αυτές οι άγκυρες, και γιατί καμία δεν είναι διακοσμητική
 * Η επικίνδυνη αστοχία εδώ **δεν** είναι «ο κριτής λέει λάθος». Είναι «ο κριτής ρωτά **λίγα**»:
 * μετρήθηκε ότι μέσα στο **ίδιο** πλακίδιο το ΒΔ κελί δίνει `0,0016 px` και το χειρότερο
 * `1.262 px` — λόγος **791.000×**. Ένας κριτής χτισμένος σε μονό δείγμα θα ήταν **πράσινος πάνω
 * στο χειρότερο πλακίδιο του πλανήτη**, και μια άγκυρα που ρωτούσε το ίδιο δείγμα θα το
 * επιβεβαίωνε. Γι' αυτό η `Β1` συγκρίνει τον κριτή με **εξαντλητική** σάρωση γραμμένη εδώ.
 */

import {
  assessTileWarp,
  buildTileWarpMesh,
  WARP_TOLERANCE_PX,
} from '../basemap-warp';
import { chooseZoomLevel, tilesForDisplayRect } from '../basemap-tile-model';
import {
  geographicToDisplayMm,
  geographicToWorldMm,
  worldMmToGeographic,
} from '../basemap-projection';
import { visibleDisplayRect } from '../../../rendering/core/visible-display-rect';
import { BASEMAP_SOURCES } from '../basemap-source';
import {
  geographicToTileFraction,
  tileFractionToGeographic,
  tileFractionToTileId,
  type TileId,
} from '../web-mercator';
import {
  getTileFidelityReport,
  isBasemapTruncated,
  reportTileFidelity,
  resetTileFidelityReport,
  subscribeTileFidelity,
} from '../basemap-fidelity-report';

const OSM = BASEMAP_SOURCES['osm-standard'];
const THESSALONIKI = { lat: 40.6326, lon: 22.9412 } as const;
const VIEWPORT = { width: 1200, height: 800 };

/** Τα άκρα του δημοσιευμένου πεδίου εγκυρότητας **EPSG:2100** (*«Greece — onshore»*) + δύο εντός. */
const GREEK_PROBES: readonly (readonly [number, number])[] = [
  [34.88, 19.57], [34.88, 28.3], [41.75, 19.57], [41.75, 28.3],
  [38, 24], [THESSALONIKI.lat, THESSALONIKI.lon],
];

/** Ολόκληρος ο αγωγός για μια κλίμακα — **ποτέ** πλακίδιο διαλεγμένο από το test (μάθημα §27.7). */
function pipelineSelection(scale: number, devicePixelRatio = 1) {
  const visible = visibleDisplayRect({ scale, offsetX: 0, offsetY: 0 }, VIEWPORT);
  const centre = geographicToWorldMm(THESSALONIKI.lat, THESSALONIKI.lon);
  const halfW = (visible.maxX - visible.minX) / 2;
  const halfH = (visible.maxY - visible.minY) / 2;
  const rect = {
    minX: centre.x - halfW, maxX: centre.x + halfW,
    minY: centre.y - halfH, maxY: centre.y + halfH,
  };
  const zoom = chooseZoomLevel({
    pixelsPerMm: scale, devicePixelRatio, latitude: THESSALONIKI.lat, source: OSM,
  });
  return tilesForDisplayRect(rect, zoom, null, scale);
}

/** Το **πλήρες** ορθογώνιο πλακιδίων που καλύπτει το ορατό, πριν από οποιοδήποτε φίλτρο. */
function fullTileRange(scale: number, zoom: number) {
  const visible = visibleDisplayRect({ scale, offsetX: 0, offsetY: 0 }, VIEWPORT);
  const centre = geographicToWorldMm(THESSALONIKI.lat, THESSALONIKI.lon);
  const halfW = (visible.maxX - visible.minX) / 2;
  const halfH = (visible.maxY - visible.minY) / 2;
  const fractions = [
    [centre.x - halfW, centre.y - halfH], [centre.x + halfW, centre.y - halfH],
    [centre.x - halfW, centre.y + halfH], [centre.x + halfW, centre.y + halfH],
  ].map(([x, y]) => {
    const geo = worldMmToGeographic(x, y);
    return geographicToTileFraction(geo.lat, geo.lon, zoom);
  });
  const n = 2 ** zoom;
  return {
    minX: Math.max(0, Math.floor(Math.min(...fractions.map((f) => f.tx)))),
    maxX: Math.min(n - 1, Math.floor(Math.max(...fractions.map((f) => f.tx)))),
    minY: Math.max(0, Math.floor(Math.min(...fractions.map((f) => f.ty)))),
    maxY: Math.min(n - 1, Math.floor(Math.max(...fractions.map((f) => f.ty)))),
  };
}

/**
 * **Ανεξάρτητη**, εξαντλητική μέτρηση του χειρότερου κελιού — δεύτερη φωνή, γραμμένη εδώ.
 *
 * ⚠️ Δεν καλεί τον κριτή: αν καλούσε, η `Β1` θα σύγκρινε τον κριτή με τον εαυτό του.
 */
function worstCellByHand(tile: TileId, pixelsPerMm: number): number {
  const divisions = buildTileWarpMesh(tile, null, pixelsPerMm).divisions;
  const step = 1 / divisions;
  const at = (u: number, v: number) => {
    const geo = tileFractionToGeographic(tile.x + u, tile.y + v, tile.z);
    return geographicToDisplayMm(geo.lat, geo.lon, null);
  };
  let worst = 0;
  for (let row = 0; row < divisions; row += 1) {
    for (let col = 0; col < divisions; col += 1) {
      const u = col * step;
      const v = row * step;
      const corners = [at(u, v), at(u + step, v), at(u + step, v + step), at(u, v + step)];
      const exact = at(u + step / 2, v + step / 2);
      const residual = Math.hypot(
        exact.x - (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4,
        exact.y - (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4,
      ) * pixelsPerMm;
      if (residual > worst) worst = residual;
    }
  }
  return worst;
}

// ── Β1-Β3 — ο κριτής ─────────────────────────────────────────────────────────────────────────

describe('Β — ο κριτής πιστότητας', () => {
  it('Β1 — ρωτά ΟΛΑ τα κελιά: συμφωνεί με εξαντλητική σάρωση στο ΜΕΣΑΙΟ μονοπάτι', () => {
    /**
     * 🔴 **Η πρώτη γραφή αυτής της άγκυρας ΠΕΡΑΣΕ ΤΗ ΜΕΤΑΛΛΑΞΗ.** Τα δείγματά της είχαν όλα είτε
     * `divisions === 1` είτε υπέρβαση ταβανιού, δηλαδή έπεφταν στις **δύο συντομεύσεις** — και η
     * εξαντλητική σάρωση **δεν εκτελούνταν ποτέ**. Μια μετάλλαξη που την περιόριζε στο ΒΔ κελί
     * την άφηνε πράσινη: η άγκυρα δοκίμαζε κώδικα που δεν έτρεχε.
     *
     * Τα ζεύγη εδώ είναι **μετρημένα** ώστε να ζουν στο μεσαίο μονοπάτι (`1 < divisions ≤ 8`) και
     * να **αλλάζουν ετυμηγορία** ανάμεσα σε μονό δείγμα και εξαντλητική σάρωση: στο `z2/2/1` το
     * ΒΔ κελί δίνει `0,0037 px` (περνά) και το χειρότερο `0,638 px` (αθετεί) — **171×**.
     */
    const cases: readonly { readonly tile: TileId; readonly scale: number }[] = [
      { tile: { z: 2, x: 2, y: 1 }, scale: 1e-8 },
      { tile: { z: 2, x: 2, y: 2 }, scale: 1e-8 },
      { tile: { z: 2, x: 1, y: 0 }, scale: 1e-8 },
      { tile: { z: 2, x: 2, y: 1 }, scale: 3e-8 },
      { tile: { z: 3, x: 5, y: 3 }, scale: 3e-8 },
      { tile: { z: 3, x: 3, y: 2 }, scale: 3e-8 },
    ];
    const verdicts = cases.map(({ tile, scale }) => assessTileWarp(tile, null, scale));

    // Παρονομαστής **διπλός**: το μεσαίο μονοπάτι όντως εκτελείται (`1 < d ≤ 8`, πεπερασμένο
    // υπόλοιπο = καμία συντόμευση), και η εξαντλητική σάρωση όντως βρίσκει σπασμένα.
    expect(verdicts.every((v) => v.divisions > 1 && Number.isFinite(v.residualPx))).toBe(true);
    expect(verdicts.filter((v) => !v.withinTolerance).length).toBe(cases.length);

    const disagreements = cases.filter(({ tile, scale }, i) =>
      verdicts[i].withinTolerance !== (worstCellByHand(tile, scale) <= WARP_TOLERANCE_PX));
    expect(disagreements).toEqual([]);
  });

  it('Β1β — και ένα ΜΟΝΟ κελί θα έλεγε το αντίθετο: γι\' αυτό δεν αρκεί δείγμα', () => {
    // Χωρίς αυτό, η `Β1` θα ήταν πράσινη και σε έναν κόσμο όπου το ΒΔ κελί συμφωνεί πάντα με το
    // χειρότερο — δηλαδή θα επιβεβαίωνε συμφωνία δύο μηχανών που δεν διαφωνούν ποτέ.
    const tile: TileId = { z: 2, x: 2, y: 1 };
    const scale = 1e-8;
    const divisions = buildTileWarpMesh(tile, null, scale).divisions;
    const step = 1 / divisions;
    const at = (u: number, v: number) => {
      const geo = tileFractionToGeographic(tile.x + u, tile.y + v, tile.z);
      return geographicToDisplayMm(geo.lat, geo.lon, null);
    };
    const corners = [at(0, 0), at(step, 0), at(step, step), at(0, step)];
    const exact = at(step / 2, step / 2);
    const northWestOnly = Math.hypot(
      exact.x - (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4,
      exact.y - (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4,
    ) * scale;

    expect(northWestOnly).toBeLessThan(WARP_TOLERANCE_PX);          // το δείγμα θα ενέκρινε…
    expect(worstCellByHand(tile, scale)).toBeGreaterThan(WARP_TOLERANCE_PX); // …και θα έσφαλλε
    expect(assessTileWarp(tile, null, scale).withinTolerance).toBe(false);
  });

  it('Β2 — ΨΕΥΔΩΣ ΘΕΤΙΚΑ: μηδέν σε ελληνικό έδαφος, σε κάθε ρεαλιστική κλίμακα και πυκνότητα', () => {
    /**
     * Ο πήχης της Google για **μπλοκάρουσα** απόφαση είναι <10% ψευδώς θετικά. Εδώ η απόφαση
     * σβήνει χάρτη μπροστά στον χρήστη, οπότε το μόνο αποδεκτό είναι **μηδέν**: ένα ψευδώς θετικό
     * σημαίνει κρυμμένος χάρτης πάνω από την Ελλάδα, δηλαδή η θεραπεία χειρότερη από τη βλάβη.
     */
    const offenders: string[] = [];
    let checked = 0;
    for (const scale of [1e-5, 3e-5, 1e-4, 1e-3, 0.01, 0.1, 1]) {
      for (const devicePixelRatio of [1, 2]) {
        const z = chooseZoomLevel({
          pixelsPerMm: scale, devicePixelRatio, latitude: THESSALONIKI.lat, source: OSM,
        });
        for (const [lat, lon] of GREEK_PROBES) {
          const tile = tileFractionToTileId(geographicToTileFraction(lat, lon, z), z);
          checked += 1;
          if (!assessTileWarp(tile, null, scale).withinTolerance) {
            offenders.push(`scale=${scale} dpr=${devicePixelRatio} φ${lat} λ${lon}`);
          }
        }
      }
    }

    expect(checked).toBe(84);               // παρονομαστής: 7 κλίμακες × 2 πυκνότητες × 6 σημεία
    expect(offenders).toEqual([]);
  });

  it('Β3 — FAIL-CLOSED: κλίμακα που δεν είναι αριθμός ⇒ ΚΑΝΕΝΑ πλακίδιο, ποτέ σιωπηλή διέλευση', () => {
    // 🔑 Ο λόγος που η παράμετρος έγινε **υποχρεωτική** αντί για προαιρετική με προεπιλογή: μια
    // προεπιλογή θα άφηνε κάθε καταναλωτή που την ξεχνά με τον έλεγχο **ανενεργό και πράσινο** —
    // «0 = κανείς δεν κοίταξε». Όταν προστέθηκε, τέσσερα υπάρχοντα tests έγιναν κόκκινα· αυτό
    // ήταν η απόδειξη ότι ο φρουρός πυροδοτεί.
    for (const scale of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const verdict = assessTileWarp({ z: 6, x: 35, y: 23 }, null, scale);
      expect(verdict.withinTolerance).toBe(false);
      // Το `Infinity` **ονομάζει** ποιος το έπιασε: ο φρουρός του ταβανιού, πριν καν μετρηθεί
      // κελί. Μια πεπερασμένη τιμή εδώ θα σήμαινε ότι το μη-αριθμητικό διέρρευσε στη μέτρηση.
      expect(verdict.residualPx).toBe(Number.POSITIVE_INFINITY);
    }
  });
});

// ── Β4-Β6 — ο επιλογέας ──────────────────────────────────────────────────────────────────────

describe('Β — ο επιλογέας πλακιδίων', () => {
  it('Β4 — ΚΑΘΕ πλακίδιο που επιστρέφεται τηρεί την υπόσχεση, σε ΟΛΟ το εύρος κλιμάκων', () => {
    const scales = [1e-8, 1e-7, 1e-6, 1e-5, 1e-4, 1e-3, 0.01, 0.1, 1];
    const offenders: string[] = [];
    let inspected = 0;
    for (const scale of scales) {
      for (const tile of pipelineSelection(scale).tiles) {
        inspected += 1;
        if (!assessTileWarp(tile, null, scale).withinTolerance) {
          offenders.push(`scale=${scale} ${tile.z}/${tile.x}/${tile.y}`);
        }
      }
    }

    expect(inspected).toBeGreaterThan(100); // παρονομαστής: δεν κρίθηκε κενή λίστα
    expect(offenders).toEqual([]);
  });

  it('Β5 — ο ΑΡΙΘΜΟΣ που αναφέρεται είναι ο πραγματικός: επιλογέας και κριτής δεν αποκλίνουν', () => {
    // Δύο μηχανές για ένα ερώτημα είναι το σχήμα του ADR-749. Εδώ είναι δομικά αδύνατο μόνο
    // επειδή ο επιλογέας καλεί ΑΥΤΟΝ τον κριτή — η άγκυρα κρατά τη δομή αδύνατη.
    const scale = 1e-7;
    const selection = pipelineSelection(scale);
    const z = selection.zoom;
    // ⚠️ Το εύρος ξαναχτίζεται από το **ορατό ορθογώνιο**, όχι από τα πλακίδια που επέζησαν: τα
    // κομμένα κάθονται στην περιφέρεια, οπότε ένα εύρος βγαλμένο από τα επιζώντα θα ήταν ακριβώς
    // η περιοχή **χωρίς** αυτά — η άγκυρα θα μετρούσε 7 αντί για 37 και θα φαινόταν σφάλμα του
    // κώδικα ενώ θα ήταν σφάλμα του παρονομαστή.
    const range = fullTileRange(scale, z);
    let broken = 0;
    for (let y = range.minY; y <= range.maxY; y += 1) {
      for (let x = range.minX; x <= range.maxX; x += 1) {
        if (!assessTileWarp({ z, x, y }, null, scale).withinTolerance) broken += 1;
      }
    }

    expect(selection.droppedForFidelity).toBeGreaterThan(0); // παρονομαστής
    expect(selection.tiles.length + selection.droppedForFidelity)
      .toBe((range.maxX - range.minX + 1) * (range.maxY - range.minY + 1)); // τίποτα δεν χάθηκε αλλού
    expect(selection.droppedForFidelity).toBe(broken);
  });

  it('Β6 — σε ρεαλιστική κλίμακα ΔΕΝ κόβεται τίποτα: η θεραπεία δεν πληρώνεται από τον χρήστη', () => {
    // Αν το φίλτρο έκοβε στη ζώνη εργασίας, θα ήταν χειρότερο από το ελάττωμα που κλείνει.
    const verdicts = [1e-5, 1e-4, 1e-3, 0.01, 0.1, 1].map((scale) => {
      const selection = pipelineSelection(scale, 2);
      return { scale, dropped: selection.droppedForFidelity, kept: selection.tiles.length };
    });

    expect(verdicts.every((v) => v.kept > 0)).toBe(true);   // παρονομαστής
    expect(verdicts.filter((v) => v.dropped > 0)).toEqual([]);
  });
});

// ── Β7-Β9 — η αναφορά προς την οθόνη ─────────────────────────────────────────────────────────

describe('Β — η απόκρυψη δεν είναι σιωπηλή', () => {
  beforeEach(() => resetTileFidelityReport());

  it('Β7 — η απόκρυψη φτάνει στο κανάλι, και ο ΜΗΔΕΝΙΣΜΟΣ τη σβήνει', () => {
    // Το δεύτερο μισό είναι το κρίσιμο: ένας γραφέας που καλείται μόνο «όταν υπάρχει πρόβλημα»
    // αφήνει την προειδοποίηση κολλημένη αφότου ο χρήστης κάνει μεγέθυνση και τη διορθώσει.
    expect(isBasemapTruncated()).toBe(false);
    reportTileFidelity('plan', 16);
    expect(isBasemapTruncated()).toBe(true);
    reportTileFidelity('plan', 0);
    expect(isBasemapTruncated()).toBe(false);
  });

  it('Β8 — οι δύο επιφάνειες δεν αλληλοσβήνονται: κάθε κάμερα απαντά για τον εαυτό της', () => {
    // Μία κοινή τιμή θα την ξανάγραφε όποια ζωγράφιζε τελευταία — ένδειξη που τρεμοπαίζει
    // ανάλογα με τη σειρά των καρέ, δηλαδή βλάβη που φαίνεται τυχαία.
    reportTileFidelity('plan', 5);
    reportTileFidelity('scene', 0);

    expect(getTileFidelityReport()).toEqual({ plan: 5, scene: 0 });
    expect(isBasemapTruncated()).toBe(true);
  });

  it('Β9 — καρέ που δεν άλλαξε τίποτα ΔΕΝ ειδοποιεί (60 ειδοποιήσεις/s σε ένα τσιπάκι κειμένου)', () => {
    let notifications = 0;
    const unsubscribe = subscribeTileFidelity(() => { notifications += 1; });

    reportTileFidelity('plan', 3);
    reportTileFidelity('plan', 3);
    reportTileFidelity('plan', 3);
    unsubscribe();

    expect(notifications).toBe(1);
  });
});
