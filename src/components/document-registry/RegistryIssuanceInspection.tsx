'use client';

/**
 * @fileoverview ADR-915 §45.15 — **ο υπεύθυνος αυτοψίας στο πάνελ του γραφείου**: ποιος (σύνδεσμος στην επαφή) ·
 *   ιδιότητα · πότε ορίστηκε, και το κουμπί ορισμού/αλλαγής. Αυτό που βλέπει εδώ το γραφείο είναι **ακριβώς** αυτό που
 *   θα δει ο μηχανικός μετά την ανάληψη (§45.10 «Στοιχεία εκτέλεσης»).
 * @related RegistryIssuanceStep.tsx (ο γονέας) · RegistryIssuanceDialogs.tsx (`IssuanceInspectionDialog`)
 * @module components/document-registry/RegistryIssuanceInspection
 */

import React from 'react';

import { IssuanceInspectionDialog } from '@/components/document-registry/RegistryIssuanceDialogs';
import { INSPECTION_ROLE_LABEL_KEYS, ISSUER_KEYS, REGISTRY_NS } from '@/components/document-registry/document-registry-labels';
import { INSPECTION_KEYS } from '@/components/document-registry/issuance-inspection-labels';
import type { RegistryIssuanceView } from '@/components/document-registry/registry-issuance';
import { ObligorPerson } from '@/components/document-registry/registry-links';
import { registryPersonOf } from '@/components/document-registry/registry-obligors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import type { IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';
import { currentInspectionContactOf } from '@/lib/document-validity/issuance-inspection-contact';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';

export interface RegistryIssuanceInspectionProps {
  readonly view: RegistryIssuanceView;
  readonly record: IssuanceAssignmentRecord;
  readonly registry: Pick<DocumentRegistryResponse, 'people'>;
  /** Μπορεί αυτός ο άνθρωπος να πράξει τώρα; (δικαίωμα + καμία εκκρεμής αποθήκευση) */
  readonly canAct: boolean;
}

export function RegistryIssuanceInspection({ view, record, registry, canAct }: RegistryIssuanceInspectionProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const current = currentInspectionContactOf(record);
  const leadId = view.lead?.kind === 'designated' ? view.lead.contactId : null;
  const leadPerson = leadId === null ? null : registryPersonOf(leadId, registry);
  const lead = leadPerson === null ? null : { contactId: leadPerson.contactId, name: leadPerson.name ?? t(ISSUER_KEYS.obligorUnnamed) };
  const role = current === null ? null : current.role === 'other' && current.roleOther !== null ? current.roleOther : t(INSPECTION_ROLE_LABEL_KEYS[current.role]);
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
      <span className="text-muted-foreground">{t(INSPECTION_KEYS.line)}</span>
      {current === null ? (
        <span className="text-muted-foreground">{t(INSPECTION_KEYS.none)}</span>
      ) : (
        <span>
          <ObligorPerson person={registryPersonOf(current.contactId, registry)} />
          {' '}
          <span className="text-muted-foreground">{`(${role}) · ${formatDate(current.at)}`}</span>
        </span>
      )}
      {canAct ? <IssuanceInspectionDialog view={view} current={current} lead={lead} /> : null}
    </div>
  );
}
