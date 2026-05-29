// ============================================================================
// ENTERPRISE RELATIONSHIP TYPES — UI CONFIGURATION (ADR-372)
// ============================================================================
//
// 🎨 Visual properties only (icon, label, color) for every RelationshipType.
// 🔗 Filtering logic is DELEGATED entirely to the SSoT in relationship-metadata.ts:
//    - getRelationshipTypesForCrossing(source, target)  → 2D matrix (ADR-372)
//    - allowedFor                                       → source-only (back-compat)
//
// ============================================================================

import type { ContactType } from '@/types/contacts';
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
import {
  getRelationshipTypesForCrossing,
  getRelationshipMetadata,
  type RelationshipTypeMetadata,
} from '@/types/contacts/relationships/core/relationship-metadata';

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

type VisualConfig = { icon: React.ComponentType<{ className?: string }>; label: string; colorKey: keyof ReturnType<typeof getRelationshipColors> };

const VISUAL_REGISTRY: Record<string, VisualConfig> = {
  // Employment
  employee:           { icon: User,       label: 'relationships.types.employee',        colorKey: 'employment' },
  manager:            { icon: Crown,      label: 'relationships.types.manager',         colorKey: 'employment' },
  director:           { icon: Crown,      label: 'relationships.types.director',        colorKey: 'employment' },
  executive:          { icon: Crown,      label: 'relationships.types.executive',       colorKey: 'employment' },
  intern:             { icon: User,       label: 'relationships.types.intern',          colorKey: 'muted' },
  contractor:         { icon: Briefcase,  label: 'relationships.types.contractor',      colorKey: 'employment' },

  // Ownership / Corporate
  shareholder:        { icon: TrendingUp, label: 'relationships.types.shareholder',     colorKey: 'ownership' },
  board_member:       { icon: Users,      label: 'relationships.types.boardMember',     colorKey: 'board' },
  chairman:           { icon: Crown,      label: 'relationships.types.chairman',        colorKey: 'ownership' },
  ceo:                { icon: Crown,      label: 'relationships.types.ceo',             colorKey: 'ownership' },
  partner:            { icon: Handshake,  label: 'relationships.types.partner',         colorKey: 'partner' },
  representative:     { icon: User,       label: 'relationships.types.representative',  colorKey: 'professional' },
  vendor:             { icon: Briefcase,  label: 'relationships.types.vendor',          colorKey: 'commercial' },
  client:             { icon: User,       label: 'relationships.types.client',          colorKey: 'commercial' },

  // Government
  civil_servant:      { icon: UserCheck,  label: 'relationships.types.civilServant',    colorKey: 'government' },
  department_head:    { icon: Crown,      label: 'relationships.types.departmentHead',  colorKey: 'government' },
  ministry_official:  { icon: ShieldCheck,label: 'relationships.types.ministryOfficial',colorKey: 'government' },
  elected_official:   { icon: ShieldCheck,label: 'relationships.types.electedOfficial', colorKey: 'government' },
  appointed_official: { icon: ShieldCheck,label: 'relationships.types.appointedOfficial',colorKey: 'government' },
  mayor:              { icon: ShieldCheck,label: 'relationships.types.mayor',           colorKey: 'government' },
  deputy_mayor:       { icon: ShieldCheck,label: 'relationships.types.deputyMayor',     colorKey: 'government' },
  regional_governor:  { icon: ShieldCheck,label: 'relationships.types.regionalGovernor',colorKey: 'government' },

  // Professional (other)
  consultant:         { icon: User,       label: 'relationships.types.consultant',      colorKey: 'professional' },
  advisor:            { icon: User,       label: 'relationships.types.advisor',         colorKey: 'professional' },
  supplier:           { icon: Briefcase,  label: 'relationships.types.supplier',        colorKey: 'commercial' },
  customer:           { icon: User,       label: 'relationships.types.customer',        colorKey: 'commercial' },
  competitor:         { icon: TrendingUp, label: 'relationships.types.competitor',      colorKey: 'competitor' },
  business_contact:   { icon: Briefcase,  label: 'relationships.types.businessContact', colorKey: 'muted' },

  // Personal
  mentor:             { icon: Heart,      label: 'relationships.types.mentor',          colorKey: 'personal' },
  protege:            { icon: User,       label: 'relationships.types.protege',         colorKey: 'personal' },
  colleague:          { icon: Users,      label: 'relationships.types.colleague',       colorKey: 'partner' },
  friend:             { icon: Heart,      label: 'relationships.types.friend',          colorKey: 'personal' },
  family:             { icon: Users,      label: 'relationships.types.family',          colorKey: 'personal' },
  other:              { icon: User,       label: 'relationships.types.other',           colorKey: 'muted' },

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
    label: visual.label,
    color: colorMap[visual.colorKey],
  };
};

/**
 * Returns all relationship type keys valid for the given crossing.
 *
 * When `targetType` is provided → ADR-372 bidirectional matrix (strict).
 * When `targetType` is omitted  → source-only filter (backward compat).
 */
export const getAvailableRelationshipTypes = (
  sourceType: ContactType,
  targetType?: ContactType,
  _colors?: ReturnType<typeof useSemanticColors>
): string[] => {
  if (targetType) {
    return getRelationshipTypesForCrossing(sourceType, targetType);
  }
  // Backward-compat: filter by source only (reads SSoT `allowedFor`).
  return Object.keys(VISUAL_REGISTRY).filter(type => {
    const meta: RelationshipTypeMetadata | undefined = getRelationshipMetadata(type);
    return meta ? meta.allowedFor.includes(sourceType) : false;
  });
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
    label: 'relationships.types.other',
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
