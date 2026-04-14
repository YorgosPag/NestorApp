/**
 * 🏢 ENTITY ACTION PRESETS — Enterprise Standard
 *
 * Κεντρικοποιημένα presets για action buttons σε entity headers.
 * Single Source of Truth για χρώματα, icons και styling.
 *
 * | Action  | Color   | Gradient Key     |
 * |---------|---------|------------------|
 * | edit    | Blue    | BLUE             |
 * | save    | Green   | GREEN            |
 * | cancel  | Gray    | GRAY             |
 * | delete  | Red     | RED              |
 * | trash   | Gray    | GRAY             | soft-delete (move to trash)
 * | new     | Green   | GREEN            |
 * | view    | Primary | PRIMARY_BUTTON   |
 * | print   | Gray    | GRAY             |
 */

import { GRADIENT_HOVER_EFFECTS } from '@/components/ui/effects';
import { Pencil, Save, X, Trash2, Plus, Eye, Printer } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { EntityHeaderAction } from './UnifiedEntityHeaderSystem';

// ===== TYPES =====

type ActionType = 'edit' | 'save' | 'cancel' | 'delete' | 'trash' | 'new' | 'view' | 'print';

interface EntityActionPreset {
  icon: LucideIcon;
  className: string;
}

// ===== PRESETS =====

const ENTITY_ACTION_PRESETS: Record<ActionType, EntityActionPreset> = {
  edit:   { icon: Pencil,  className: `${GRADIENT_HOVER_EFFECTS.BLUE} text-white` },
  save:   { icon: Save,    className: `${GRADIENT_HOVER_EFFECTS.GREEN} text-white` },
  cancel: { icon: X,       className: `${GRADIENT_HOVER_EFFECTS.GRAY} text-white` },
  delete: { icon: Trash2,  className: `${GRADIENT_HOVER_EFFECTS.RED} text-white` },
  trash:  { icon: Trash2,  className: `${GRADIENT_HOVER_EFFECTS.GRAY} text-white` },
  new:    { icon: Plus,    className: `${GRADIENT_HOVER_EFFECTS.GREEN} text-white` },
  view:   { icon: Eye,     className: GRADIENT_HOVER_EFFECTS.PRIMARY_BUTTON },
  print:  { icon: Printer, className: `${GRADIENT_HOVER_EFFECTS.GRAY} text-white` },
};

// ===== FACTORY =====

/**
 * Creates a standardized entity header action with consistent styling.
 *
 * @example
 * createEntityAction('edit', t('header.edit'), onStartEdit)
 * createEntityAction('new', t('header.new'), onNew, { icon: UserPlus })
 */
function createEntityAction(
  type: ActionType,
  label: string,
  onClick: () => void,
  overrides?: Partial<Pick<EntityHeaderAction, 'icon' | 'className' | 'variant'>>
): EntityHeaderAction {
  const preset = ENTITY_ACTION_PRESETS[type];
  return {
    label,
    onClick,
    icon: overrides?.icon ?? preset.icon,
    className: overrides?.className ?? preset.className,
    ...(overrides?.variant ? { variant: overrides.variant } : {}),
  };
}

export { ENTITY_ACTION_PRESETS, createEntityAction };
export type { ActionType, EntityActionPreset };
