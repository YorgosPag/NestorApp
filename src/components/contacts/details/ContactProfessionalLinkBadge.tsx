'use client';

/**
 * @fileoverview **Ο λογαριασμός πίσω από την επαφή**, στην κεφαλίδα της επαφής (ADR-915 §40).
 * @module components/contacts/details/ContactProfessionalLinkBadge
 *
 * Σήμα «Συνδεδεμένος λογαριασμός» / «Πρόσκληση σε αναμονή», τι ανέλαβε (έγγραφο ή ρόλος — ακίνητο · κατάσταση) και τι
 * δήλωσε **ο ίδιος** — όλα **παραγόμενα** από τις συμμετοχές, καμία εγγραφή στην επαφή.
 * 🔑 «Δεν ξέρω» (`undefined`) ή `none` ⇒ **τίποτα** στην οθόνη: η απουσία σήματος δεν ισχυρίζεται τίποτα. Η ανάγνωση
 *    (`useContactProfessionalLink`) ζει στην κεφαλίδα· εδώ μόνο η όψη, τεμπέλικα, με τα κείμενά της στο chunk.
 * ⚠️ Χωρίς «Υιοθέτηση στοιχείων»: η επαφή δεν έχει πεδίο για τον αριθμό ΥΠΕΝ (ADR-915 §40.4) — μόνο εμφάνιση.
 */

import React from 'react';
import { useTranslation, type Translate } from '@/i18n/hooks/useTranslation';
import { Badge } from '@/components/ui/badge';
import { CASE_INVITE_ROLE_KEY } from '@/components/case-invite/case-invite-labels';
import { ISSUANCE_SPACE_KEYS } from '@/components/conveyance/my-cases/issuance-space-labels';
import { DOCUMENT_KIND_LABEL_KEYS } from '@/components/document-registry/document-registry-labels';
import { REGISTRY_AUTHORITY_PRESENTATION } from '@/constants/professional-registries';
import { isLegalEngagementRole } from '@/types/engagement';
import type { ContactProfessionalAssignment, ContactProfessionalLink } from '@/types/contact-professional-link';
import { ENGAGEMENT_STATE_KEYS, PROFESSIONAL_LINK_KEYS } from './contact-professional-link-labels';


/** Τι ανέλαβε: το **έγγραφο** σε ανάθεση έκδοσης, ο **ρόλος** σε μεταβίβαση. */
function subjectLabelOf(assignment: ContactProfessionalAssignment, t: Translate): string {
  if (assignment.kind === 'document_issuance') {
    return assignment.documentKind ? t(DOCUMENT_KIND_LABEL_KEYS[assignment.documentKind]) : t(ISSUANCE_SPACE_KEYS.unknownDocument);
  }
  return isLegalEngagementRole(assignment.role) ? t(CASE_INVITE_ROLE_KEY[assignment.role]) : '';
}

function AssignmentLine({ assignment, t }: { readonly assignment: ContactProfessionalAssignment; readonly t: Translate }) {
  const property = assignment.propertyName ?? t(ISSUANCE_SPACE_KEYS.untitledProperty);
  return (
    <li>
      {subjectLabelOf(assignment, t)} — {property}
      <span className="text-muted-foreground"> · {t(ENGAGEMENT_STATE_KEYS[assignment.state])}</span>
    </li>
  );
}

function LinkFacts({ link, t }: { readonly link: ContactProfessionalLink; readonly t: Translate }) {
  const declared = link.declared;
  return (
    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      <dt className="text-muted-foreground">{t(PROFESSIONAL_LINK_KEYS.assignmentsLabel)}</dt>
      <dd className="m-0">
        <ul className="m-0 list-none p-0">
          {link.assignments.map((a) => <AssignmentLine key={a.engagementId} assignment={a} t={t} />)}
        </ul>
      </dd>
      {declared && (
        <>
          <dt className="text-muted-foreground">{t(PROFESSIONAL_LINK_KEYS.declaredLabel)}</dt>
          <dd className="m-0">
            {t(PROFESSIONAL_LINK_KEYS.declaredValue, {
              registry: t(REGISTRY_AUTHORITY_PRESENTATION[declared.authority].abbreviationKey),
              number: declared.number,
            })}
          </dd>
        </>
      )}
    </dl>
  );
}

/** Φορτώνεται τεμπέλικα (`ContactLinkSurfaces`) — ο καλών την αποδίδει **μόνο** για `linked` / `offered`. */
export function ContactProfessionalLinkBadge({ link }: { readonly link: ContactProfessionalLink }) {
  const { t } = useTranslation(['contacts-core', 'conveyance', 'document-registry', 'legality', 'property-market']);
  if (link.status === 'none') return null;
  const linked = link.status === 'linked';
  return (
    <section aria-label={t(PROFESSIONAL_LINK_KEYS.region)} className="flex flex-col gap-2 px-6 pb-3 text-sm">
      <header className="flex flex-wrap items-center gap-2">
        <Badge variant={linked ? 'success' : 'info'}>
          {t(linked ? PROFESSIONAL_LINK_KEYS.linked : PROFESSIONAL_LINK_KEYS.offered)}
        </Badge>
        {link.actingForOffice && <span className="text-muted-foreground">{t(PROFESSIONAL_LINK_KEYS.actingForOffice)}</span>}
      </header>
      <LinkFacts link={link} t={t} />
    </section>
  );
}
