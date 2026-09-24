/**
 * **Το κλικ στον χάρτη καταχωρίσεων — δεμένο ΜΙΑ φορά, κρινόμενο από ΕΝΑΝ κριτή** (ADR-777 §8.76).
 *
 * 🔑 Η **απόφαση** («τι εννοούσε ο άνθρωπος;») ζει στο καθαρό `lib/maps/map-pick.ts`, όπου
 * μπορεί να κοκκινίσει σε test. Εδώ ζει μόνο η **συρραφή** με τη βιβλιοθήκη: ερώτημα
 * σχημάτων, ασύγχρονα αιτήματα της πηγής, κίνηση κάμερας.
 *
 * ⚠️ **ΕΝΑΣ χειριστής `click`, όχι ένας ανά επίπεδο.** Με έξι χειριστές (ένας ανά επίπεδο +
 * το «κενό») ένα κλικ σε πινέζα με δακτύλιο πυροδοτούσε **δύο** επιλογές, και κανείς δεν
 * μπορούσε να δει ότι κάτω από τον δείκτη υπήρχαν **δύο αγγελίες**.
 */

import { cameraFraming } from '@/lib/geo/camera-motion';
import {
  CLUSTER_PICK_LAYERS,
  PICKABLE_LAYER_IDS,
  POINT_PICK_LAYERS,
  AREA_PICK_LAYERS,
  clusterTargetZoom,
  resolveMapPick,
  zoomCanSeparate,
  type PickHit,
} from '@/lib/maps/map-pick';
import type { GeoPoint } from '@/types/geo/coordinates';

import { POINT_SOURCE_ID } from './ResultsMapSources';
import {
  isClusterSource,
  listingIdOf,
  type MapEventTarget,
  type MapPointerEvent,
  type RenderedFeature,
} from './results-map-contract';

/** **Πολλές αγγελίες στο ίδιο σημείο** — ο άνθρωπος διαλέγει από λίστα (§8.76). */
export interface ListingMapStack {
  readonly ids: readonly string[];
  readonly point: GeoPoint;
}

export interface MapPickHandlers {
  readonly onPeek?: (id: string | null) => void;
  readonly onSelect?: (id: string) => void;
  readonly onClear?: () => void;
  /** Άνοιγμα λίστας διαλέγματος — ή `null`: **κάθε** κλικ στον χάρτη κλείνει την προηγούμενη. */
  readonly onStack?: (stack: ListingMapStack | null) => void;
}
interface MapPickHandlersRef { readonly current: MapPickHandlers }

/**
 * Το κλικ σε ομάδα **ταξιδεύει**: ο άνθρωπος κοιτούσε τον χάρτη (`travel`)· στην άκρη
 * κάθονται πινακίδες (`label`)· το κάδρο μπορεί να είναι σημείο (`suggested` = 15 =
 * `CLUSTER_MAX_ZOOM + 1`, δηλαδή το ζουμ όπου **καμία** ομάδα δεν υπάρχει πια).
 */
const { padding: CLUSTER_PADDING, maxZoom: CLUSTER_CEILING, ...CLUSTER_FLIGHT } =
  cameraFraming('travel', 'label', 'suggested');

function toPickHit(feature: RenderedFeature): PickHit | null {
  const layerId = feature.layer?.id;
  if (layerId === undefined) return null;
  return { layerId, properties: feature.properties ?? {} };
}

function pointOf(feature: RenderedFeature): readonly [number, number] | null {
  const coordinates = feature.geometry?.type === 'Point' ? feature.geometry.coordinates : null;
  if (!Array.isArray(coordinates)) return null;
  const [lng, lat] = coordinates;
  return typeof lng === 'number' && typeof lat === 'number' ? [lng, lat] : null;
}

function boundsOf(points: readonly (readonly [number, number])[]): [[number, number], [number, number]] {
  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
}

interface ClusterClick {
  readonly clusterId: number;
  readonly pointCount: number;
  readonly event: MapPointerEvent;
}

/**
 * **Ζουμ στην ομάδα — ή λίστα, αν το ζουμ δεν μπορεί να τη χωρίσει.**
 *
 * 🔴 **Ασύγχρονο ⇒ ο φρουρός `isCurrent` είναι υποχρεωτικός.** Ένα δεύτερο κλικ, ή μια
 * ζωντανή ενημέρωση της πηγής (`setData` ακυρώνει τα `cluster_id`), πριν απαντήσει η πηγή
 * ⇒ η παλιά απάντηση **δεν** κινεί την κάμερα. Η απόρριψη για άκυρο `cluster_id` είναι
 * **αναμενόμενη** (η ομάδα δεν υπάρχει πια) και σημαίνει ακριβώς «τίποτα να κάνεις».
 */
async function expandCluster(
  target: MapEventTarget,
  click: ClusterClick,
  handlersRef: MapPickHandlersRef,
  isCurrent: () => boolean,
): Promise<void> {
  const source = target.getSource(POINT_SOURCE_ID);
  if (!isClusterSource(source)) return;

  const [expansionZoom, leaves] = await Promise.all([
    source.getClusterExpansionZoom(click.clusterId),
    source.getClusterLeaves(click.clusterId, click.pointCount, 0),
  ]).catch(() => [null, null] as const);
  if (expansionZoom === null || leaves === null || !isCurrent()) return;

  const points = leaves.map(pointOf).filter((p): p is readonly [number, number] => p !== null);
  if (!zoomCanSeparate(points, CLUSTER_CEILING)) {
    // Άγκυρα = η **αληθινή** θέση των σημείων, όχι το σημείο του κλικ (η κουκκίδα έχει ακτίνα).
    const [[west, south], [east, north]] = boundsOf(points);
    const anchor = points.length > 0 ? { lng: (west + east) / 2, lat: (south + north) / 2 } : click.event.lngLat;
    emitStack(leaves.map((leaf) => leaf.properties?.id), anchor, handlersRef);
    return;
  }

  const camera = target.cameraForBounds(boundsOf(points), { padding: CLUSTER_PADDING });
  const zoom = clusterTargetZoom(camera?.zoom ?? null, expansionZoom, CLUSTER_CEILING);
  const center = camera?.center ?? click.event.lngLat;
  if (center === undefined) return;
  /*
    🔑 **Το `originalEvent` ταξιδεύει ως `eventData`** ⇒ το `moveend` το κουβαλά ⇒ το
    `bindAreaReporting` το αναγνωρίζει ως κίνηση **του ανθρώπου** (το ζήτησε με το κλικ του),
    άρα το «Αναζήτηση καθώς μετακινώ» ανταποκρίνεται όπως στο σύρσιμο — Zillow/Redfin.
  */
  target.flyTo({ center, zoom, ...CLUSTER_FLIGHT }, { originalEvent: click.event.originalEvent });
}

function emitStack(
  ids: readonly unknown[],
  lngLat: { lng: number; lat: number } | undefined,
  handlersRef: MapPickHandlersRef,
): void {
  const distinct = [...new Set(ids.filter((id): id is string => typeof id === 'string'))];
  if (lngLat === undefined || distinct.length === 0) return;
  // Νέο διάλεγμα ⇒ η παλιά φούσκα φεύγει: δύο αιωρούμενες επιφάνειες στο ίδιο κάδρο θα μάλωναν.
  handlersRef.current.onClear?.();
  handlersRef.current.onStack?.({ ids: distinct, point: { lng: lngLat.lng, lat: lngLat.lat } });
}

function bindHover(target: MapEventTarget, handlersRef: MapPickHandlersRef): void {
  /*
    🔴 **`mousemove` ΚΑΙ ΟΧΙ ΜΟΝΟ `mouseenter`.** Δύο γειτονικές πινέζες ζουν στο **ίδιο**
    επίπεδο: περνώντας από τη μία στην άλλη δεν υπάρχει νέο `mouseenter`, άρα η επισήμανση
    θα κόλλαγε στην πρώτη. Ο έλεγχος ταυτότητας στο `useListingFocus.peek` κόβει την επανάληψη.
  */
  for (const layerId of [...POINT_PICK_LAYERS, ...AREA_PICK_LAYERS]) {
    target.on('mousemove', layerId, (event) => {
      target.getCanvas().style.cursor = 'pointer';
      handlersRef.current.onPeek?.(listingIdOf(event));
    });
    target.on('mouseleave', layerId, () => {
      target.getCanvas().style.cursor = '';
      handlersRef.current.onPeek?.(null);
    });
  }
  // Η ομάδα **είναι** στόχος πια ⇒ «χεράκι» — αλλά **όχι** peek: δεν είναι μία αγγελία.
  for (const layerId of CLUSTER_PICK_LAYERS) {
    target.on('mousemove', layerId, () => { target.getCanvas().style.cursor = 'pointer'; });
    target.on('mouseleave', layerId, () => { target.getCanvas().style.cursor = ''; });
  }
}

/**
 * Κλικ / πέρασμα δείκτη — **μόνο** αν υπάρχει καταναλωτής επιλογής.
 *
 * ⚠️ Χωρίς `onSelect` **δεν δένεται τίποτα**: δείκτης «χεράκι» χωρίς αποτέλεσμα είναι
 * υπόσχεση που δεν τηρείται (οθόνη 3, μία αγγελία).
 */
export function bindMapPick(target: MapEventTarget, handlersRef: MapPickHandlersRef): void {
  if (!handlersRef.current.onSelect) return;
  bindHover(target, handlersRef);

  let clickSeq = 0;
  target.on('click', (event: MapPointerEvent) => {
    const seq = ++clickSeq;
    // Κάθε κλικ στον χάρτη **τελειώνει** ένα εκκρεμές διάλεγμα — ακόμη και αυτό που θα ανοίξει νέο.
    handlersRef.current.onStack?.(null);
    const hits = target.queryRenderedFeatures(event.point, { layers: PICKABLE_LAYER_IDS })
      .map(toPickHit)
      .filter((hit): hit is PickHit => hit !== null);
    const pick = resolveMapPick(hits);

    if (pick.kind === 'none') handlersRef.current.onClear?.();
    else if (pick.kind === 'listing') handlersRef.current.onSelect?.(pick.id);
    else if (pick.kind === 'stack') emitStack(pick.ids, event.lngLat, handlersRef);
    else void expandCluster(target, { ...pick, event }, handlersRef, () => seq === clickSeq);
  });
}
