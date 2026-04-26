'use client';

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { OrgStructureTab } from '@/components/settings/company/OrgStructureTab';
import { ImportFromRelationshipsBanner } from './ImportFromRelationshipsBanner';
import { generateOrgStructureId } from '@/services/enterprise-id.service';
import type { OrgStructure, OrgMember } from '@/types/org/org-structure';
import type { ContactFormData } from '@/types/ContactFormTypes';

interface ContactOrgStructureTabProps {
  formData: ContactFormData;
  setFormData?: (data: ContactFormData) => void;
  disabled: boolean;
  /** Currently authenticated user — written to `updatedBy` in-memory before server-side overwrite. */
  userId?: string;
}

/**
 * ADR-326 Phase 5 — L2 contact-embedded org structure UI.
 *
 * Wraps L1 OrgStructureTab for in-memory edits stored on `formData.orgStructure`.
 * Server enforces userId === null for every L2 member (G8); this component also strips it pre-save.
 * Bridge banner imports existing employee relationships as OrgMembers (mode='linked').
 */
export function ContactOrgStructureTab({
  formData,
  setFormData,
  disabled,
  userId,
}: ContactOrgStructureTabProps) {
  const { t } = useTranslation('org-structure');

  const orgStructure = formData.orgStructure ?? null;
  const isEmpty = !orgStructure || orgStructure.departments.length === 0;

  const handleSave = useCallback(
    (updated: OrgStructure) => {
      if (!setFormData) return;
      const sanitized: OrgStructure = {
        ...updated,
        id: updated.id || generateOrgStructureId(),
        departments: updated.departments.map((d) => ({
          ...d,
          members: d.members.map((m) => ({ ...m, userId: null })),
        })),
        updatedAt: new Date(),
        updatedBy: userId ?? '',
      };
      setFormData({ ...formData, orgStructure: sanitized });
    },
    [formData, setFormData, userId],
  );

  const handleImportMembers = useCallback(
    (newMembers: OrgMember[]) => {
      if (!setFormData) return;
      const baseStructure: OrgStructure = orgStructure ?? {
        id: generateOrgStructureId(),
        departments: [],
        updatedAt: new Date(),
        updatedBy: userId ?? '',
      };
      const targetDept = baseStructure.departments[0];
      if (!targetDept) return;
      const updated: OrgStructure = {
        ...baseStructure,
        departments: baseStructure.departments.map((d) =>
          d.id === targetDept.id
            ? { ...d, members: [...d.members, ...newMembers] }
            : d,
        ),
        updatedAt: new Date(),
        updatedBy: userId ?? '',
      };
      setFormData({ ...formData, orgStructure: updated });
    },
    [formData, setFormData, orgStructure, userId],
  );

  return (
    <div className="space-y-4">
      <p className="text-xs italic text-muted-foreground">
        {t('orgStructure.l2.contactScopedNote')}
      </p>

      {formData.id && !disabled && (
        <ImportFromRelationshipsBanner
          contactId={formData.id}
          existingMemberContactIds={
            orgStructure?.departments.flatMap((d) =>
              d.members.filter((m) => m.contactId).map((m) => m.contactId as string),
            ) ?? []
          }
          hasAnyDepartment={!isEmpty}
          onImport={handleImportMembers}
        />
      )}

      <OrgStructureTab
        orgStructure={orgStructure}
        saving={disabled}
        onSave={handleSave}
      />
    </div>
  );
}

export default ContactOrgStructureTab;
