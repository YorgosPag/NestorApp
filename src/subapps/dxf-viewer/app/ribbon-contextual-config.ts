import { CONTEXTUAL_TEXT_EDITOR_TAB, TEXT_EDITOR_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-text-editor-tab';
import {
  CONTEXTUAL_ARRAY_RECT_TAB, CONTEXTUAL_ARRAY_POLAR_TAB, CONTEXTUAL_ARRAY_PATH_TAB,
  ARRAY_RECT_CONTEXTUAL_TRIGGER, ARRAY_POLAR_CONTEXTUAL_TRIGGER, ARRAY_PATH_CONTEXTUAL_TRIGGER,
} from '../ui/ribbon/data/contextual-array-tab';
import { CONTEXTUAL_STAIR_TAB, STAIR_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-stair-tab';
import { DIMENSION_CONTEXTUAL_TAB, DIMENSION_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-dimension-tab';

export const RIBBON_CONTEXTUAL_TABS = [
  CONTEXTUAL_TEXT_EDITOR_TAB,
  CONTEXTUAL_ARRAY_RECT_TAB,
  CONTEXTUAL_ARRAY_POLAR_TAB,
  CONTEXTUAL_ARRAY_PATH_TAB,
  CONTEXTUAL_STAIR_TAB,
  DIMENSION_CONTEXTUAL_TAB,
] as const;

type EntityLike = { readonly type: string; readonly params?: unknown };

function readArrayKind(params: unknown): string | undefined {
  if (params && typeof params === 'object' && 'kind' in params) {
    const k = (params as { kind?: unknown }).kind;
    return typeof k === 'string' ? k : undefined;
  }
  return undefined;
}

export function resolveContextualTrigger(entity: EntityLike): string | null {
  if (entity.type === 'dimension') return DIMENSION_CONTEXTUAL_TRIGGER;
  if (entity.type === 'stair') return STAIR_CONTEXTUAL_TRIGGER;
  if (entity.type === 'text' || entity.type === 'mtext') return TEXT_EDITOR_CONTEXTUAL_TRIGGER;
  if (entity.type === 'array') {
    const kind = readArrayKind(entity.params);
    if (kind === 'polar') return ARRAY_POLAR_CONTEXTUAL_TRIGGER;
    if (kind === 'path') return ARRAY_PATH_CONTEXTUAL_TRIGGER;
    return ARRAY_RECT_CONTEXTUAL_TRIGGER;
  }
  return null;
}
