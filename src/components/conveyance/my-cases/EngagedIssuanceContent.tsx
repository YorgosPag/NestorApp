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
import { ExternalLink } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { CopyValueButton } from '@/components/shared/CopyValueButton';
import { EngagedDeliveryChange } from './EngagedDeliveryChange';
import { agencyProfileRoute } from '@/components/mandate/agency-directory-route';
import { agencyDoorFor } from '@/lib/agency/agency-door';
import { externalMapSearchUrl } from '@/lib/geo/external-map-link';
import { listingDetailHref } from '@/lib/listings/listing-routes';
import { Link } from '@/lib/workspace/navigation';
import { DeliveryLatenessBadge } from '@/components/document-registry/RegistryIssuanceDeliveryCell';
import { PrivatePageHeader } from '@/components/private-space/PrivatePageHeader';
import { Card } from '@/components/ui/card';
import { DOCUMENT_KIND_LABEL_KEYS, INSPECTION_ROLE_LABEL_KEYS } from '@/components/document-registry/document-registry-labels';
import { REGISTRY_AUTHORITY_PRESENTATION } from '@/constants/professional-registries';
import { formatDate } from '@/lib/intl-utils';
import { formatMinor } from '@/lib/money/money';
import { phoneHref } from '@/lib/validation/text-link-segments';
import type { EngagedIssuanceView, InspectionContactView, IssuanceAgreementView } from '@/types/my-engagements';
import { ISSUANCE_SPACE_KEYS, PROFESSIONAL_BALL_KEYS, PROFESSIONAL_STAGE_KEYS } from './issuance-space-labels';

const LINK_CLASS = 'underline decoration-dotted underline-offset-4 hover:decoration-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-sm';

/**
 * §45.20 — το γραφείο ως **πόρτα** προς τη δημόσια βιτρίνα του (ADR-777 §8.58): πάντα σύνδεσμος όταν υπάρχει ταυτότητα
 * **και** όνομα — ποτέ «μόνο αν δημοσιεύει» (η παρουσία του συνδέσμου θα γινόταν μαντείο, `agency-door.ts`). Η σελίδα
 * προορισμού απαντά ειλικρινά και αδιάκριτα. Χωρίς όνομα ⇒ κείμενο: σύνδεσμος που δεν λέει πού πάει δεν είναι πόρτα.
 */
function OfficeName({ view }: { readonly view: EngagedIssuanceView }) {
  const { t } = useTranslation(['conveyance']);
  const door = agencyDoorFor(view.hostCompanyId);
  if (view.hostName === null || door.kind === 'absent') return <>{view.hostName ?? t(ISSUANCE_SPACE_KEYS.unnamedOffice)}</>;
  return <Link href={agencyProfileRoute(door.companyId)} className={LINK_CLASS}>{view.hostName}</Link>;
}

/** §45.20 — το ακίνητο ως σύνδεσμος **μόνο** προς δημοσιευμένη αγγελία (το έκρινε ο server)· αλλιώς κείμενο, όχι 404. */
function PropertyName({ view }: { readonly view: EngagedIssuanceView }) {
  const { t } = useTranslation(['conveyance']);
  const name = view.propertyName ?? t(ISSUANCE_SPACE_KEYS.untitledProperty);
  if (view.publicListingId === null) return <>{name}</>;
  return <Link href={listingDetailHref(view.publicListingId)} className={LINK_CLASS}>{name}</Link>;
}

function Facts({ view }: { readonly view: EngagedIssuanceView }) {
  const { t } = useTranslation(['conveyance', 'document-registry', 'legality', 'property-market']);
  const credential = view.credential;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      <dt className="text-muted-foreground">{t(ISSUANCE_SPACE_KEYS.officeLabel)}</dt>
      <dd><OfficeName view={view} /></dd>
      <dt className="text-muted-foreground">{t(ISSUANCE_SPACE_KEYS.propertyLabel)}</dt>
      <dd><PropertyName view={view} /></dd>
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
 * §45.20 — η διεύθυνση αυτοψίας ανοίγει **εξωτερικούς χάρτες** σε νέα καρτέλα: ο άνθρωπος θέλει να **πάει** εκεί
 * (διαδρομή, πλοήγηση στο κινητό), όχι να δει έναν ακόμη χάρτη. Ο σύνδεσμος από τον ΕΝΑ κατασκευαστή.
 */
function SiteAddressRow({ address }: { readonly address: string | null }) {
  const { t } = useTranslation(['conveyance']);
  const href = address === null ? null : externalMapSearchUrl({ kind: 'address', address });
  if (address === null || href === null) return <AgreementRow label={t(ISSUANCE_SPACE_KEYS.siteAddressLabel)} value={address} />;
  return (
    <>
      <dt className="text-muted-foreground">{t(ISSUANCE_SPACE_KEYS.siteAddressLabel)}</dt>
      <dd>
        <a href={href} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 ${LINK_CLASS}`}>
          {address}
          <ExternalLink className="size-3" aria-hidden="true" />
          <span className="sr-only">{t(ISSUANCE_SPACE_KEYS.siteAddressMapHint)}</span>
        </a>
      </dd>
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

/** §45.15 (1β-γ-2) — εκκρεμής διόρθωση ⇒ **κανένας** αριθμός (μπορεί να είναι λάθος)· λείπει ⇒ ρητά· αλλιώς το ΑΦΜ. */
function ownerVatText(t: ReturnType<typeof useTranslation>['t'], owner: NonNullable<IssuanceAgreementView['owners']>[number]): string {
  if (owner.vatPendingOfficeConfirmation) return t(ISSUANCE_SPACE_KEYS.ownerVatPending);
  return owner.vatNumber === null ? t(ISSUANCE_SPACE_KEYS.ownerVatMissing) : t(ISSUANCE_SPACE_KEYS.ownerVat, { vat: owner.vatNumber });
}

/**
 * §45.20 — αντιγραφή του ΑΦΜ: ο επαγγελματίας τον **πληκτρολογεί** στο μητρώο του εγγράφου. Μόνο όταν ο αριθμός
 * δείχνεται (όχι εκκρεμής διόρθωση, όχι απών) — ό,τι δεν δείχνεται, δεν αντιγράφεται.
 */
function OwnerVatCopy({ owner }: { readonly owner: NonNullable<IssuanceAgreementView['owners']>[number] }) {
  const { t } = useTranslation(['conveyance']);
  if (owner.vatPendingOfficeConfirmation || owner.vatNumber === null) return null;
  return (
    <CopyValueButton
      value={owner.vatNumber}
      label={t(ISSUANCE_SPACE_KEYS.ownerVatCopy, { vat: owner.vatNumber })}
      copiedLabel={t(ISSUANCE_SPACE_KEYS.ownerVatCopied)}
      failedLabel={t(ISSUANCE_SPACE_KEYS.ownerVatCopyFailed)}
    />
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
              {owner.approvedQuote && <span className="text-muted-foreground">{` (${t(ISSUANCE_SPACE_KEYS.ownerApprovedMark)})`}</span>}
              {' · '}
              {ownerVatText(t, owner)}
              <OwnerVatCopy owner={owner} />
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
function Agreement({ agreement, view, onChanged }: {
  readonly agreement: IssuanceAgreementView;
  readonly view: EngagedIssuanceView;
  readonly onChanged: () => void;
}) {
  const { t } = useTranslation(['conveyance', 'document-registry']);
  const totals = agreement.totals;
  const price = totals === null ? null : t('document-registry:issuance.quoteForm.totals', {
    net: formatMinor(totals.netMinor), vat: formatMinor(totals.vatMinor), total: formatMinor(totals.totalMinor),
  });
  return (
    <section aria-labelledby="issuance-agreement-title" className="space-y-3">
      <h2 id="issuance-agreement-title" className="text-sm font-semibold">{t(ISSUANCE_SPACE_KEYS.agreementTitle)}</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <SiteAddressRow address={agreement.siteAddress} />
        {/* §45.20 — ο εγκρίνων σημειώνεται μέσα στον κατάλογο· χωριστή γραμμή μόνο όταν ΔΕΝ είναι σε αυτόν. */}
        {!agreement.owners?.some((owner) => owner.approvedQuote) && (
          <AgreementRow label={t(ISSUANCE_SPACE_KEYS.ownerLabel)} value={agreement.ownerName} />
        )}
        <AgreementRow label={t(ISSUANCE_SPACE_KEYS.agreedPriceLabel)} value={price} />
        <AgreementRow label={t(ISSUANCE_SPACE_KEYS.dueLabel)} value={agreement.dueOn === null ? null : formatDate(agreement.dueOn)} />
        {/* §45.18 Φ6 — αύριο · σήμερα · καθυστερεί N: η ΙΔΙΑ βαθμίδα με το μητρώο του γραφείου. */}
        {agreement.dueOn !== null && <dd className="col-start-2 m-0"><DeliveryLatenessBadge lateness={agreement.lateness} /></dd>}
        {agreement.inspectionContact && <InspectionContactRow contact={agreement.inspectionContact} />}
        <OwnersRow owners={agreement.owners} />
      </dl>
      {agreement.inspectionContact === null && <p className="text-xs text-muted-foreground">{t(ISSUANCE_SPACE_KEYS.agreementContact)}</p>}
      <EngagedDeliveryChange
        engagementId={view.engagementId} stage={view.stage} currentDueOn={agreement.dueOn}
        glance={agreement.deliveryChange} onChanged={onChanged}
      />
    </section>
  );
}

export function EngagedIssuanceContent({ view, onChanged }: { readonly view: EngagedIssuanceView; readonly onChanged: () => void }) {
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
          {view.agreement && <Agreement agreement={view.agreement} view={view} onChanged={onChanged} />}
          <p className="text-xs text-muted-foreground">{t(ISSUANCE_SPACE_KEYS.scope)}</p>
        </section>
      </Card>
    </>
  );
}
