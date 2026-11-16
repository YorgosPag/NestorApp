'use client';

/**
 * =============================================================================
 * Ο χώρος της ανάθεσης, όπως τον βλέπει ο επαγγελματίας (ADR-915 §39 · ADR-862 §5.3.11)
 * =============================================================================
 *
 * Ποιο γραφείο, ποιο ακίνητο, ποιο έγγραφο, πού βρίσκεται η ανάθεση και σε ποιον είναι η σειρά — **παραγόμενα** από
 * την ανάθεση, ποτέ αποθηκευμένα δεύτερη φορά. Η ιδιότητα φαίνεται όπως τη δήλωσε ο ίδιος («δηλωμένη»).
 * 🔑 Στάδιο και σειρά σε **δεύτερο πρόσωπο** (§39.7): διαβάζει ο ίδιος — «Σειρά: δική σας», όχι «ο επαγγελματίας».
 *
 * 🔒 Ε-9′ — **κανένα** τηλέφωνο ή email του γραφείου: μόνο ονόματα και γεγονότα. Μόνη εξαίρεση (§45.15): το τηλέφωνο
 *    του υπευθύνου αυτοψίας, που το γραφείο **όρισε ρητά** γι' αυτόν τον σκοπό.
 * 🔑 Η παράδοση (Φ-Γ) και τα μηνύματα (Φ-Δ) προστίθενται **εδώ**, πάνω στο ίδιο `kind` — η σελίδα δεν αλλάζει διεύθυνση.
 *
 * @module components/conveyance/my-cases/EngagedIssuanceContent
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PrivatePageHeader } from '@/components/private-space/PrivatePageHeader';
import { Card } from '@/components/ui/card';
import { DOCUMENT_KIND_LABEL_KEYS, INSPECTION_ROLE_LABEL_KEYS } from '@/components/document-registry/document-registry-labels';
import { REGISTRY_AUTHORITY_PRESENTATION } from '@/constants/professional-registries';
import { formatDate } from '@/lib/intl-utils';
import { formatMinor } from '@/lib/money/money';
import { phoneHref } from '@/lib/validation/text-link-segments';
import type { EngagedIssuanceView, InspectionContactView, IssuanceAgreementView } from '@/types/my-engagements';
import { ISSUANCE_SPACE_KEYS, PROFESSIONAL_BALL_KEYS, PROFESSIONAL_STAGE_KEYS } from './issuance-space-labels';

function Facts({ view }: { readonly view: EngagedIssuanceView }) {
  const { t } = useTranslation(['conveyance', 'document-registry', 'legality', 'property-market']);
  const credential = view.credential;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      <dt className="text-muted-foreground">{t(ISSUANCE_SPACE_KEYS.officeLabel)}</dt>
      <dd>{view.hostName ?? t(ISSUANCE_SPACE_KEYS.unnamedOffice)}</dd>
      <dt className="text-muted-foreground">{t(ISSUANCE_SPACE_KEYS.propertyLabel)}</dt>
      <dd>{view.propertyName ?? t(ISSUANCE_SPACE_KEYS.untitledProperty)}</dd>
      <dt className="text-muted-foreground">{t(ISSUANCE_SPACE_KEYS.documentLabel)}</dt>
      <dd>{t(DOCUMENT_KIND_LABEL_KEYS[view.documentKind])}</dd>
      <dt className="text-muted-foreground">{t(ISSUANCE_SPACE_KEYS.stageLabel)}</dt>
      <dd>{t(PROFESSIONAL_STAGE_KEYS[view.stage])}</dd>
      {view.ballInCourt && (
        <>
          <dt className="text-muted-foreground">{t(ISSUANCE_SPACE_KEYS.ballLabel)}</dt>
          <dd>{t(PROFESSIONAL_BALL_KEYS[view.ballInCourt])}</dd>
        </>
      )}
      {credential && (
        <>
          <dt className="text-muted-foreground">{t(ISSUANCE_SPACE_KEYS.credentialLabel)}</dt>
          <dd>
            {t(ISSUANCE_SPACE_KEYS.credentialValue, {
              registry: t(REGISTRY_AUTHORITY_PRESENTATION[credential.authority].abbreviationKey),
              number: credential.number,
            })}
          </dd>
        </>
      )}
      <dt className="text-muted-foreground">{t(ISSUANCE_SPACE_KEYS.requestedLabel)}</dt>
      <dd>{formatDate(view.proposedAt)}</dd>
    </dl>
  );
}

/** Μία γραμμή του πλαισίου εκτέλεσης — τιμή που λείπει γράφεται ρητά «δεν έχει δηλωθεί», ποτέ κενό. */
function AgreementRow({ label, value }: { readonly label: string; readonly value: string | null }) {
  const { t } = useTranslation(['conveyance']);
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value ?? t(ISSUANCE_SPACE_KEYS.notDeclared)}</dd>
    </>
  );
}

/**
 * ADR-915 §45.15 — ο υπεύθυνος αυτοψίας που **όρισε** το γραφείο: όνομα · ιδιότητα · τηλέφωνο (`tel:`). Χωρίς τηλέφωνο
 * ⇒ το λέει ρητά, ποτέ κενό.
 */
function InspectionContactRow({ contact }: { readonly contact: InspectionContactView }) {
  const { t } = useTranslation(['conveyance', 'document-registry']);
  const role = contact.role === 'other' && contact.roleOther !== null ? contact.roleOther : t(INSPECTION_ROLE_LABEL_KEYS[contact.role]);
  // Ο ΕΝΑΣ κατασκευαστής `tel:` (ADR-751): τιμή που ο ανιχνευτής δεν διαβάζει ως ένα τηλέφωνο ⇒ απλό κείμενο.
  const href = contact.phone === null ? null : phoneHref(contact.phone);
  return (
    <>
      <dt className="text-muted-foreground">{t(ISSUANCE_SPACE_KEYS.inspectionContactLabel)}</dt>
      <dd>
        {t(ISSUANCE_SPACE_KEYS.inspectionContactName, { name: contact.name ?? t(ISSUANCE_SPACE_KEYS.unnamedContact), role })}
        {' · '}
        {contact.phone === null && t(ISSUANCE_SPACE_KEYS.inspectionNoPhone)}
        {contact.phone !== null && (href === null ? contact.phone : <a className="underline underline-offset-2" href={href}>{contact.phone}</a>)}
      </dd>
    </>
  );
}

/** ADR-915 §45.15 — όλοι οι ιδιοκτήτες με ΑΦΜ (για το έντυπο). ΑΦΜ που λείπει γράφεται ρητά. */
function OwnersRow({ owners }: { readonly owners: IssuanceAgreementView['owners'] }) {
  const { t } = useTranslation(['conveyance']);
  const body = owners === null
    ? t(ISSUANCE_SPACE_KEYS.ownersUnavailable)
    : owners.length === 0
      ? t(ISSUANCE_SPACE_KEYS.ownersNone)
      : (
        <ul className="space-y-1">
          {owners.map((owner, index) => (
            <li key={`${owner.name ?? ''}:${owner.vatNumber ?? ''}:${index}`}>
              {owner.name ?? t(ISSUANCE_SPACE_KEYS.unnamedContact)}
              {' · '}
              {owner.vatNumber === null ? t(ISSUANCE_SPACE_KEYS.ownerVatMissing) : t(ISSUANCE_SPACE_KEYS.ownerVat, { vat: owner.vatNumber })}
            </li>
          ))}
        </ul>
      );
  return (
    <>
      <dt className="text-muted-foreground">{t(ISSUANCE_SPACE_KEYS.ownersLabel)}</dt>
      <dd>{body}</dd>
    </>
  );
}

/**
 * ADR-915 §45.10 · §45.15 — τα στοιχεία της εκτέλεσης (Π-7: «μετά την έγκριση»). 🔒 Ε-9′: κανένα κανάλι του γραφείου·
 * το μόνο τηλέφωνο είναι του υπευθύνου αυτοψίας που όρισε ρητά το γραφείο. Χωρίς υπεύθυνο ⇒ «μέσω του γραφείου».
 */
function Agreement({ agreement }: { readonly agreement: IssuanceAgreementView }) {
  const { t } = useTranslation(['conveyance', 'document-registry']);
  const totals = agreement.totals;
  const price = totals === null ? null : t('document-registry:issuance.quoteForm.totals', {
    net: formatMinor(totals.netMinor), vat: formatMinor(totals.vatMinor), total: formatMinor(totals.totalMinor),
  });
  return (
    <section aria-labelledby="issuance-agreement-title" className="space-y-3">
      <h2 id="issuance-agreement-title" className="text-sm font-semibold">{t(ISSUANCE_SPACE_KEYS.agreementTitle)}</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <AgreementRow label={t(ISSUANCE_SPACE_KEYS.siteAddressLabel)} value={agreement.siteAddress} />
        <AgreementRow label={t(ISSUANCE_SPACE_KEYS.ownerLabel)} value={agreement.ownerName} />
        <AgreementRow label={t(ISSUANCE_SPACE_KEYS.agreedPriceLabel)} value={price} />
        <AgreementRow label={t(ISSUANCE_SPACE_KEYS.dueLabel)} value={agreement.dueOn === null ? null : formatDate(agreement.dueOn)} />
        {agreement.inspectionContact && <InspectionContactRow contact={agreement.inspectionContact} />}
        <OwnersRow owners={agreement.owners} />
      </dl>
      {agreement.inspectionContact === null && <p className="text-xs text-muted-foreground">{t(ISSUANCE_SPACE_KEYS.agreementContact)}</p>}
    </section>
  );
}

export function EngagedIssuanceContent({ view }: { readonly view: EngagedIssuanceView }) {
  const { t } = useTranslation(['conveyance', 'document-registry', 'legality']);
  return (
    <>
      <PrivatePageHeader
        title={view.propertyName ?? t(ISSUANCE_SPACE_KEYS.untitledProperty)}
        lead={`${t(ISSUANCE_SPACE_KEYS.kindLabel)} · ${t(DOCUMENT_KIND_LABEL_KEYS[view.documentKind])}`}
      />
      <Card asChild className="space-y-4 p-4">
        <section aria-label={t(ISSUANCE_SPACE_KEYS.kindLabel)}>
          <Facts view={view} />
          {view.agreement && <Agreement agreement={view.agreement} />}
          <p className="text-xs text-muted-foreground">{t(ISSUANCE_SPACE_KEYS.scope)}</p>
        </section>
      </Card>
    </>
  );
}
