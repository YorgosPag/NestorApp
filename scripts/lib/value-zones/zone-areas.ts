/**
 * @fileoverview **Κάθε ζώνη στην περιοχή της** — σημείο-σε-πολύγωνο πάνω στα όρια του ADR-883, όχι ονόματα.
 * @related ADR-889 §10 · `lib/geo/admin-area-of-point.ts` (ο κριτής) · `zone-geometry.ts`
 *
 * 🔑 **Γιατί όχι τα `DIMOS` / `DIMOTIKI_E` της πηγής**: είναι **ονόματα** (όχι κωδικοί ΕΛΣΤΑΤ) — η σκάλα
 * αντιστοίχισης ονομάτων του ΜΑΜΑ (ADR-889 §4.1) χρειάστηκε 4 σκαλιά για 99,74%. Το εσωτερικό σημείο της ζώνης μέσα
 * στα **ίδια** όρια που κρίνουν τις αγγελίες δεν εξαρτάται από κανένα όνομα, και δίνει την περιοχή που θα έδειχνε ο χάρτης.
 *
 * 🔑 **Κλειδί αρχείου = Δημοτική Ενότητα, αλλιώς Δήμος** (87 δήμοι δεν έχουν Δ.Ε., ADR-890 §8) — οι δύο βαθμίδες της
 * σελίδας περιοχής (`AREA_MARKET_LEVELS`).
 *
 * ⚠️ Ζώνη που **διασχίζει** όριο Δ.Ε. μπαίνει **μόνο** στο αρχείο του εσωτερικού της σημείου. Ο server δεν επηρεάζεται
 * (διαλέγει αρχεία με bbox, όχι με περιοχή)· ο χάρτης μιας περιοχής δείχνει τις ζώνες **της**.
 */

import { assignAdminArea, type AdminAreaLookup } from '../../../src/lib/geo/admin-area-of-point';
import { geoJsonRings } from '../../../src/lib/geo/geo-geojson';
import { geoRingsNearestEdgeMetres } from '../../../src/lib/geo/geo-ring';
import { greekGridToGeoPoint } from '../../../src/lib/geo/greek-grid';
import type { ValueFrontRecord, ValueZoneRecord } from '../../../src/lib/market/value-zone-file';
import type { GeoPoint } from '../../../src/types/geo/coordinates';
import type { ShapeCoordinate } from './shapefile';
import { bboxOfPositions, gridInteriorPoint, groupGridPolygons, toGeoMultiLine, toGeoMultiPolygon } from './zone-geometry';
import type { SourceZone } from './zone-source';

/** Δ.Ε. — η λεπτότερη βαθμίδα της σελίδας περιοχής. */
const ZONE_AREA_LEVEL = 6;

export interface AreaZones {
  readonly zones: ValueZoneRecord[];
  readonly fronts: ValueFrontRecord[];
}

export interface ZoneAreaReport {
  /** Ζώνες που το εσωτερικό τους σημείο δεν πέφτει σε κανένα όριο (π.χ. στη θάλασσα, πέρα από την ανοχή). */
  readonly unassigned: { readonly kind: 'zone' | 'front'; readonly id: number }[];
  /** Ζώνες μικρότερες από την ανοχή απλοποίησης — μετρημένες, όχι σιωπηλά χαμένες. */
  readonly collapsed: number[];
}

/** Πόσες κορυφές δοκιμάζονται ως εφεδρικά σημεία — αρκετές για ακτογραμμή, λίγες για να μη βαραίνει ο γεννήτορας. */
const FALLBACK_SAMPLES = 8;

/**
 * Η περιοχή του **πρώτου** σημείου που πέφτει σε όριο. Το πρώτο είναι το αντιπροσωπευτικό (εσωτερικό σημείο ή σημείο
 * πάνω στο μέτωπο)· τα επόμενα είναι κορυφές της ζώνης. 🔑 Μετρημένο 2026-09-28: χωρίς εφεδρικά, **35** εγγραφές
 * (παράκτιες) έμεναν χωρίς περιοχή — το όριο του ADR-883 είναι κλίμακας 1:50.000 και απλοποιημένο, η ζώνη του ΥΠΕΘΟΟ
 * φτάνει ως την ακτή.
 */
async function areaOf(points: readonly ShapeCoordinate[], lookup: AdminAreaLookup): Promise<string | null> {
  for (const point of points) {
    const assignment = await assignAdminArea(greekGridToGeoPoint(point[0], point[1]), ZONE_AREA_LEVEL, lookup);
    const areaId = assignment?.municipalUnitId ?? assignment?.municipalityId ?? null;
    if (areaId !== null) return areaId;
  }
  return null;
}

/** Το αντιπροσωπευτικό σημείο και, μετά, έως {@link FALLBACK_SAMPLES} ισαπέχουσες κορυφές όλων των μερών. */
function withFallbacks(primary: ShapeCoordinate, parts: SourceZone['parts']): ShapeCoordinate[] {
  const vertices = parts.flat();
  const step = Math.max(1, Math.floor(vertices.length / FALLBACK_SAMPLES));
  const samples: ShapeCoordinate[] = [];
  for (let i = 0; i < vertices.length && samples.length < FALLBACK_SAMPLES; i += step) samples.push(vertices[i]);
  return [primary, ...samples];
}

function slotOf(byArea: Map<string, AreaZones>, areaId: string): AreaZones {
  const existing = byArea.get(areaId);
  if (existing !== undefined) return existing;
  const created: AreaZones = { zones: [], fronts: [] };
  byArea.set(areaId, created);
  return created;
}

async function placeZone(zone: SourceZone, toleranceM: number, lookup: AdminAreaLookup, byArea: Map<string, AreaZones>, report: ZoneAreaReport): Promise<void> {
  const polygons = groupGridPolygons(zone.parts);
  const geometry = polygons.length === 0 ? null : toGeoMultiPolygon(polygons, toleranceM);
  if (geometry === null) {
    report.collapsed.push(zone.id);
    return;
  }
  const areaId = await areaOf(withFallbacks(gridInteriorPoint(polygons), zone.parts), lookup);
  if (areaId === null) {
    report.unassigned.push({ kind: 'zone', id: zone.id });
    return;
  }
  const bbox = bboxOfPositions(geometry.coordinates.flat(2));
  slotOf(byArea, areaId).zones.push({ id: zone.id, name: zone.name, price: zone.price, validFrom: zone.validFrom, bbox, geometry });
}

/** Το μέσο της μεσαίας κορυφής του μακρύτερου μέρους — σημείο **πάνω** στο μέτωπο. */
function frontAnchor(parts: SourceZone['parts']): ShapeCoordinate {
  const longest = [...parts].sort((a, b) => b.length - a.length)[0];
  return longest[Math.floor(longest.length / 2)];
}

/**
 * Όσο μακριά μπορεί να είναι ένα μέτωπο από το τετράγωνο που πλαισιώνει: ένας φαρδύς παραλιακός δρόμος με πεζόδρομο.
 * Πέρα από αυτό, η ανάθεση θα ήταν μαντεψιά ⇒ «χωρίς περιοχή» στην αναφορά.
 */
const FRONT_TO_BLOCK_MAX_M = 150;

/**
 * **Εφεδρικό για παραλιακά μέτωπα**: η περιοχή της πλησιέστερης κυκλικής ζώνης. 🔑 Μετρημένο 2026-09-28: τα 10 τμήματα
 * που έμεναν χωρίς περιοχή είναι **όλα** παραλιακά («ΠΑΡΑΛΙΑΚΗ», «πρόσοψη στη θάλασσα») — κάθονται πάνω στην ακτή, έξω
 * από το όριο 1:50.000, ενώ το τετράγωνο που πλαισιώνουν είναι μέσα. Ένα μέτωπο ανήκει στο τετράγωνό του.
 */
function nearestZoneArea(point: GeoPoint, byArea: ReadonlyMap<string, AreaZones>): string | null {
  let best: { areaId: string; metres: number } | null = null;
  for (const [areaId, content] of byArea) {
    for (const zone of content.zones) {
      const metres = geoRingsNearestEdgeMetres(point, geoJsonRings(zone.geometry));
      if (metres <= FRONT_TO_BLOCK_MAX_M && (best === null || metres < best.metres)) best = { areaId, metres };
    }
  }
  return best?.areaId ?? null;
}

async function placeFront(front: SourceZone, lookup: AdminAreaLookup, byArea: Map<string, AreaZones>, report: ZoneAreaReport): Promise<void> {
  const geometry = toGeoMultiLine(front.parts);
  if (geometry === null) {
    report.collapsed.push(front.id);
    return;
  }
  const anchor = frontAnchor(front.parts);
  const areaId = (await areaOf(withFallbacks(anchor, front.parts), lookup)) ?? nearestZoneArea(greekGridToGeoPoint(anchor[0], anchor[1]), byArea);
  if (areaId === null) {
    report.unassigned.push({ kind: 'front', id: front.id });
    return;
  }
  const bbox = bboxOfPositions(geometry.coordinates.flat());
  const record = { id: front.id, name: front.name, price: front.price, validFrom: front.validFrom, street: front.description, bbox, geometry };
  slotOf(byArea, areaId).fronts.push(record);
}

/** Όλες οι ζώνες και τα μέτωπα, ανά περιοχή. Σειριακά: ο κριτής κρατά τα όρια στη μνήμη, η σειρά δεν αλλάζει το αποτέλεσμα. */
export async function assignZonesToAreas(
  source: { readonly zones: readonly SourceZone[]; readonly fronts: readonly SourceZone[] },
  toleranceM: number,
  lookup: AdminAreaLookup,
): Promise<{ byArea: Map<string, AreaZones>; report: ZoneAreaReport }> {
  const byArea = new Map<string, AreaZones>();
  const report: ZoneAreaReport = { unassigned: [], collapsed: [] };
  for (const zone of source.zones) await placeZone(zone, toleranceM, lookup, byArea, report);
  for (const front of source.fronts) await placeFront(front, lookup, byArea, report);
  return { byArea, report };
}
