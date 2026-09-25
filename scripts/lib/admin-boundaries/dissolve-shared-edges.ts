/**
 * @fileoverview **ΕΝΩΣΗ ΓΕΙΤΟΝΙΚΩΝ ΠΟΛΥΓΩΝΩΝ ΜΕ ΑΦΑΙΡΕΣΗ ΤΩΝ ΚΟΙΝΩΝ ΑΚΜΩΝ** — για τους δήμους του Κλεισθένη.
 * @related ADR-883 · `admin-boundary-source.ts` (`composeMunicipalitiesFromUnits`)
 * @module scripts/lib/admin-boundaries/dissolve-shared-edges
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΧΩΡΙΣ ΒΙΒΛΙΟΘΗΚΗ ΕΝΩΣΗΣ ΠΟΛΥΓΩΝΩΝ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Ένας δήμος του Κλεισθένη είναι η ένωση των δημοτικών του ενοτήτων. Αν δείχναμε τα
 * πολύγωνα των ενοτήτων αυτούσια, ο χάρτης θα ζωγράφιζε **και τα εσωτερικά τους
 * σύνορα** — ο επισκέπτης θα έβλεπε τρεις «δήμους» εκεί που ζήτησε έναν.
 *
 * Οι ενότητες προέρχονται από την **ίδια** τοπολογικά καθαρή πηγή (ίδιο layer, ίδια
 * ψηφιοποίηση): δύο γειτονικές ενότητες μοιράζονται την κοινή τους ακμή **με τις ίδιες
 * ακριβώς κορυφές**, σε αντίθετη φορά. Άρα η ένωση είναι συνδυαστική, όχι γεωμετρική:
 * **κάθε ακμή που εμφανίζεται δύο φορές είναι εσωτερική** — τη σβήνουμε, και οι ακμές
 * που μένουν ξαναδένονται σε δακτυλίους. Καμία τομή τμημάτων, καμία αριθμητική ανοχή.
 *
 * ⚠️ **Αν η υπόθεση δεν ισχύει** (κορυφές που δεν συμπίπτουν ακριβώς), η αλυσίδα δεν
 * κλείνει — και τότε επιστρέφεται `null`. Ο καλών κρατά τα πολύγωνα **αδιάλυτα**: το
 * όριο μένει **σωστό** (ίδιο έδαφος), απλώς με ορατές εσωτερικές γραμμές. Ποτέ λάθος
 * σχήμα για χάρη ομορφότερου.
 */

type Position = GeoJSON.Position;

function vertexKey(position: Position): string {
  return `${position[0]},${position[1]}`;
}

function openRing(ring: readonly Position[]): readonly Position[] {
  const first = ring[0];
  const last = ring[ring.length - 1];
  return ring.length >= 2 && first[0] === last[0] && first[1] === last[1] ? ring.slice(0, -1) : ring;
}

/** Διπλάσιο προσημασμένο εμβαδόν (shoelace) — το πρόσημο δίνει τη φορά του δακτυλίου. */
function signedArea(ring: readonly Position[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum;
}

/** Ο δακτύλιος με τη ζητούμενη φορά: `1` = αριστερόστροφος (εξωτερικός), `-1` = τρύπα. */
function orient(ring: readonly Position[], sign: 1 | -1): readonly Position[] {
  return Math.sign(signedArea(ring)) === sign ? ring : [...ring].reverse();
}

interface DirectedEdge {
  readonly from: Position;
  readonly to: Position;
}

/** Οι ακμές που **δεν** μοιράζονται με γειτονικό δακτύλιο — δηλαδή το εξωτερικό σύνορο. */
function boundaryEdges(rings: readonly (readonly Position[])[]): DirectedEdge[] {
  const count = new Map<string, number>();
  const edges: { edge: DirectedEdge; key: string }[] = [];

  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const from = ring[i];
      const to = ring[(i + 1) % ring.length];
      const a = vertexKey(from);
      const b = vertexKey(to);
      if (a === b) continue;
      // Κλειδί **χωρίς φορά**: η κοινή ακμή εμφανίζεται μία φορά από κάθε πλευρά.
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      count.set(key, (count.get(key) ?? 0) + 1);
      edges.push({ edge: { from, to }, key });
    }
  }

  return edges.filter(({ key }) => count.get(key) === 1).map(({ edge }) => edge);
}

/** Ξαναδένει τις ακμές σε κλειστούς δακτυλίους — ή `null` αν κάποια αλυσίδα δεν κλείνει. */
function chainRings(edges: readonly DirectedEdge[]): Position[][] | null {
  const outgoing = new Map<string, DirectedEdge[]>();
  for (const edge of edges) {
    const key = vertexKey(edge.from);
    const list = outgoing.get(key);
    if (list) list.push(edge);
    else outgoing.set(key, [edge]);
  }

  const rings: Position[][] = [];
  let remaining = edges.length;
  for (const start of edges) {
    const startList = outgoing.get(vertexKey(start.from));
    if (!startList?.includes(start)) continue;

    const ring: Position[] = [];
    let edge: DirectedEdge | undefined = start;
    while (edge !== undefined) {
      const list = outgoing.get(vertexKey(edge.from)) as DirectedEdge[];
      list.splice(list.indexOf(edge), 1);
      remaining -= 1;
      ring.push(edge.from);
      if (vertexKey(edge.to) === vertexKey(start.from)) break;
      edge = outgoing.get(vertexKey(edge.to))?.[0];
    }
    if (edge === undefined) return null;
    if (ring.length >= 3) rings.push(ring);
  }

  return remaining === 0 ? rings : null;
}

/**
 * Συναρμολογεί δακτυλίους σε `MultiPolygon`: οι **αριστερόστροφοι** είναι εξωτερικοί
 * (η φορά τους κανονικοποιήθηκε στην είσοδο και η αλυσίδα τη διατηρεί)· οι δεξιόστροφοι
 * είναι τρύπες και πάνε στον εξωτερικό που περιέχει την πρώτη τους κορυφή.
 */
function assemble(rings: readonly Position[][]): GeoJSON.MultiPolygon {
  const outers = rings.filter((ring) => signedArea(ring) > 0);
  const holes = rings.filter((ring) => signedArea(ring) <= 0);

  const polygons = outers.map((outer) => [outer]);
  for (const hole of holes) {
    const host = polygons.find(([outer]) => containsPoint(outer, hole[0]));
    if (host) host.push(hole);
  }

  const close = (ring: Position[]): Position[] => [...ring, ring[0]];
  return { type: 'MultiPolygon', coordinates: polygons.map((polygon) => polygon.map(close)) };
}

/** Ray casting — εδώ σε ωμές συντεταγμένες, αρκεί για το «ποιος εξωτερικός κρατά την τρύπα». */
function containsPoint(ring: readonly Position[], [x, y]: Position): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * **Διαλύει τα κοινά σύνορα** ενός `MultiPolygon` φτιαγμένου από γειτονικά πολύγωνα.
 *
 * @returns τη διαλυμένη γεωμετρία, ή `null` όταν η τοπολογία δεν επιτρέπει καθαρή ένωση —
 *   τότε ο καλών κρατά την αδιάλυτη (σωστό έδαφος, ορατές εσωτερικές γραμμές).
 */
export function dissolveSharedEdges(geometry: GeoJSON.MultiPolygon): GeoJSON.MultiPolygon | null {
  // 🔒 **Η φορά κανονικοποιείται ΠΡΙΝ τη μέτρηση**: η κοινή ακμή δύο γειτόνων εμφανίζεται
  //    με αντίθετη φορά **μόνο** αν και οι δύο δακτύλιοι έχουν την ίδια. Η πηγή (WFS) δεν
  //    το εγγυάται, και χωρίς αυτό η αλυσίδα δεν θα έκλεινε ποτέ.
  const rings = geometry.coordinates.flatMap((polygon) =>
    polygon.map((ring, index) => orient(openRing(ring), index === 0 ? 1 : -1)),
  );
  const chained = chainRings(boundaryEdges(rings));
  if (chained === null || chained.length === 0) return null;
  return assemble(chained);
}
