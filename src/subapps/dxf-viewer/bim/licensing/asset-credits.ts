/**
 * Third-party asset credits aggregator (SSoT) — ADR-409 §B-θετικό.2.
 *
 * Collects the licence + attribution metadata that already lives next to each
 * shippable third-party asset and normalises it into a single flat list the
 * in-app Credits screen renders. CC-BY assets carry a MANDATORY visible creator
 * attribution (legal obligation); CC0 assets are grouped per source for provenance.
 *
 * The provenance SSoT stays in each domain registry — this module only READS:
 *   - `FURNITURE_CATALOG` / `SANITARY_MESH_CATALOG` / `APPLIANCE_MESH_CATALOG` → free-form `source` strings
 *     (`"<Title> by <Author> (CC-BY) — <url>"` or `"Poly Haven (CC0)"`).
 *   - `TEXTURE_SET_DEFS`  → structured `license` + `attribution`.
 *   - `HDRI_PRESETS`      → Poly Haven CC0 environment maps.
 *
 * Pure (no React / i18n / three) so it is trivially unit-testable.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-409-third-party-bim-library-licensing-policy.md §B-θετικό.2
 */

import { FURNITURE_CATALOG } from '../furniture/furniture-catalog';
import { SANITARY_MESH_CATALOG } from '../mep-fixtures/sanitary-fixture-mesh-catalog';
import { APPLIANCE_MESH_CATALOG } from '../mep-fixtures/appliance-fixture-mesh-catalog';
import { TEXTURE_SET_DEFS } from '../materials/bim-texture-registry';
import { HDRI_PRESETS } from '../../bim-3d/lighting/hdri-environment';

export type AssetLicense = 'CC0' | 'CC-BY';

/** One displayable credit row. */
export interface AssetCredit {
  /** Asset/model title (CC-BY) or the source name (CC0 group). */
  readonly title: string;
  /** Creator / library name. */
  readonly author: string;
  readonly license: AssetLicense;
  /** Source URL — present (and legally required) for CC-BY assets. */
  readonly url?: string;
  /** Number of assets from this source (CC0 groups only). */
  readonly count?: number;
}

/**
 * Parse a free-form catalog `source` string into a structured credit.
 * Recognised shapes:
 *   - `"Mid Century Modern Sofa by Tom Seddon (CC-BY) — sketchfab.com/…"`
 *   - `"Poly Haven (CC0)"`
 */
function parseSourceString(source: string): AssetCredit {
  const license: AssetLicense = /\(CC-?BY\)/i.test(source) ? 'CC-BY' : 'CC0';
  const dashIdx = source.indexOf('—');
  const url = dashIdx >= 0 ? source.slice(dashIdx + 1).trim() : undefined;
  const head = (dashIdx >= 0 ? source.slice(0, dashIdx) : source)
    .replace(/\(CC-?BY\)|\(CC0\)/gi, '')
    .trim();
  const byIdx = head.toLowerCase().lastIndexOf(' by ');
  if (byIdx >= 0) {
    return {
      title: head.slice(0, byIdx).trim(),
      author: head.slice(byIdx + 4).trim(),
      license,
      url,
    };
  }
  return { title: head, author: head, license };
}

/** Every third-party `source`-style string across the shippable registries. */
function collectSourceStrings(): readonly string[] {
  return [
    ...FURNITURE_CATALOG.map((p) => p.source),
    ...SANITARY_MESH_CATALOG.map((p) => p.source),
    ...APPLIANCE_MESH_CATALOG.map((p) => p.source),
    ...Object.values(TEXTURE_SET_DEFS).map(
      (d) => `${d.attribution ?? 'Unknown'} (${d.license})`,
    ),
    ...HDRI_PRESETS.map(() => 'Poly Haven (CC0)'),
  ];
}

/**
 * Build the flat credits list. CC-BY assets come FIRST (legal attribution
 * obligation), each listed individually + sorted by title; CC0 assets are grouped
 * per source with a count, sorted by source name.
 */
export function collectAssetCredits(): readonly AssetCredit[] {
  const parsed = collectSourceStrings().map(parseSourceString);

  const ccBy = parsed
    .filter((c) => c.license === 'CC-BY')
    .sort((a, b) => a.title.localeCompare(b.title));

  const cc0Counts = new Map<string, number>();
  for (const c of parsed) {
    if (c.license === 'CC0') {
      cc0Counts.set(c.author, (cc0Counts.get(c.author) ?? 0) + 1);
    }
  }
  const cc0 = [...cc0Counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([author, count]): AssetCredit => ({ title: author, author, license: 'CC0', count }));

  return [...ccBy, ...cc0];
}
