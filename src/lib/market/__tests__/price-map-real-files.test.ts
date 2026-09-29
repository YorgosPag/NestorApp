/**
 * @jest-environment node
 *
 * ADR-890 §14 — **οι φρουροί πάνω στα ΠΡΑΓΜΑΤΙΚΑ αρχεία του `public/`**, όχι σε κατασκευασμένα δείγματα:
 *
 * 1. **Αντι-σάπιση των σταθερών ορίων** (§14.2): καμία κλάση δεν αδειάζει. Αν η αγορά ξεφύγει (το Λονδίνο πέρασε τις
 *    £500k και ο χάρτης LSOA επέκτεινε τις ζώνες του), αυτό κοκκινίζει και τα όρια αλλάζουν **συνειδητά**, με γραμμή
 *    στο ADR — ποτέ σιωπηλά με την επόμενη έκδοση των δεδομένων.
 * 2. **Κάθε περιοχή με τιμή έχει σχήμα στον χάρτη** — αλλιώς θα έμενε άβαφη χωρίς εξήγηση.
 * 3. **Το συγκεντρωτικό είναι ΠΡΟΒΟΛΗ του `summary/`** — ο χάρτης και η σελίδα περιοχής δεν διαφωνούν ποτέ.
 * 4. **§15 · §16 — τα αρχεία παιδιών είναι ΚΟΜΜΑΤΙΑ του αρχείου της βαθμίδας τους** (ίδια γεωμετρία, byte προς byte), και
 *    κάθε Περιφέρεια / Π.Ε. / Δήμος που η σελίδα θα ζητήσει χάρτη σύγκρισης (≥ `ADMIN_OVERVIEW_CHILDREN_MIN` παιδιά στο
 *    ευρετήριο) **τον έχει**.
 * 5. **§16 — η τιμή κάθε προγόνου ΞΑΝΑΥΠΟΛΟΓΙΣΤΗΚΕ από τις εγγραφές**: το πλήθος είναι προσθετικό (κάθε συμβόλαιο ανήκει
 *    σε ένα φύλλο), η διάμεσος δεν είναι — και σε πραγματικές Π.Ε. η διάμεσος διαμέσων απέχει έως 70% (Μαγνησία).
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ADMIN_AREA_INDEX_FILE, adminAreaChildrenIndex, readAdminAreaIndex } from '@/lib/geo/admin-area-index-file';
import {
  ADMIN_OVERVIEW_CHILDREN_MIN,
  adminOverviewChildrenPath,
  readAdminOverviewFile,
  type AdminOverviewFile,
} from '@/lib/geo/admin-overview-file';
import { ADMIN_LEVEL, type AdminArea } from '@/lib/geo/admin-area-index-file';
import { MARKET_TRANSACTIONS_PRICE_MAP_PUBLIC_PATH, marketTransactionsPublicPath, readAreaSummaryFile } from '@/lib/market/market-transactions-file';
import type { MarketSegment } from '@/lib/market/market-segments';
import { PRICE_MAP_BREAKS, priceMapCellOf, priceMapClassOf, priceMapMedian, readContractPriceMapFile } from '@/lib/market/price-map';

const PUBLIC = join(process.cwd(), 'public');
const read = (path: readonly string[]): unknown => JSON.parse(readFileSync(join(PUBLIC, ...path), 'utf8'));

const priceMap = readContractPriceMapFile(read(MARKET_TRANSACTIONS_PRICE_MAP_PUBLIC_PATH));
const overview = (tier: string): AdminOverviewFile | null => readAdminOverviewFile(read(['data', 'admin-overview', `${tier}.json`]));
const areaIndex = readAdminAreaIndex(read(ADMIN_AREA_INDEX_FILE.split('/')));
const childrenOf = adminAreaChildrenIndex(areaIndex);
const kidsAt = (area: AdminArea, level: number): readonly AdminArea[] => (childrenOf.get(area.id) ?? []).filter((kid) => kid.level === level);
const countOf = (id: string, segment: MarketSegment): number => priceMap?.areas[id]?.[segment]?.[0] ?? 0;

/** Ελάχιστο μερίδιο περιοχών ανά κλάση. Μετρημένο 2026-09-28: 10–35% σε κάθε τμήμα × βαθμίδα. */
const MIN_CLASS_SHARE = 0.05;
/** Κάτω από τόσες περιοχές με τιμή, ένα ποσοστό δεν λέει τίποτα — ο φρουρός σωπαίνει ρητά. */
const MIN_AREAS_FOR_SHARE = 30;

describe('price-map — πραγματικά αρχεία', () => {
  it('τα αρχεία διαβάζονται με το σχήμα τους (αλλιώς ο χάρτης λέει «μη διαθέσιμο» σε όλους)', () => {
    expect(priceMap).not.toBeNull();
    expect(overview('regional_unit')?.features.length).toBe(75);
    expect(overview('municipality')?.features.length).toBeGreaterThan(300);
    expect(overview('municipal_unit')?.features.length).toBeGreaterThan(1000);
  });

  it.each(Object.keys(PRICE_MAP_BREAKS.sale) as MarketSegment[])('αντι-σάπιση ορίων πώλησης: %s — καμία κλάση κάτω από 5%%', (segment) => {
    const breaks = PRICE_MAP_BREAKS.sale[segment] ?? [];
    const medians = Object.entries(priceMap?.areas ?? {})
      .filter(([id]) => id.startsWith('municipality:'))
      .map(([, segments]) => priceMapMedian(segments[segment]))
      .filter((median): median is number => median !== null);
    expect(medians.length).toBeGreaterThanOrEqual(MIN_AREAS_FOR_SHARE);
    const counts = [0, 0, 0, 0, 0];
    for (const median of medians) counts[priceMapClassOf(breaks, median)] += 1;
    for (const count of counts) expect(count / medians.length).toBeGreaterThanOrEqual(MIN_CLASS_SHARE);
  });

  it('κάθε περιοχή με τιμή έχει σχήμα στον χάρτη — ή καλύπτεται από Δήμο-φύλλο με τα ίδια νούμερα', () => {
    const tiers = ['regional_unit', 'municipality', 'municipal_unit'].flatMap((tier) => overview(tier)?.features ?? []);
    const drawn = new Set(tiers.map((f) => f.properties.id));
    // Οι Περιφέρειες δεν ζωγραφίζονται ποτέ ως παιδιά: η τιμή τους υπάρχει για την αναγωγή των Π.Ε. τους (§16).
    const missing = Object.keys(priceMap?.areas ?? {}).filter((id) => !drawn.has(id) && areaIndex.get(id)?.level !== ADMIN_LEVEL.region);
    // Η Δ.Ε. Νεμέας λείπει από την πηγή ορίων (μετρημένο 2026-09-28)· φύλλο της είναι ο Δήμος, με το ίδιο άθροισμα.
    expect(missing).toEqual(['municipal_unit:420401']);
    expect(priceMap?.areas['municipality:4204']).toEqual(priceMap?.areas['municipal_unit:420401']);
  });

  it('το συγκεντρωτικό είναι ΠΡΟΒΟΛΗ του 12μήνου των αρχείων περιοχής (δείγμα)', () => {
    for (const id of ['region:112', 'regional_unit:07', 'municipality:4501', 'municipality:0701', 'municipal_unit:010101']) {
      const summary = readAreaSummaryFile(read(marketTransactionsPublicPath('summary', id)), id);
      for (const [segment, value] of Object.entries(summary?.segments ?? {})) {
        expect(priceMap?.areas[id]?.[segment as MarketSegment] ?? null).toEqual(priceMapCellOf(value?.last12));
      }
    }
  });
});

describe('ADR-890 §16 — η τιμή κάθε προγόνου από τις ΕΓΓΡΑΦΕΣ (πραγματικά)', () => {
  const ancestors = [...areaIndex.values()].filter((area) => area.level >= ADMIN_LEVEL.region && area.level <= ADMIN_LEVEL.municipality);

  it.each(Object.keys(PRICE_MAP_BREAKS.sale) as MarketSegment[])('πλήθος προσθετικό σε κάθε βαθμίδα: %s', (segment) => {
    const broken: string[] = [];
    for (const area of ancestors) {
      const kids = kidsAt(area, area.level + 1);
      if (kids.length === 0) continue;
      const sum = kids.reduce((total, kid) => total + countOf(kid.id, segment), 0);
      if (sum !== countOf(area.id, segment)) broken.push(`${area.id}: ${countOf(area.id, segment)} ≠ Σ ${sum}`);
    }
    expect(broken).toEqual([]);
  });

  it('η διάμεσος της Π.Ε. ΔΕΝ είναι διάμεσος των διαμέσων των Δήμων της (αλλιώς θα ήταν σύνθεση, όχι υπολογισμός)', () => {
    const medianOf = (values: readonly number[]) => {
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };
    const differs = ancestors.filter((area) => area.level === ADMIN_LEVEL.regionalUnit).some((area) => {
      const own = priceMapMedian(priceMap?.areas[area.id]?.apartment);
      const kids = kidsAt(area, ADMIN_LEVEL.municipality).map((kid) => priceMapMedian(priceMap?.areas[kid.id]?.apartment));
      const reported = kids.filter((median): median is number => median !== null);
      return own !== null && reported.length >= 2 && Math.abs(medianOf(reported) - own) / own > 0.1;
    });
    expect(differs).toBe(true);
  });
});

describe('ADR-890 §15 · §16 — αρχεία παιδιών ανά γονέα (πραγματικά)', () => {
  const CHILDREN_DIR = join(PUBLIC, 'data', 'admin-overview', 'children');
  const childrenFile = (parentId: string): AdminOverviewFile | null => {
    const path = join(PUBLIC, ...adminOverviewChildrenPath(parentId).split('/'));
    return existsSync(path) ? readAdminOverviewFile(JSON.parse(readFileSync(path, 'utf8'))) : null;
  };
  const tierFeatures = new Map(
    ['regional_unit', 'municipality', 'municipal_unit'].map((tier) => [tier, new Map((overview(tier)?.features ?? []).map((f) => [f.properties.id, f]))]),
  );

  it('κάθε αρχείο: σχήμα, ίδια γεωμετρία με το αρχείο της βαθμίδας του, γονέας = ο γονέας του ονόματος, σημείο ετικέτας μέσα στο bbox', () => {
    const files = readdirSync(CHILDREN_DIR);
    expect(files.length).toBeGreaterThan(300);
    for (const name of files) {
      const parentId = name.replace(/\.json$/, '').replace('-', ':');
      const file = childrenFile(parentId);
      expect(file?.features.length).toBeGreaterThanOrEqual(ADMIN_OVERVIEW_CHILDREN_MIN);
      const national = tierFeatures.get(file?.tier ?? '');
      for (const feature of file?.features ?? []) {
        expect(feature.properties.parent).toBe(parentId);
        expect(areaIndex.get(feature.properties.id)?.parentId).toBe(parentId);
        expect(feature.geometry).toEqual(national?.get(feature.properties.id)?.geometry);
        const ring = feature.geometry.coordinates.flat(2);
        const [lon, lat] = feature.properties.label ?? [NaN, NaN];
        expect(lon).toBeGreaterThanOrEqual(Math.min(...ring.map((p) => p[0])));
        expect(lon).toBeLessThanOrEqual(Math.max(...ring.map((p) => p[0])));
        expect(lat).toBeGreaterThanOrEqual(Math.min(...ring.map((p) => p[1])));
        expect(lat).toBeLessThanOrEqual(Math.max(...ring.map((p) => p[1])));
      }
    }
  });

  it('κάθε Περιφέρεια / Π.Ε. / Δήμος που η σελίδα θα ζητήσει χάρτη σύγκρισης ΕΧΕΙ αρχείο, με ΟΛΑ τα παιδιά του ευρετηρίου', () => {
    const gaps: string[] = [];
    for (const area of areaIndex.values()) {
      if (area.level < ADMIN_LEVEL.region || area.level > ADMIN_LEVEL.municipality) continue;
      const kids = kidsAt(area, area.level + 1);
      if (kids.length < ADMIN_OVERVIEW_CHILDREN_MIN) continue;
      const drawn = new Set(childrenFile(area.id)?.features.map((feature) => feature.properties.id) ?? []);
      for (const kid of kids) if (!drawn.has(kid.id)) gaps.push(`${area.id} ⇒ ${kid.id}`);
    }
    expect(gaps).toEqual([]);
  });
});
