'use client';

/**
 * POEntitySelectors — Searchable selectors for PO form entities
 *
 * Three SearchableCombobox wrappers that load real Firestore data:
 *   - POProjectSelector: projects from useFirestoreProjects
 *   - POSupplierSelector: active supplier contacts from usePOSupplierContacts
 *   - POBuildingSelector: buildings from useFirestoreBuildings, filtered by projectId
 *
 * @module components/procurement/POEntitySelectors
 * @see ADR-267 §Phase D — Entity Selectors
 * @see ADR-001 — SearchableCombobox (Radix Popover, no Radix Select)
 */

import { useMemo } from 'react';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import type { ComboboxOption } from '@/components/ui/searchable-combobox-types';
import { useFirestoreProjects, type FirestoreProject } from '@/hooks/useFirestoreProjects';
import { useFirestoreBuildings } from '@/hooks/useFirestoreBuildings';
import { usePOSupplierContacts } from '@/hooks/procurement/usePOSupplierContacts';
import { getContactDisplayName } from '@/types/contacts/helpers';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// ============================================================================
// PROJECT SELECTOR
// ============================================================================

interface POProjectSelectorProps {
  value: string;
  /** Called with (projectId, project) — project used for delivery address auto-fill */
  onSelect: (projectId: string, project: FirestoreProject | null) => void;
  disabled?: boolean;
  error?: string;
}

export function POProjectSelector({
  value,
  onSelect,
  disabled,
  error,
}: POProjectSelectorProps) {
  const { t } = useTranslation('procurement');
  const { projects, loading } = useFirestoreProjects();

  const options = useMemo<ComboboxOption[]>(
    () =>
      projects.map((p) => ({
        value: p.id,
        label: p.name || p.title || p.id,
        secondaryLabel: p.status,
      })),
    [projects]
  );

  return (
    <SearchableCombobox
      value={value}
      onValueChange={(v) => {
        const project = projects.find((p) => p.id === v) ?? null;
        onSelect(v, project);
      }}
      options={options}
      placeholder={t('form.selectProject')}
      emptyMessage={t('form.noProject')}
      isLoading={loading}
      disabled={disabled}
      error={error}
    />
  );
}

// ============================================================================
// SUPPLIER SELECTOR
// ============================================================================

interface POSupplierSelectorProps {
  value: string;
  onSelect: (supplierId: string) => void;
  disabled?: boolean;
  error?: string;
}

export function POSupplierSelector({
  value,
  onSelect,
  disabled,
  error,
}: POSupplierSelectorProps) {
  const { t } = useTranslation('procurement');
  const { suppliers, loading } = usePOSupplierContacts();

  const options = useMemo<ComboboxOption[]>(
    () =>
      suppliers
        .filter((c): c is typeof c & { id: string } => typeof c.id === 'string')
        .map((c) => ({
          value: c.id,
          label: getContactDisplayName(c),
          secondaryLabel: c.type === 'company' ? c.companyName ?? undefined : undefined,
        })),
    [suppliers]
  );

  return (
    <SearchableCombobox
      value={value}
      onValueChange={(v) => onSelect(v)}
      options={options}
      placeholder={t('form.selectSupplier')}
      emptyMessage={t('form.noSupplier')}
      isLoading={loading}
      disabled={disabled}
      error={error}
    />
  );
}

// ============================================================================
// BUILDING SELECTOR
// ============================================================================

interface POBuildingSelectorProps {
  value: string;
  projectId: string | null;
  onSelect: (buildingId: string | null) => void;
  disabled?: boolean;
  error?: string;
}

export function POBuildingSelector({
  value,
  projectId,
  onSelect,
  disabled,
  error,
}: POBuildingSelectorProps) {
  const { t } = useTranslation('procurement');
  const { buildings, loading } = useFirestoreBuildings();

  // Filter buildings to only those belonging to the selected project
  const options = useMemo<ComboboxOption[]>(() => {
    if (!projectId) return [];
    return buildings
      .filter((b) => b.projectId === projectId)
      .map((b) => ({
        value: b.id,
        label: b.name || b.code || b.id,
        secondaryLabel: b.status,
      }));
  }, [buildings, projectId]);

  const isDisabled = disabled || !projectId;

  return (
    <SearchableCombobox
      value={value}
      onValueChange={(v) => onSelect(v || null)}
      options={options}
      placeholder={
        !projectId
          ? t('form.buildingDisabledNoProject')
          : t('form.selectBuilding')
      }
      emptyMessage={t('form.noBuilding')}
      isLoading={loading && !!projectId}
      disabled={isDisabled}
      error={error}
    />
  );
}
