import { CONTEXTUAL_TEXT_EDITOR_TAB, TEXT_EDITOR_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-text-editor-tab';
import {
  CONTEXTUAL_ARRAY_RECT_TAB, CONTEXTUAL_ARRAY_POLAR_TAB,
  ARRAY_RECT_CONTEXTUAL_TRIGGER, ARRAY_POLAR_CONTEXTUAL_TRIGGER,
} from '../ui/ribbon/data/contextual-array-tab';

export const RIBBON_CONTEXTUAL_TABS = [
  CONTEXTUAL_TEXT_EDITOR_TAB,
  CONTEXTUAL_ARRAY_RECT_TAB,
  CONTEXTUAL_ARRAY_POLAR_TAB,
] as const;

type EntityLike = { type: string; params?: { kind?: string } };

export function resolveContextualTrigger(entity: EntityLike): string | null {
  if (entity.type === 'text' || entity.type === 'mtext') return TEXT_EDITOR_CONTEXTUAL_TRIGGER;
  if (entity.type === 'array') {
    return entity.params?.kind === 'polar'
      ? ARRAY_POLAR_CONTEXTUAL_TRIGGER
      : ARRAY_RECT_CONTEXTUAL_TRIGGER;
  }
  return null;
}
