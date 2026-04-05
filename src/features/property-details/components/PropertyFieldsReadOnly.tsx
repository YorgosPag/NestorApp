'use client';
/* eslint-disable custom/no-hardcoded-strings */
/**
 * =============================================================================
 * 🏢 ENTERPRISE: Property Fields Read-Only Components
 * =============================================================================
 *
 * Extracted from PropertyFieldsBlock.tsx for SRP compliance (ADR N.7.1).
 * Contains: CompactField, ReadOnlyCompactView, LevelTabStrip.
 *
 * @module features/property-details/components/PropertyFieldsReadOnly
 * @since 2026-03-27
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Layers } from 'lucide-react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import '@/lib/design-system';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import type { Property } from '@/types/property-viewer';
import type { PropertyLevel } from '@/types/property';
import type { TFunction } from 'i18next';

// =============================================================================
// 🏢 ENTERPRISE: Compact Field (label:value row)
// =============================================================================

/** Single label:value row for compact view */
export function CompactField({ label, value }: { label: string; value: string | number | undefined }) {
  const colors = useSemanticColors();
  if (!value && value !== 0) return null;
  return (
    <dl className="flex items-baseline gap-1.5">
      <dt className={cn("text-xs whitespace-nowrap", colors.text.muted)}>{label}:</dt>
      <dd className="text-xs font-medium truncate">{String(value)}</dd>
    </dl>
  );
}

// =============================================================================
// 🏢 ENTERPRISE: Read-Only Compact View (Ευρετήριο Ακινήτων)
// =============================================================================

/** Compact plain-text view for read-only mode (Ευρετήριο) */
export function ReadOnlyCompactView({ property, t }: { property: Property; t: TFunction }) {
  const colors = useSemanticColors();
  const orientationLabels = (property.orientations ?? [])
    .map((o) => t(`orientation.short.${o}`, { defaultValue: o }))
    .join(', ');

  const flooringLabels = (property.finishes?.flooring ?? [])
    .map((f) => t(`finishes.flooring.${f}`, { defaultValue: f }))
    .join(', ');

  const interiorLabels = (property.interiorFeatures ?? [])
    .map((f) => t(`features.interior.${f}`, { defaultValue: f }))
    .join(', ');

  const securityLabels = (property.securityFeatures ?? [])
    .map((f) => t(`features.security.${f}`, { defaultValue: f }))
    .join(', ');

  return (
    <section className="flex flex-col gap-1 p-2">
      {/* Identity */}
      <CompactField label={t('fields.identity.name')} value={property.name} />
      <CompactField label={t('fields.identity.code')} value={property.code} />
      <CompactField
        label={t('fields.identity.type')}
        value={property.type ? t(`types.${property.type}`, { defaultValue: property.type }) : undefined}
      />
      <CompactField
        label={t('fields.identity.commercialStatus')}
        value={property.commercialStatus ? t(`commercialStatus.${property.commercialStatus}`, { defaultValue: property.commercialStatus }) : undefined}
      />
      {property.commercial?.askingPrice ? (
        <CompactField
          label={t('fields.commercial.askingPrice')}
          value={formatCurrencyWhole(property.commercial.askingPrice)}
        />
      ) : null}
      <CompactField
        label={t('dialog.addUnit.fields.status')}
        value={(() => {
          const opStatus = (property as unknown as Record<string, unknown>).operationalStatus;
          return opStatus
            ? t(`dialog.addUnit.statusOptions.${opStatus}`, { defaultValue: String(opStatus) })
            : undefined;
        })()}
      />

      {/* Areas */}
      {property.areas?.gross ? (
        <CompactField label={t('fields.areas.gross')} value={`${property.areas.gross} m²`} />
      ) : null}
      {property.areas?.net ? (
        <CompactField label={t('fields.areas.net')} value={`${property.areas.net} m²`} />
      ) : null}
      {property.areas?.balcony ? (
        <CompactField label={t('fields.areas.balcony')} value={`${property.areas.balcony} m²`} />
      ) : null}

      {/* Layout */}
      {property.layout?.bedrooms ? (
        <CompactField label={t('card.stats.bedrooms')} value={property.layout.bedrooms} />
      ) : null}
      {property.layout?.bathrooms ? (
        <CompactField label={t('card.stats.bathrooms')} value={property.layout.bathrooms} />
      ) : null}

      {/* Orientation */}
      {orientationLabels && (
        <CompactField label={t('orientation.sectionTitle')} value={orientationLabels} />
      )}

      {/* Condition & Energy */}
      {property.condition && (
        <CompactField label={t('condition.sectionTitle')} value={t(`condition.${property.condition}`, { defaultValue: property.condition })} />
      )}
      {property.energy?.class && (
        <CompactField label={t('energy.class')} value={property.energy.class} />
      )}

      {/* Systems */}
      {property.systemsOverride?.heatingType && (
        <CompactField label={t('systems.heating.label')} value={t(`systems.heating.${property.systemsOverride.heatingType}`, { defaultValue: property.systemsOverride.heatingType })} />
      )}
      {property.systemsOverride?.coolingType && (
        <CompactField label={t('systems.cooling.label')} value={t(`systems.cooling.${property.systemsOverride.coolingType}`, { defaultValue: property.systemsOverride.coolingType })} />
      )}

      {/* Finishes */}
      {flooringLabels && (
        <CompactField label={t('finishes.flooring.label')} value={flooringLabels} />
      )}
      {property.finishes?.windowFrames && (
        <CompactField label={t('finishes.frames.label')} value={t(`finishes.frames.${property.finishes.windowFrames}`, { defaultValue: property.finishes.windowFrames })} />
      )}

      {/* Features */}
      {interiorLabels && (
        <CompactField label={t('features.interior.label')} value={interiorLabels} />
      )}
      {securityLabels && (
        <CompactField label={t('features.security.label')} value={securityLabels} />
      )}

      {/* Description — full width */}
      {property.description && (
        <dl className="mt-1">
          <dt className={cn("text-xs", colors.text.muted)}>{t('fields.identity.description')}</dt>
          <dd className="text-xs mt-0.5">{property.description}</dd>
        </dl>
      )}
    </section>
  );
}

// =============================================================================
// 🏢 ENTERPRISE: Level Tab Strip (Multi-Level Navigation)
// =============================================================================

export function LevelTabStrip({
  levels,
  activeLevelId,
  onSelectLevel,
  t,
}: {
  levels: PropertyLevel[];
  activeLevelId: string | null;
  onSelectLevel: (id: string | null) => void;
  t: TFunction;
}) {
  const colors = useSemanticColors();
  const sorted = [...levels].sort((a, b) => a.floorNumber - b.floorNumber);

  return (
    <nav aria-label="Level tabs" className="flex items-center gap-1 rounded-md bg-muted/50 p-1">
      <Layers className={cn("h-3.5 w-3.5 shrink-0", colors.text.muted)} />
      {sorted.map((level) => (
        <Button
          key={level.floorId}
          type="button"
          variant={activeLevelId === level.floorId ? 'default' : 'ghost'}
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => onSelectLevel(level.floorId)}
        >
          {level.name}
        </Button>
      ))}
      <Button
        type="button"
        variant={activeLevelId === null ? 'default' : 'ghost'}
        size="sm"
        className="h-6 px-2 text-xs"
        onClick={() => onSelectLevel(null)}
      >
        {t('multiLevel.perLevel.tabTotals')} ✓
      </Button>
    </nav>
  );
}
