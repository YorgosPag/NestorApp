/**
 * ADR-366 Phase 9 / C.2 — Canvas-generated CanvasTexture cache for comment billboard sprites.
 *
 * 5 types × 4 statuses = 20 combinations, cached per devicePixelRatio.
 * Base canvas size: 32px × dpr. Circle + label, opacity from status.
 * No React, no store — pure canvas + Three.js CanvasTexture.
 */

import { CanvasTexture } from 'three';
import {
  COMMENT_STATUS_OPACITY,
  COMMENT_TYPE_COLORS,
  COMMENT_TYPE_LABELS,
} from './CommentBadgeIcon';
import type { CommentStatus, CommentType } from './bim-comment-types';

const BASE_SIZE = 32;

const _cache = new Map<string, CanvasTexture>();

function cacheKey(type: CommentType, status: CommentStatus, dpr: number): string {
  return `${type}_${status}_${dpr}`;
}

function buildTexture(type: CommentType, status: CommentStatus, dpr: number): CanvasTexture {
  const size = BASE_SIZE * dpr;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const opacity = COMMENT_STATUS_OPACITY[status];
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 1;

    ctx.globalAlpha = opacity;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = COMMENT_TYPE_COLORS[type];
    ctx.fill();

    ctx.lineWidth = Math.max(1, dpr);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.stroke();

    const fontSize = Math.round(size * 0.5);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(COMMENT_TYPE_LABELS[type], cx, cy + size * 0.04);
  }

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function getCommentTexture(
  type: CommentType,
  status: CommentStatus,
  dpr = 1,
): CanvasTexture {
  const key = cacheKey(type, status, dpr);
  const cached = _cache.get(key);
  if (cached) return cached;
  const texture = buildTexture(type, status, dpr);
  _cache.set(key, texture);
  return texture;
}

export function warmCommentTextureCache(dpr = 1): void {
  const types: readonly CommentType[] = ['issue', 'question', 'suggestion', 'approval', 'info'];
  const statuses: readonly CommentStatus[] = ['open', 'in_review', 'resolved', 'archived'];
  for (const type of types) {
    for (const status of statuses) {
      getCommentTexture(type, status, dpr);
    }
  }
}

export function disposeCommentTextures(): void {
  _cache.forEach((t) => t.dispose());
  _cache.clear();
}
