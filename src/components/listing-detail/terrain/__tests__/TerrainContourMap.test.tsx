/**
 * ADR-920 Β4.8 — ο χάρτης εδάφους πάνω σε ΑΛΗΘΙΝΑ στιγμιότυπα (`buildListingTerrainSnapshot`), με τα ΑΛΗΘΙΝΑ ελληνικά κλειδιά:
 * το `t` εδώ διαβάζει το `el/listing-detail.json` και **πετά** σε κλειδί που λείπει — ένα ωμό κλειδί στην οθόνη (CHECK 3.8 /
 * 3.51) κοκκινίζει εδώ πρώτα.
 *
 *   - `PLANE`: 10 % προς ανατολάς ⇒ μία κλάση (5–15 %), ισοϋψείς ανά 0,1 m, κύριες ανά 0,5 m.
 *   - `STEP_PLOT`: επίπεδο ως x = 15 m, μετά 20 % ⇒ 75 % / 25 % του ΕΜΒΑΔΟΥ σε δύο κλάσεις.
 */

import { render, screen, within } from '@testing-library/react';

import el from '@/i18n/locales/el/listing-detail.json';
import { formatNumber, formatPercentage } from '@/lib/intl-formatting';
import type { TopoPoint } from '@/lib/terrain/terrain-types';
import { buildListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-snapshot';
import type { ListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-types';
import { terrainMapModelOf, type TerrainMapModel } from '@/lib/terrain/publication/terrain-map-model';

import { TerrainContourMap } from '../TerrainContourMap';
import { terrainSlopeFillClass } from '../terrain-map-palette';

type Dict = { readonly [key: string]: string | Dict };

function lookup(key: string): string {
  const [ns, path] = key.split(':');
  if (ns !== 'listing-detail') throw new Error(`unexpected namespace in ${key}`);
  const value = path.split('.').reduce<string | Dict | undefined>(
    (node, part) => (node !== undefined && typeof node !== 'string' ? node[part] : undefined), el as Dict,
  );
  if (typeof value !== 'string') throw new Error(`missing i18n key ${key}`);
  return value;
}

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, values: Record<string, string | number> = {}) =>
      lookup(key).replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`)),
  }),
}));

const E0 = 400_000_000;
const N0 = 4_200_000_000;
const every = (from: number, to: number, step: number): number[] =>
  Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => from + i * step);

function snapshotOf(xs: readonly number[], ys: readonly number[], zMmAt: (xM: number) => number): ListingTerrainSnapshot {
  const points: TopoPoint[] = xs.flatMap((x) => ys.map((y) => ({ x: E0 + x * 1000, y: N0 + y * 1000, z: zMmAt(x) })));
  const result = buildListingTerrainSnapshot({ points, boundaryWorldMm: null, envelope: null });
  if (!result.ok) throw new Error(`expected a snapshot, got ${result.reason}`);
  return result.snapshot;
}

const PLANE = terrainMapModelOf(snapshotOf(every(0, 20, 2), every(0, 20, 2), (x) => 120_000 + 100 * x));
const STEP_PLOT = terrainMapModelOf(
  snapshotOf([...every(0, 15, 5), ...every(16, 20, 1)], every(0, 20, 5), (x) => (x <= 15 ? 120_000 : 120_000 + 200 * (x - 15))),
);

function renderMap(model: TerrainMapModel) {
  const view = render(<TerrainContourMap model={model} />);
  const svg = view.container.querySelector('svg[data-terrain-map]');
  if (svg === null) throw new Error('no map svg');
  return { ...view, svg };
}

describe('TerrainContourMap — σχέδιο', () => {
  it('figure με SVG `role="img"` που ονομάζεται από τίτλο + περιγραφή (με ισοδιάσταση και κλίμακα)', () => {
    const { container } = renderMap(PLANE);
    expect(container.querySelector('figure > figcaption')).not.toBeNull();
    const img = screen.getByRole('img', { name: /Χάρτης εδάφους/u });
    expect(img.getAttribute('viewBox')).toBe(
      `${PLANE.viewBox.minX} ${PLANE.viewBox.minY} ${PLANE.viewBox.width} ${PLANE.viewBox.height}`,
    );
    const desc = img.querySelector('desc')?.textContent ?? '';
    const interval = formatNumber(0.1, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    expect(desc).toContain(lookup('listing-detail:terrain.map.metres').replace('{value}', interval));
    expect(desc).toContain(`${PLANE.scaleBar.lengthM} m`);
  });

  it('μία περιοχή ανά ΜΗ κενή κλάση, `evenodd`, με το γέμισμα της παλέτας', () => {
    const { svg } = renderMap(STEP_PLOT);
    const drawn = STEP_PLOT.slopeRegions.filter((region) => region.pathData.length > 0);
    const paths = svg.querySelectorAll('[data-terrain-layer="slope"] path');
    expect(paths).toHaveLength(drawn.length);
    drawn.forEach((region, index) => {
      expect(paths[index].getAttribute('fill-rule')).toBe('evenodd');
      expect(paths[index].getAttribute('class')).toBe(terrainSlopeFillClass(region.classIndex));
    });
  });

  it('ισοϋψείς: περίβλημα ΚΑΤΩ από το μελάνι, πάχος σε px της οθόνης (non-scaling)', () => {
    const { svg } = renderMap(PLANE);
    const major = svg.querySelectorAll('[data-terrain-line="contourMajor"] path');
    expect(major).toHaveLength(2);
    expect(major[0].getAttribute('class')).toContain('stroke-white');
    expect(Number(major[0].getAttribute('stroke-width'))).toBeGreaterThan(Number(major[1].getAttribute('stroke-width')));
    for (const path of major) expect(path.getAttribute('vector-effect')).toBe('non-scaling-stroke');
  });

  it('ετικέτες: υψόμετρο στη γλώσσα του αναγνώστη, με την ακρίβεια της ισοδιάστασης, όρθια περιστροφή', () => {
    const { svg } = renderMap(PLANE);
    const labels = [...svg.querySelectorAll('[data-terrain-layer="labels"] text')];
    expect(labels.length).toBe(PLANE.contourLabels.length);
    expect(labels.length).toBeGreaterThan(0);
    const first = PLANE.contourLabels[0];
    expect(labels[0].textContent).toBe(formatNumber(first.levelM, { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
    expect(labels[0].getAttribute('transform')).toBe(`rotate(${first.angleDeg} ${first.x} ${first.y})`);
  });

  it('βορράς με γράμμα «Β» και κλίμακα με `parts` εναλλάξ τμήματα και «0 … N m»', () => {
    const { svg } = renderMap(PLANE);
    expect(svg.querySelector('[data-terrain-layer="north"] text')?.textContent).toBe('Β');
    const scale = svg.querySelector('[data-terrain-layer="scale"]');
    expect(scale?.querySelectorAll('rect')).toHaveLength(PLANE.scaleBar.parts);
    expect([...(scale?.querySelectorAll('text') ?? [])].map((text) => text.textContent))
      .toEqual(['0', `${PLANE.scaleBar.lengthM} m`]);
  });

  it('έκταση αποτύπωσης πάντα· όριο οικοπέδου μόνο όταν υπάρχει', () => {
    expect(renderMap(PLANE).svg.querySelector('[data-terrain-line="extent"]')).not.toBeNull();
    expect(renderMap(PLANE).svg.querySelector('[data-terrain-line="boundary"]')).toBeNull();
    const bounded = { ...PLANE, boundaryPathData: PLANE.extentPathData };
    expect(renderMap(bounded).svg.querySelector('[data-terrain-line="boundary"]')).not.toBeNull();
  });
});

describe('TerrainContourMap — αραιή περιοχή και σημάνσεις', () => {
  it('διαγράμμιση μόνο όταν υπάρχει αραιή περιοχή — και το γέμισμα δείχνει σε ΥΠΑΡΚΤΟ pattern', () => {
    const plain = { ...PLANE, sparsePathData: null };
    expect(renderMap(plain).svg.querySelector('[data-terrain-pattern]')).toBeNull();
    const { svg } = renderMap({ ...PLANE, sparsePathData: PLANE.extentPathData });
    const pattern = svg.querySelector('pattern[data-terrain-pattern="sparse"]');
    const fill = svg.querySelector('[data-terrain-layer="sparse"]')?.getAttribute('fill');
    expect(fill).toBe(`url(#${pattern?.getAttribute('id')})`);
    expect(pattern?.getAttribute('id')).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/u);
  });

  it('σταυρός = αντίφαση, δαχτυλίδι = σύμπτωση — σχήμα, όχι χρώμα', () => {
    const model = terrainMapModelOf(snapshotOf(every(0, 20, 2), every(0, 20, 2), (x) => 120_000 + 100 * x), [
      { x: 0, y: 0, kind: 'conflicting' }, { x: 2, y: 2, kind: 'coincident' },
    ]);
    const { svg } = renderMap(model);
    expect(svg.querySelectorAll('[data-terrain-layer="marks"] [data-terrain-mark="conflicting"] path')).toHaveLength(2);
    expect(svg.querySelectorAll('[data-terrain-layer="marks"] [data-terrain-mark="coincident"] circle')).toHaveLength(2);
  });

  it('χωρίς σημάνσεις (δημόσια αγγελία) δεν υπάρχει στρώμα σημάνσεων', () => {
    expect(renderMap(PLANE).svg.querySelector('[data-terrain-layer="marks"]')).toBeNull();
  });
});

describe('TerrainContourMap — πίνακας και υπόμνημα', () => {
  it('πίνακας: ΟΛΕΣ οι κλάσεις (και οι κενές), εύρος + % εμβαδού, ανοιχτή η τελευταία', () => {
    renderMap(STEP_PLOT);
    const table = screen.getByRole('table', { name: lookup('listing-detail:terrain.map.slope.caption') });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(STEP_PLOT.slopeRegions.length);
    STEP_PLOT.slopeRegions.forEach((region, index) => {
      expect(rows[index].textContent).toContain(formatPercentage(region.areaShare * 100));
    });
    expect(rows[rows.length - 1].textContent).toContain('και άνω');
    expect(STEP_PLOT.slopeRegions.some((region) => region.areaShare === 0)).toBe(true);
  });

  it('το δείγμα του πίνακα έχει ΤΟ ΙΔΙΟ γέμισμα με την περιοχή του χάρτη', () => {
    const { container } = renderMap(STEP_PLOT);
    for (const region of STEP_PLOT.slopeRegions) {
      const swatch = container.querySelector(`[data-terrain-swatch="slope-${region.classIndex}"] rect:last-child`);
      expect(swatch?.getAttribute('class')).toBe(terrainSlopeFillClass(region.classIndex));
    }
  });

  it('ένδειξη «ενδεικτικές» ορατή (Α6)', () => {
    renderMap(PLANE);
    expect(screen.getByText(lookup('listing-detail:terrain.map.indicative'))).toBeTruthy();
  });

  it('υπόμνημα: μόνο όσα σύμβολα υπάρχουν στον χάρτη', () => {
    const { container } = renderMap(PLANE);
    const swatches = [...container.querySelectorAll('figcaption li [data-terrain-swatch]')].map((node) => node.getAttribute('data-terrain-swatch'));
    expect(swatches).toEqual(['contourMinor', 'contourMajor', 'extent', ...(PLANE.sparsePathData === null ? [] : ['sparse'])]);
  });
});
