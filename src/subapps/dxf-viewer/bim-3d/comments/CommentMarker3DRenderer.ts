/**
 * ADR-366 Phase 9 / C.2 — Three.js Sprite billboard manager for comment markers.
 *
 * Owns a Three.js Group with one Sprite per BimComment.
 * Caller syncs via update(comments, dpr) on BimCommentsStore change.
 * hitTest(raycaster) returns the commentId of the closest intersected sprite.
 *
 * No React, no store subscriptions — pure Three.js scene-graph object.
 * Ready-for-wiring: ThreeJsSceneManager adds root to scene + calls update().
 *
 * Mirror of Dimension3DRenderer pattern (ADR-366 Phase 9 / C.3).
 */

import { Group, Raycaster, Sprite, SpriteMaterial } from 'three';
import { disposeCommentTextures, getCommentTexture, warmCommentTextureCache } from './comment-marker-textures';
import type { BimComment } from './bim-comment-types';

const SPRITE_SCALE = 0.5;
const COMMENT_ID_KEY = 'commentId';

export interface CommentMarker3DRenderer {
  readonly root: Group;
  update(comments: readonly BimComment[], dpr?: number): void;
  hitTest(raycaster: Raycaster): string | null;
  dispose(): void;
}

export function createCommentMarker3DRenderer(): CommentMarker3DRenderer {
  const root = new Group();
  root.name = 'comment_markers';

  const sprites = new Map<string, Sprite>();

  function getOrCreateSprite(comment: BimComment, dpr: number): Sprite {
    const existing = sprites.get(comment.id);
    if (existing) return existing;
    const sprite = new Sprite(new SpriteMaterial({ transparent: true, depthTest: false }));
    sprite.userData[COMMENT_ID_KEY] = comment.id;
    sprite.scale.setScalar(SPRITE_SCALE);
    root.add(sprite);
    sprites.set(comment.id, sprite);
    return sprite;
  }

  function syncSprite(sprite: Sprite, comment: BimComment, dpr: number): void {
    const texture = getCommentTexture(comment.type, comment.status, dpr);
    const mat = sprite.material as SpriteMaterial;
    if (mat.map !== texture) {
      mat.map = texture;
      mat.needsUpdate = true;
    }
    const { x, y, z } = comment.anchor.position;
    sprite.position.set(x, y, z);
  }

  function removeStale(liveIds: ReadonlySet<string>): void {
    for (const [id, sprite] of sprites) {
      if (!liveIds.has(id)) {
        root.remove(sprite);
        (sprite.material as SpriteMaterial).dispose();
        sprites.delete(id);
      }
    }
  }

  return {
    root,

    update(comments, dpr = 1) {
      const liveIds = new Set(comments.map((c) => c.id));
      removeStale(liveIds);
      for (const comment of comments) {
        const sprite = getOrCreateSprite(comment, dpr);
        syncSprite(sprite, comment, dpr);
      }
    },

    hitTest(raycaster) {
      const targets = [...sprites.values()];
      if (targets.length === 0) return null;
      const hits = raycaster.intersectObjects(targets, false);
      if (hits.length === 0) return null;
      const id = hits[0].object.userData[COMMENT_ID_KEY] as string | undefined;
      return id ?? null;
    },

    dispose() {
      for (const sprite of sprites.values()) {
        root.remove(sprite);
        (sprite.material as SpriteMaterial).dispose();
      }
      sprites.clear();
      disposeCommentTextures();
    },
  };
}

export function warmCommentMarkers(dpr = 1): void {
  warmCommentTextureCache(dpr);
}
