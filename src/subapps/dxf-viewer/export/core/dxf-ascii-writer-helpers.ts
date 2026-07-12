/**
 * ADR-505 §A / ADR-636 — pure resolution helpers for the DXF ASCII writer
 * (file-size SRP split, N.7.1 — mirror of the tables/hatch/text/primitive-emitter
 * splits that already live beside `dxf-ascii-writer.ts`).
 *
 * Two stateless derivations that the writer's entity loop consumes:
 *   • `resolveAci`        — entity/layer colour cascade → ACI index (code 62).
 *   • `collectTextStyles` — distinct STYLE table entries the TEXT/MTEXT reference.
 *
 * Zero React / DOM / Firestore deps.
 */

import type { Entity } from '../../types/entities';
import type { DxfStyleTableEntry } from '../../text-engine/types/text-ast.types';
import { hexToAci } from '../../ui/text-toolbar/controls/aci-palette';
// 🏢 Color-Conversion SSoT (ADR-573): int(0xRRGGBB)→hex via canonical `dxf-true-color`.
import { trueColorToHex } from '../../utils/dxf-true-color';
import { readTextEntityFamily, textStyleName } from './dxf-ascii-text-writer';
import type { DxfWriteLayer } from './dxf-ascii-writer';

const DEFAULT_ACI = 7; // white/black (ByLayer-ish fallback)

/**
 * Resolve an entity's display colour to an ACI index, mirroring the renderer's
 * cascade (colorTrueColor > colorAci > concrete hex > ByLayer → layer colour).
 */
export function resolveAci(e: Entity, layer: DxfWriteLayer | undefined): number {
  if (e.colorMode !== 'ByLayer') {
    if (e.colorTrueColor != null) return hexToAci(trueColorToHex(e.colorTrueColor));
    if (e.colorAci != null && e.colorAci > 0) return e.colorAci;
    if (e.color) return hexToAci(e.color);
  }
  if (layer) {
    if (layer.colorTrueColor != null) return hexToAci(trueColorToHex(layer.colorTrueColor));
    if (layer.colorAci != null && layer.colorAci > 0) return layer.colorAci;
    if (layer.color) return hexToAci(layer.color);
  }
  return DEFAULT_ACI;
}

/**
 * Collect the distinct STYLE table entries the TEXT/MTEXT entities reference — the inverse of
 * the import's `buildStyleFontMap`. Style name = font family (the ONE derivation `textStyleName`
 * shares with the per-entity group-7 code, so table and entities agree); `fontFile` = the family
 * verbatim (import strips the extension on the way in, so no synthetic `.shx` is fabricated). The
 * always-present `STANDARD` needs no entry (AutoCAD implicit) so font-less text adds nothing.
 */
export function collectTextStyles(entities: readonly Entity[]): DxfStyleTableEntry[] {
  const byName = new Map<string, DxfStyleTableEntry>();
  for (const e of entities) {
    if (e.type !== 'text' && e.type !== 'mtext') continue;
    const family = readTextEntityFamily(e);
    const name = textStyleName(family);
    if (name === 'STANDARD' || byName.has(name)) continue;
    byName.set(name, {
      name, fontFile: family, bigFontFile: '',
      height: 0, widthFactor: 1, obliqueAngle: 0, flags: 0, textGenerationFlags: 0,
    });
  }
  return [...byName.values()];
}
