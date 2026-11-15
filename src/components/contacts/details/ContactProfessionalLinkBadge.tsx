'use client';

/**
 * @fileoverview **Ο λογαριασμός πίσω από την επαφή**, στην κεφαλίδα της επαφής (ADR-915 §40).
 * @module components/contacts/details/ContactProfessionalLinkBadge
 *
 * Σήμα «Συνδεδεμένος λογαριασμός» / «Πρόσκληση σε αναμονή», τι ανέλαβε (έγγραφο ή ρόλος — ακίνητο · κατάσταση) και τι
 * δήλωσε **ο ίδιος** — όλα **παραγόμενα** από τις συμμετοχές, καμία εγγραφή στην επαφή.
 * 🔑 «Δεν ξέρω» (`undefined`) ή `none` ⇒ **τίποτα** στην οθόνη: η απουσία σήματος δεν ισχυρίζεται τίποτα. Η ανάγνωση
 *    (`useContactProfessionalLink`) ζει στην κεφαλίδα· εδώ μόνο η όψη, τεμπέλικα, με τα κείμενά της στο chunk.
 * 🔑 Δίπλα στη δήλωση: «Στην επαφή» + «Υιοθέτηση» (ADR-915 §40.6, `DeclaredCredentialAdoption`) — μόνο για φυσικό πρόσωπο.
 */

import React from 'react';
import { useTranslation, type Translate } from '@/i18n/hooks/useTranslation';
import { Badge } from '@/components/ui/badge';
import { TOUCH_TARGET_MIN } from '@/design-system/touch-target';
import { ENTITY_ROUTES } from '@/lib/routes/entityRoutes';
import { Link } from '@/lib/workspace/navigation';
import { CASE_INVITE_ROLE_KEY } from '@/components/case-invite/case-invite-labels';
import { ISSUANCE_SPACE_KEYS } from '@/components/conveyance/my-cases/issuance-space-labels';
import { DOCUMENT_KIND_LABEL_KEYS } from '@/components/document-registry/document-registry-labels';
import { documentExpiryHref } from '@/lib/document-validity/document-registry-view';
import { issuanceKeyOf } from '@/lib/document-validity/issuance-assignment';
import { isLegalEngagementRole } from '@/types/engagement';
import type { ComparableContact } from '@/lib/contacts/declared-credential-comparison';
import type { ContactProfessionalAssignment, ContactProfessionalLink } from '@/types/contact-professional-link';
import { ENGAGEMENT_STATE_KEYS, PROFESSIONAL_LINK_KEYS } from './contact-professional-link-labels';
import { DeclaredCredentialAdoption, credentialText } from './DeclaredCredentialAdoption';


/** Τι ανέλαβε: το **έγγραφο** σε ανάθεση έκδοσης, ο **ρόλος** σε μεταβίβαση. */
function subjectLabelOf(assignment: ContactProfessionalAssignment, t: Translate): string {
  if (assignment.kind === 'document_issuance') {
    return assignment.documentKind ? t(DOCUMENT_KIND_LABEL_KEYS[assignment.documentKind]) : t(ISSUANCE_SPACE_KEYS.unknownDocument);
  }
  return isLegalEngagementRole(assignment.role) ? t(CASE_INVITE_ROLE_KEY[assignment.role]) : '';
}

/**
 * Το ακίνητο της ανάθεσης — **σύνδεσμος** στη σελίδα του όταν το ξέρουμε (ADR-915 §41.4, πρακτική Salesforce/HubSpot
 * «related record»: κάθε όνομα εγγραφής ανοίγει την εγγραφή). Ίδιος προορισμός με το μητρώο (`RegistryPropertyValue`).
 */
function AssignmentProperty({ assignment, t }: { readonly assignment: ContactProfessionalAssignment; readonly t: Translate }) {
  const name = assignment.propertyName ?? t(ISSUANCE_SPACE_KEYS.untitledProperty);
  if (assignment.propertyId === null) return <>{name}</>;
  return (
    <Link href={ENTITY_ROUTES.properties.withId(assignment.propertyId)} className={`${TOUCH_TARGET_MIN} underline underline-offset-4`}>
      {name}
    </Link>
  );
}

/**
 * Τι ανέλαβε — σε ανάθεση έκδοσης με γνωστό ακίνητο **και** είδος, σύνδεσμος στην κάρτα του μητρώου (ADR-915 §41.5).
 * Το `?doc=` είναι το **κλειδί υποκειμένου** (ακίνητο · είδος): η επαφή δεν ξέρει αν η γραμμή είναι κενό ή ληγμένο
 * έγγραφο — το λύνει το μητρώο (`registryRowOfDocParam`).
 */
function AssignmentSubject({ assignment, t }: { readonly assignment: ContactProfessionalAssignment; readonly t: Translate }) {
  const label = subjectLabelOf(assignment, t);
  const { propertyId, documentKind } = assignment;
  if (assignment.kind !== 'document_issuance' || propertyId === null || documentKind === null) return <>{label}</>;
  return (
    <Link
      href={documentExpiryHref(undefined, { doc: issuanceKeyOf(propertyId, documentKind) })}
      className={`${TOUCH_TARGET_MIN} underline underline-offset-4`}
    >
      {label}
    </Link>
  );
}

function AssignmentLine({ assignment, t }: { readonly assignment: ContactProfessionalAssignment; readonly t: Translate }) {
  return (
    <li>
      <AssignmentSubject assignment={assignment} t={t} /> — <AssignmentProperty assignment={assignment} t={t} />
      <span className="text-muted-foreground"> · {t(ENGAGEMENT_STATE_KEYS[assignment.state])}</span>
    </li>
  );
}

interface LinkFactsProps {
  readonly link: ContactProfessionalLink;
  readonly t: Translate;
  readonly contactId: string;
  /** Τα πεδία της επαφής για τη σύγκριση — `null` σε νομικό πρόσωπο (καμία υιοθέτηση). */
  readonly contact: ComparableContact | null;
}

function LinkFacts({ link, t, contactId, contact }: LinkFactsProps) {
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
            {credentialText(t, declared.authority, { number: declared.number, chapter: declared.chapter })}
          </dd>
          {contact && <DeclaredCredentialAdoption contactId={contactId} declared={declared} contact={contact} t={t} />}
        </>
      )}
    </dl>
  );
}

/** Φορτώνεται τεμπέλικα (`ContactLinkSurfaces`) — ο καλών την αποδίδει **μόνο** για `linked` / `offered`. */
export interface ContactProfessionalLinkBadgeProps {
  readonly link: ContactProfessionalLink;
  readonly contactId: string;
  readonly contact: ComparableContact | null;
}

export function ContactProfessionalLinkBadge({ link, contactId, contact }: ContactProfessionalLinkBadgeProps) {
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
      <LinkFacts link={link} t={t} contactId={contactId} contact={contact} />
    </section>
  );
}
