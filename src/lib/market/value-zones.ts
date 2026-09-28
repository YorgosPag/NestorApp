/**
 * @fileoverview **Οι ζώνες αντικειμενικών αξιών στον browser** — τα αρχεία μιας περιοχής, φορτωμένα μία φορά.
 * @related ADR-889 §10 · `value-zone-file.ts` (σχήμα + αναγνώστης, ο ΙΔΙΟΣ με τον server) · `lib/geo/admin-boundaries.ts`
 *   (ίδιο ιδίωμα `LazyJsonSnapshot`)
 * @module lib/market/value-zones
 *
 * 🔑 **Ποια αρχεία τα αποφασίζει ο server** (`AreaMarketPageData.valueZoneFiles`): ο browser **δεν** κατεβάζει το
 * ευρετήριο (~90 KB) για να μάθει τι να ζητήσει.
 *
 * ⚠️ **Ένα αρχείο που δεν ήρθε ρίχνει ΟΛΗ τη στρώση** σε «μη διαθέσιμο»: μισός χάρτης ζωνών θα έδειχνε κενά σαν να
 * ήταν «εκτός συστήματος».
 */

import { createLazyJsonSnapshot, createLazySnapshot, type LazyJsonSnapshot } from '@/lib/data/lazy-json-snapshot';
import { createModuleLogger } from '@/lib/telemetry';

import { readValueZoneArea, valueZonesPublicPath, type ValueFront, type ValueZone, type ValueZoneArea } from './value-zone-file';

const logger = createModuleLogger('value-zones');

/** Ό,τι ζωγραφίζει ο χάρτης μιας περιοχής: οι ζώνες και τα μέτωπα **όλων** των αρχείων της. */
export interface ValueZoneLayer {
  readonly zones: readonly ValueZone[];
  readonly fronts: readonly ValueFront[];
}

const areaSources = new Map<string, LazyJsonSnapshot<ValueZoneArea>>();
const layerSources = new Map<string, LazyJsonSnapshot<ValueZoneLayer>>();

const logFailure = (what: string) => (error: unknown) => {
  logger.warn('Δεν φορτώθηκαν ζώνες αντικειμενικών αξιών', { what, error: error instanceof Error ? error.message : String(error) });
};

function areaSource(areaId: string): LazyJsonSnapshot<ValueZoneArea> {
  const existing = areaSources.get(areaId);
  if (existing !== undefined) return existing;
  const source = createLazyJsonSnapshot<ValueZoneArea>({
    url: `/${valueZonesPublicPath(areaId).join('/')}`,
    build: (payload) => {
      const area = readValueZoneArea(payload, areaId);
      if (area === null) throw new TypeError(`Οι ζώνες ${areaId} δεν έχουν το αναμενόμενο σχήμα`);
      return area;
    },
    onFailure: logFailure(areaId),
  });
  areaSources.set(areaId, source);
  return source;
}

/** Η στρώση για ένα σύνολο αρχείων — το ίδιο αντικείμενο για το ίδιο σύνολο (σταθερή ταυτότητα για το hook). */
export function valueZoneLayerSource(fileIds: readonly string[]): LazyJsonSnapshot<ValueZoneLayer> {
  const key = fileIds.join(',');
  const existing = layerSources.get(key);
  if (existing !== undefined) return existing;
  const source = createLazySnapshot<ValueZoneLayer>({
    produce: async () => {
      const sources = fileIds.map(areaSource);
      await Promise.all(sources.map((item) => item.load()));
      const areas = sources.map((item) => item.peek());
      if (areas.some((area) => area === null)) throw new Error(`Value-zone files not all loaded: ${key}`);
      const loaded = areas.filter((area): area is ValueZoneArea => area !== null);
      return { zones: loaded.flatMap((area) => area.zones), fronts: loaded.flatMap((area) => area.fronts) };
    },
    onFailure: logFailure(key),
  });
  layerSources.set(key, source);
  return source;
}
