'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Users, Plus, X } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { ContactRelationshipService } from '@/services/contact-relationships/ContactRelationshipService';
import { generateOrgMemberId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import type { OrgMember } from '@/types/org/org-structure';
import type { ContactWithRelationship } from '@/types/contacts/relationships';

const logger = createModuleLogger('ImportFromRelationshipsBanner');

interface ImportFromRelationshipsBannerProps {
  contactId: string;
  existingMemberContactIds: string[];
  hasAnyDepartment: boolean;
  onImport: (members: OrgMember[]) => void;
}

/**
 * ADR-326 Phase 5 — Bridge banner.
 * Loads existing employee/manager/director relationships pointing TO this company contact
 * and offers a one-click import as L2 OrgMembers (mode='linked', userId=null per G8).
 */
export function ImportFromRelationshipsBanner({
  contactId,
  existingMemberContactIds,
  hasAnyDepartment,
  onImport,
}: ImportFromRelationshipsBannerProps) {
  const { t } = useTranslation('org-structure');
  const [candidates, setCandidates] = useState<ContactWithRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const employees = await ContactRelationshipService.getOrganizationEmployees(contactId, false);
        if (!cancelled) setCandidates(employees);
      } catch (err) {
        logger.error('Failed to load employee relationships', { contactId, err });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  const importable = candidates.filter(
    (c) => c.contact?.id && !existingMemberContactIds.includes(c.contact.id),
  );

  const handleImport = useCallback(() => {
    const members: OrgMember[] = importable.map((c) => ({
      id: generateOrgMemberId(),
      // Display name resolves on next contact-page render via mode='linked' lookup;
      // fallback to contactId so the row is never blank in the in-memory draft.
      displayName: c.contact?.id ?? '',
      mode: 'linked',
      contactId: c.contact?.id ?? null,
      userId: null,
      role: 'employee',
      reportsTo: null,
      isDepartmentHead: false,
      receivesNotifications: false,
      emails: [],
      phones: [],
      status: 'active',
    }));
    onImport(members);
  }, [importable, onImport]);

  if (loading || dismissed || importable.length === 0) return null;

  return (
    <section className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
          <Users className="h-4 w-4" aria-hidden="true" />
          <span>{t('importBanner.title')}</span>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-blue-700 hover:text-blue-900"
          aria-label={t('importBanner.dismissAria')}
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <p className="mt-1 text-xs text-blue-800">
        {t('importBanner.message', { count: importable.length })}
      </p>
      <div className="mt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleImport}
          disabled={!hasAnyDepartment}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {hasAnyDepartment
            ? t('importBanner.confirm')
            : t('importBanner.needDepartmentFirst')}
        </Button>
      </div>
    </section>
  );
}

export default ImportFromRelationshipsBanner;
