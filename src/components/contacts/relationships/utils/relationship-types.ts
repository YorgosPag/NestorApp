// ============================================================================
// ENTERPRISE RELATIONSHIP TYPES — UI CONFIGURATION (ADR-372)
// ============================================================================
//
// 🎨 Visual properties only (icon, label, color) for every RelationshipType.
// 🔗 Filtering logic is DELEGATED entirely to the SSoT in relationship-metadata.ts:
//    - getOfferedOrientedRoles(current, picked)      → oriented roles (ADR-372 §Β2,
//      relationship-orientation.ts — pure, so forms don't pull this UI module)
//    - labels: relationshipRoleLabelKey(type, side)   → locale files only (§Β1)
//
// ============================================================================

import {
  User,
  Crown,
  Briefcase,
  Users,
  UserCheck,
  Heart,
  ShieldCheck,
  Handshake,
  TrendingUp,
} from 'lucide-react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { hardcodedColorValues } from '@/design-system/tokens/colors';
import { getStatusColor } from '@/lib/design-system';
import { relationshipRoleLabelKey } from '@/types/contacts/relationships/core/relationship-orientation';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface RelationshipTypeConfig {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
}

// ============================================================================
// COLOR MAPPING
// ============================================================================

const getRelationshipColors = (colors?: ReturnType<typeof useSemanticColors>) => {
  if (!colors) {
    return {
      employment:   `${getStatusColor('info', 'bg')} text-primary`,
      ownership:    `${getStatusColor('success', 'bg')} text-[hsl(var(--text-success))]`,
      board:        'bg-[hsl(var(--bg-warning))]/40 text-[hsl(var(--text-warning))]',
      government:   'bg-accent text-foreground',
      professional: `${getStatusColor('info', 'bg')} text-primary`,
      partner:      'bg-[hsl(var(--bg-warning))]/40 text-[hsl(var(--text-warning))]',
      commercial:   `${hardcodedColorValues.background.gray[100]} text-muted-foreground`,
      competitor:   `${getStatusColor('error', 'bg')} text-destructive`,
      personal:     'bg-accent text-foreground',
      muted:        `${hardcodedColorValues.background.gray[100]} text-muted-foreground`,
    };
  }
  return {
    employment:   `${colors.bg.infoSubtle} ${colors.text.info}`,
    ownership:    `${colors.bg.successSubtle} ${colors.text.success}`,
    board:        `${colors.bg.warningSubtle} ${colors.text.warning}`,
    government:   `${colors.bg.accentSubtle} ${colors.text.accent}`,
    professional: `${colors.bg.infoSubtle} ${colors.text.info}`,
    partner:      `${colors.bg.warningSubtle} ${colors.text.warning}`,
    commercial:   `${colors.bg.muted} ${colors.text.muted}`,
    competitor:   `${colors.bg.errorSubtle} ${colors.text.error}`,
    personal:     `${colors.bg.accentSubtle} ${colors.text.accent}`,
    muted:        `${colors.bg.muted} ${colors.text.muted}`,
  };
};

// ============================================================================
// VISUAL CONFIG — ALL RELATIONSHIP TYPES
// ============================================================================

type VisualConfig = { icon: React.ComponentType<{ className?: string }>; colorKey: keyof ReturnType<typeof getRelationshipColors> };

const VISUAL_REGISTRY: Record<string, VisualConfig> = {
  // Employment
  employee:           { icon: User,       colorKey: 'employment' },
  manager:            { icon: Crown,      colorKey: 'employment' },
  director:           { icon: Crown,      colorKey: 'employment' },
  executive:          { icon: Crown,      colorKey: 'employment' },
  intern:             { icon: User,       colorKey: 'muted' },
  contractor:         { icon: Briefcase,  colorKey: 'employment' },

  // Ownership / Corporate
  shareholder:        { icon: TrendingUp, colorKey: 'ownership' },
  board_member:       { icon: Users,      colorKey: 'board' },
  chairman:           { icon: Crown,      colorKey: 'ownership' },
  ceo:                { icon: Crown,      colorKey: 'ownership' },
  partner:            { icon: Handshake,  colorKey: 'partner' },
  representative:     { icon: User,       colorKey: 'professional' },
  vendor:             { icon: Briefcase,  colorKey: 'commercial' },

  // Government
  civil_servant:      { icon: UserCheck,  colorKey: 'government' },
  department_head:    { icon: Crown,      colorKey: 'government' },
  ministry_official:  { icon: ShieldCheck,colorKey: 'government' },
  elected_official:   { icon: ShieldCheck,colorKey: 'government' },
  appointed_official: { icon: ShieldCheck,colorKey: 'government' },
  mayor:              { icon: ShieldCheck,colorKey: 'government' },
  deputy_mayor:       { icon: ShieldCheck,colorKey: 'government' },
  regional_governor:  { icon: ShieldCheck,colorKey: 'government' },

  // Professional (other)
  consultant:         { icon: User,       colorKey: 'professional' },
  competitor:         { icon: TrendingUp, colorKey: 'competitor' },
  business_contact:   { icon: Briefcase,  colorKey: 'muted' },

  // Personal
  mentor:             { icon: Heart,      colorKey: 'personal' },
  colleague:          { icon: Users,      colorKey: 'partner' },
  friend:             { icon: Heart,      colorKey: 'personal' },
  family:             { icon: Users,      colorKey: 'personal' },
  other:              { icon: User,       colorKey: 'muted' },

  // Property types (ADR-244) are managed by the property module — excluded from contact relationship dropdown.
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Full visual config for one relationship type.
 * Returns undefined for unknown types (user-created custom types).
 */
export const getRelationshipTypeConfig = (
  type: string,
  colors?: ReturnType<typeof useSemanticColors>
): RelationshipTypeConfig | undefined => {
  const visual = VISUAL_REGISTRY[type];
  if (!visual) return undefined;
  const colorMap = getRelationshipColors(colors);
  return {
    icon: visual.icon,
    label: relationshipRoleLabelKey(type, 'source'),
    color: colorMap[visual.colorKey],
  };
};

/**
 * Display properties for a relationship type (icon, label, color).
 * Falls back to a generic "other" style for unknown / custom types.
 */
export const getRelationshipDisplayProps = (
  type: string,
  colors?: ReturnType<typeof useSemanticColors>
) => {
  const config = getRelationshipTypeConfig(type, colors);
  if (config) return config;
  const colorMap = getRelationshipColors(colors);
  return {
    icon: User,
    color: colorMap.muted,
  };
};

// ============================================================================
// LEGACY EXPORT — full config map (used by some callers for iterating)
// ============================================================================

/**
 * @deprecated Prefer `getRelationshipTypeConfig(type)` per-key access.
 * Kept for callers that iterate the map. `allowedFor` removed — use SSoT.
 */
export const getRelationshipTypesConfig = (
  colors?: ReturnType<typeof useSemanticColors>
): Record<string, RelationshipTypeConfig> => {
  const out: Record<string, RelationshipTypeConfig> = {};
  for (const type of Object.keys(VISUAL_REGISTRY)) {
    const cfg = getRelationshipTypeConfig(type, colors);
    if (cfg) out[type] = cfg;
  }
  return out;
};
