'use client';

/**
 * @fileoverview **Η ΣΧΕΣΗ, ΣΤΗΝ ΟΘΟΝΗ ΤΟΥ ΙΔΙΟΚΤΗΤΗ** — η πρώτη προβολή της ακμής.
 * @related ADR-834 §5 · lib/mandate/owner-mandate-view.ts · ADR-827 §9.8
 * @module components/owner-property/OwnerMandatePanel
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΤΙ ΔΕΝ ΕΧΕΙ ΑΥΤΗ Η ΟΘΟΝΗ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Κανένα τηλέφωνο, κανένα email, κανένα κουμπί «μήνυμα».** Η βιτρίνα δεν τα έχει
 * **επίτηδες** (ADR-827 §9.8): το άρθρο 200 §1 Ν.4072/2012 θέλει τη σχέση
 * **εγγράφως**, και ένα ελεύθερο κανάλι εδώ θα ήταν η πόρτα από την οποία περνά *«τηλ.
 * 69…»* — ακυρώνοντας το ίδιο το σχήμα. Ο άνθρωπος μαθαίνει **σε ποιον** απευθύνεται·
 * το κανάλι δεν το ανοίγει αυτή η οθόνη.
 *
 * ⛔ **Καμία «αντίστροφη επαφή», καμία σύνδεση CRM** (ADR-834 §5.Α/§5.Β): η σχέση
 * **δεν αντιγράφεται** — παράγεται από το έγγραφο που ο άνθρωπος ήδη κατέχει.
 *
 * 🔑 **Η ΕΠΩΝΥΜΙΑ ΛΥΝΕΤΑΙ ΜΕ ΤΟΝ ΥΠΑΡΧΟΝΤΑ ΑΝΑΓΝΩΣΤΗ** ({@link usePublicAgency}):
 * ανάγνωση **ενός** εγγράφου κατά ταυτότητα, από συλλογή που τα `firestore.rules`
 * δηλώνουν `read: if true`. ⛔ **ΜΗΝ** το κάνεις `usePublicAgencies().find(…)`: το
 * άνοιγμα **μιας** κάρτας θα κατέβαζε **όλα** τα γραφεία (το ίδιο το αρχείο εκείνο το
 * γράφει).
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency, formatDate } from '@/lib/intl-formatting';
import type { OwnerMandateView } from '@/lib/mandate/owner-mandate-view';
import { usePublicAgency } from '@/services/realtime/hooks/usePublicAgencies';
import { LISTING_AGREEMENT_I18N_KEYS } from '@/components/mandate/listing-agreement-labels';
import { OFFER_KIND_I18N_KEYS } from '@/components/mandate/offer-kind-labels';

import {
  OWNER_MANDATE_KEYS,
  OWNER_MANDATE_NS,
  OWNER_PROOF_KEYS,
  OWNER_STANDING_KEYS,
} from './owner-mandate-labels';

/** Μία γραμμή ορισμού — **`<dl>`, ποτέ `div` σε `div`** (N.4). */
function Detail({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="m-0 text-sm font-medium text-foreground">{children}</dd>
    </>
  );
}

/**
 * **Η επωνυμία, με ΤΡΕΙΣ καταστάσεις** — δες {@link OWNER_MANDATE_KEYS.agencyUnknown}.
 *
 * ⚠️ Ο hook καλείται **πάντα**, ακόμη και με `null`: υπό όρους κλήση θα έσπαγε τους
 * κανόνες των hooks τη στιγμή που μια αγγελία αποκτά δεύτερη εντολή.
 */
function AgencyName({ companyId }: { companyId: string | null }): React.JSX.Element {
  const { t } = useTranslation([OWNER_MANDATE_NS]);
  const lookup = usePublicAgency(companyId);

  if (companyId === null) return <>{t(OWNER_MANDATE_KEYS.agencyUnknown)}</>;
  if (lookup.state !== 'found') return <>{t(OWNER_MANDATE_KEYS.agencyUnnamed)}</>;
  return <>{lookup.profile.displayName}</>;
}

/** Η αμοιβή, ολόκληρη — **ποσό ΚΑΙ ΦΠΑ**: μισός όρος δεν είναι όρος (ADR-827 Α4/Α5). */
function feeTextOf(
  view: OwnerMandateView,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const vat = t(
    view.compensation.vatIncluded
      ? OWNER_MANDATE_KEYS.feeVatIncluded
      : OWNER_MANDATE_KEYS.feeVatExcluded,
  );

  const amount =
    view.compensation.type === 'percentage'
      ? t(OWNER_MANDATE_KEYS.feePercentage, { value: view.compensation.percentage })
      : t(OWNER_MANDATE_KEYS.feeFixed, { value: formatCurrency(view.compensation.amountEUR) });

  return `${amount} · ${vat}`;
}

/** Η περίοδος. **Άγνωστη έναρξη λέγεται**, δεν επινοείται (η ζωντανή εντολή δεν έχει). */
function periodTextOf(
  view: OwnerMandateView,
  t: (key: string) => string,
): string {
  const from = view.startsAt === null ? t(OWNER_MANDATE_KEYS.periodOpenStart) : formatDate(view.startsAt);
  return `${from} — ${formatDate(view.expiresAt)}`;
}

/** Η μία σχέση, ολόκληρη. */
function OwnerMandateCard({ view }: { view: OwnerMandateView }): React.JSX.Element {
  const { t } = useTranslation([OWNER_MANDATE_NS]);

  const role =
    view.agreement === null
      ? t(OWNER_MANDATE_KEYS.roleUnknown)
      : t(LISTING_AGREEMENT_I18N_KEYS[view.agreement]);

  const scope =
    view.scope.length === 0
      ? t(OWNER_MANDATE_KEYS.scopeUnknown)
      : view.scope.map((kind) => t(OFFER_KIND_I18N_KEYS[kind])).join(' · ');

  return (
    <article className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      <p className="m-0 text-sm font-semibold text-foreground">
        {t(OWNER_STANDING_KEYS[view.standing])}
        {view.daysLeft !== null && (
          <span className="ml-2 font-normal text-muted-foreground">
            {/* ⚠️ `count`, ΟΧΙ `days` — το ICU plural του δέντρου κλειδώνει σε
                `{count, plural, …}` (ίδιο με τον κατάλογο του γραφείου). */}
            {t(OWNER_MANDATE_KEYS.expiresIn, { count: view.daysLeft })}
          </span>
        )}
      </p>

      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <Detail label={t(OWNER_MANDATE_KEYS.agencyLabel)}>
          <AgencyName companyId={view.agencyCompanyId} />
        </Detail>
        <Detail label={t(OWNER_MANDATE_KEYS.roleLabel)}>{role}</Detail>
        <Detail label={t(OWNER_MANDATE_KEYS.scopeLabel)}>{scope}</Detail>
        <Detail label={t(OWNER_MANDATE_KEYS.periodLabel)}>{periodTextOf(view, t)}</Detail>
        <Detail label={t(OWNER_MANDATE_KEYS.feeLabel)}>{feeTextOf(view, t)}</Detail>
        <Detail label={t(OWNER_MANDATE_KEYS.proofLabel)}>
          {t(OWNER_PROOF_KEYS[view.proofVia])}
          {view.decidedAt !== null && ` · ${formatDate(view.decidedAt)}`}
        </Detail>
      </dl>

      {/* ⛔ ΠΛΗΡΟΦΟΡΙΑ, ΟΧΙ ΚΑΝΑΛΙ — δες την κεφαλίδα (ADR-827 §9.8). */}
      <p className="m-0 text-sm text-muted-foreground">{t(OWNER_MANDATE_KEYS.contactNote)}</p>
    </article>
  );
}

export interface OwnerMandatePanelProps {
  readonly views: readonly OwnerMandateView[];
}

/**
 * **Το πλαίσιο.** Κενό σύνολο ⇒ **τίποτα**, ποτέ «δεν έχετε εντολή»: ο ιδιώτης χωρίς
 * μεσίτη δεν έχει λόγο να διαβάσει για μεσιτεία στη σελίδα του σπιτιού του.
 */
export function OwnerMandatePanel({ views }: OwnerMandatePanelProps): React.JSX.Element | null {
  const { t } = useTranslation([OWNER_MANDATE_NS]);
  if (views.length === 0) return null;

  return (
    <section aria-label={t(OWNER_MANDATE_KEYS.title)} className="flex flex-col gap-3">
      <h2 className="m-0 text-lg font-semibold text-foreground">
        {t(OWNER_MANDATE_KEYS.title)}
      </h2>
      <p className="m-0 text-sm text-muted-foreground">{t(OWNER_MANDATE_KEYS.lead)}</p>

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {views.map((view, index) => (
          // ⚠️ Το ζεύγος **γραφείο × λήξη** είναι σταθερό μέσα στο έγγραφο· ο δείκτης
          //    μπαίνει μόνο ως έσχατο εφεδρικό για το κληροδότημα **χωρίς** γραφείο.
          <li key={`${view.agencyCompanyId ?? index}-${view.expiresAt}`}>
            <OwnerMandateCard view={view} />
          </li>
        ))}
      </ul>
    </section>
  );
}
