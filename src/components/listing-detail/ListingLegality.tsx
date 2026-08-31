'use client';

/**
 * **Η ΝΟΜΙΜΟΤΗΤΑ ΣΤΗΝ ΟΘΟΝΗ** — κλίμακα με προέλευση, ποτέ ναι/όχι.
 *
 * @related ADR-838 §6 · ADR-777 §7 (Α17 · Α7) · lib/legality/legality-signal
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΑΥΤΟ ΤΟ ΚΟΥΤΙ ΑΝΤΙΚΑΘΙΣΤΑ ΜΙΑ ΓΡΑΜΜΗ ΤΟΥ `ListingOpenSubjects`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μέχρι σήμερα η σελίδα έλεγε *«δεν δημοσιεύουμε νομιμότητα»* — τίμια, αλλά κενό.
 * Τώρα το **λέει**: μία γραμμή ανά ερώτημα, με **βαθμίδα** και **πηγή**.
 *
 * ⚠️ **ΤΡΕΙΣ ΚΑΝΟΝΕΣ ΠΟΥ Η ΟΘΟΝΗ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΣΠΑΣΕΙ:**
 *
 * 1. ⛔ **Καμία προειδοποίηση για την τακτοποίηση.** Η νόμιμα τακτοποιημένη αυθαιρεσία
 *    είναι η **κανονική** κατάσταση του ελληνικού αποθέματος (SPEC-777 §24.4). Οθόνη
 *    που τη δείχνει ως ελάττωμα λέει ψέματα για την αγορά **και** σπρώχνει τους
 *    κατόχους να μη δηλώνουν. Γι' αυτό **κανένα** χρωματικό σήμα κινδύνου εδώ.
 * 2. ⛔ **Το «δεν έχει δηλωθεί» ΔΕΝ είναι κόκκινο.** Είναι *«κανείς δεν ρώτησε»*, όχι
 *    *«έχει πρόβλημα»* — το σχήμα «0 = κανείς δεν κοίταξε», με τη ζημιά να πέφτει σε
 *    **άνθρωπο** αντί σε baseline.
 * 3. ⛔ **Κανένα έγγραφο, καμία σύνδεση προς έγγραφο.** Ό,τι φτάνει εδώ έχει ήδη
 *    περάσει από τη μία πύλη τιμής του `legalitySignalFor`.
 *
 * 🔑 **`Record` πάνω σε κλειστά σύνολα, όχι ``t(`${K}.${x}`)``** — τα δυναμικά κλειδιά
 * **δεν επιλύονται** από τη CHECK 3.8, δηλαδή ένα κλειδί που λείπει θα έφτανε στην
 * παραγωγή ως ωμό κείμενο. Ίδιο ιδίωμα με το `StayLedgerBar` (ADR-835 Φ3).
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { legalityKindSpec, type LegalityClaimKind } from '@/lib/legality/legality-claim';
import type { LegalitySignal, LegalitySignalState } from '@/lib/legality/legality-signal';
import type { LegalityTier } from '@/lib/legality/legality-tier';
import type { PublicListing } from '@/types/public-listing';

/** Πλήρη κλειδιά, γραμμένα — ώστε η πύλη να μπορεί να τα δει. */
const KIND_KEYS: Readonly<Record<LegalityClaimKind, string>> = {
  'short-stay-registry': 'legality:kind.short-stay-registry',
  'building-identity': 'legality:kind.building-identity',
  'arbitrary-settlement': 'legality:kind.arbitrary-settlement',
  'energy-performance': 'legality:kind.energy-performance',
};

const STATE_KEYS: Readonly<Record<LegalitySignalState, string>> = {
  undeclared: 'legality:state.undeclared',
  declared: 'legality:state.declared',
  expired: 'legality:state.expired',
  'expiry-unknown': 'legality:state.expiry-unknown',
  'not-applicable': 'legality:state.not-applicable',
};

const TIER_KEYS: Readonly<Record<LegalityTier, string>> = {
  'self-declared': 'legality:tier.self-declared',
  'document-provided': 'legality:tier.document-provided',
  'professional-attested': 'legality:tier.professional-attested',
  'registry-verified': 'legality:tier.registry-verified',
};

/**
 * Μία γραμμή — ένα ερώτημα, μία απάντηση, μία πηγή.
 *
 * 🔑 **`dt`/`dd` και όχι `div`**: είναι κυριολεκτικά ζεύγη όρου–ορισμού (*«ΑΜΑ» →
 * «δηλωμένο, κατά δήλωση ιδιοκτήτη»*), και η σημασιολογία είναι αυτό που δίνει στον
 * αναγνώστη οθόνης τη σχέση χωρίς να τη διαβάσει από τη διάταξη.
 */
function LegalityRow({ signal }: { readonly signal: LegalitySignal }) {
  const { t } = useTranslation(['legality']);
  const spec = legalityKindSpec(signal.kind);

  return (
    <>
      <dt className="text-sm font-medium text-foreground">{t(KIND_KEYS[signal.kind])}</dt>
      <dd className="mb-3 text-sm text-muted-foreground">
        <span className="text-foreground">{t(STATE_KEYS[signal.state])}</span>

        {/* Η ΒΑΘΜΙΔΑ — υπάρχει σε τρεις από τις πέντε καταστάσεις, και μόνο εκεί. */}
        {(signal.state === 'declared' ||
          signal.state === 'expired' ||
          signal.state === 'expiry-unknown') && (
          <span className="ml-1">— {t(TIER_KEYS[signal.tier])}</span>
        )}

        {/* Η ΤΙΜΗ — μόνο αν το είδος τη δημοσιεύει ΚΑΙ δόθηκε. Ο ΑΜΑ αναρτάται
            υποχρεωτικά· η ταυτότητα κτιρίου ποτέ. Την κρίση την έχει ήδη κάνει το
            `legalitySignalFor`: εδώ αρκεί ο έλεγχος «υπάρχει;». */}
        {signal.state === 'declared' && signal.value !== null && (
          <span className="ml-1 font-mono">{t('legality:number', { value: signal.value })}</span>
        )}

        {signal.state === 'declared' && (
          <span className="ml-1">{t('legality:assertedAt', { date: signal.assertedAt })}</span>
        )}

        {signal.state === 'expired' && (
          <span className="ml-1">
            {t('legality:expiredAfter', { date: signal.expiredAfter })}
          </span>
        )}

        {/* Οι δύο σημειώσεις που λένε ΠΟΙΑΝΟΥ είναι το κενό — ποτέ «έχει πρόβλημα». */}
        {signal.state === 'undeclared' && (
          <span className="ml-1">{t('legality:undeclaredNote')}</span>
        )}
        {signal.state === 'expiry-unknown' && (
          <span className="ml-1">{t('legality:expiryUnknownNote')}</span>
        )}

        {/* Η ΠΗΓΗ ταξιδεύει με τον κανόνα, όπως το `StatutoryTermLimit.authority`.
            Δεν περνά από i18n: είναι παραπομπή σε διάταξη, ίδια σε κάθε γλώσσα. */}
        <small className="mt-0.5 block text-xs">
          {t('legality:source', { statute: spec.statute })}
        </small>
      </dd>
    </>
  );
}

/**
 * **Ό,τι ξέρουμε για τη νομιμότητα** — ή, ρητά, ότι δεν ξέρουμε.
 *
 * ⚠️ **Δεν φιλτράρει τις γραμμές `not-applicable`, και είναι απόφαση**: ο επισκέπτης
 * μαθαίνει ότι το ερώτημα **τέθηκε** και δεν αφορά — αντί να μη μάθει ότι υπήρξε
 * ερώτημα. Ίδιο επιχείρημα με το `ListingOpenSubjects`: **προτιμάμε να φανούμε
 * λιγότερο πλήρεις παρά περισσότερο βέβαιοι απ' όσο είμαστε.**
 */
export function ListingLegality({ listing }: { readonly listing: PublicListing }) {
  const { t } = useTranslation(['legality']);

  return (
    <section
      aria-labelledby="listing-legality-heading"
      className="rounded-lg border border-border bg-card p-4"
    >
      <h2 id="listing-legality-heading" className="text-sm font-medium text-foreground">
        {t('legality:heading')}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{t('legality:intro')}</p>

      <dl className="mt-3">
        {listing.legality.map((signal) => (
          <LegalityRow key={signal.kind} signal={signal} />
        ))}
      </dl>

      <p className="mt-1 text-xs text-muted-foreground">{t('legality:disclaimer')}</p>
    </section>
  );
}
