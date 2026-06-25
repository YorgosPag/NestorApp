/**
 * ADR-533 — Χωρικό μάζεμα υποψήφιων DXF οντοτήτων (γραμμές + τόξα) κοντά σε έναν
 * τοίχο, ώστε ο {@link detectSymbolsOnWall} να δουλέψει σε μικρό σύνολο αντί σε
 * ολόκληρη τη σκηνή. Καθαρή συνάρτηση — ο caller δίνει το scene snapshot.
 *
 * Το AABB χτίζεται από τον άξονα του τοίχου (`params.start/end`) διευρυμένο κατά
 * `marginScene` (ο host περνά ~1.5 × πάχος σε scene units), που καλύπτει τις
 * παρειές + τα σύμβολα λίγο έξω από το πλαίσιο.
 *
 * @module bim/walls/dxf-symbol-gatherer
 */

import type { ArcEntity, LineEntity } from '../../types/entities';
import { isArcEntity, isLineEntity } from '../../types/entities';
import type { SceneModel } from '../../types/scene';
import type { WallEntity } from '../types/wall-types';
import { aabbIntersectsRaw } from '../../rendering/hitTesting/bounds-operations';

interface RawAabb {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

function lineBounds(l: LineEntity): RawAabb {
  return {
    minX: Math.min(l.start.x, l.end.x),
    minY: Math.min(l.start.y, l.end.y),
    maxX: Math.max(l.start.x, l.end.x),
    maxY: Math.max(l.start.y, l.end.y),
  };
}

function arcBounds(a: ArcEntity): RawAabb {
  // Συντηρητικό: ολόκληρος ο κύκλος (φθηνό + ασφαλές για culling).
  return {
    minX: a.center.x - a.radius,
    minY: a.center.y - a.radius,
    maxX: a.center.x + a.radius,
    maxY: a.center.y + a.radius,
  };
}

export function gatherSymbolCandidates(
  wall: WallEntity,
  scene: SceneModel,
  marginScene: number,
): Array<LineEntity | ArcEntity> {
  const s = wall.params.start;
  const e = wall.params.end;
  const minX = Math.min(s.x, e.x) - marginScene;
  const minY = Math.min(s.y, e.y) - marginScene;
  const maxX = Math.max(s.x, e.x) + marginScene;
  const maxY = Math.max(s.y, e.y) + marginScene;

  const out: Array<LineEntity | ArcEntity> = [];
  for (const ent of scene.entities) {
    if (isLineEntity(ent)) {
      const b = lineBounds(ent);
      if (aabbIntersectsRaw(minX, minY, maxX, maxY, b.minX, b.minY, b.maxX, b.maxY)) out.push(ent);
    } else if (isArcEntity(ent)) {
      const b = arcBounds(ent);
      if (aabbIntersectsRaw(minX, minY, maxX, maxY, b.minX, b.minY, b.maxX, b.maxY)) out.push(ent);
    }
  }
  return out;
}
