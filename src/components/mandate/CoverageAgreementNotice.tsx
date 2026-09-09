/**
 * @fileoverview **ΤΙ ΘΑ ΑΛΛΑΞΕΙ, ΠΡΙΝ ΤΟ «ΔΗΜΟΣΙΕΥΣΗ»** — η δήλωση εναντίον της προσφοράς.
 * @related ADR-846 §8.8 (Φάση 5β) · ADR-777 §8.63 (αβεβαιότητα με μέγεθος)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΛΑΤΤΩΜΑ: Η ΔΗΜΟΣΙΕΥΣΗ ΗΤΑΝ **ΣΙΩΠΗΛΑ ΚΑΤΑΣΤΡΟΦΙΚΗ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο επαγγελματίας που δηλώνει εμβέλεια **χωρίς** τις περιοχές των ήδη δημοσιευμένων
 * ακινήτων του **εξαφανίζεται από εκεί όπου αποδεδειγμένα δουλεύει** — και μέχρι σήμερα
 * **κανείς δεν του το έλεγε**. Δεν είχε κανέναν τρόπο να το μάθει: οι δύο πλευρές ζούσαν
 * σε δύο υποσυστήματα που δεν γνωρίζονταν *(ADR-846 §8.8.1)*.
 *
 * 🏆 **Το ιδίωμα είναι το `terraform plan`, όχι το «είσαι σίγουρος;»**: *τι θα αλλάξει,
 * **μετρημένο**, πριν το `apply`*. Ένα modal επιβεβαίωσης θα ρωτούσε χωρίς να πει —
 * δηλαδή θα μετέθετε την ευθύνη χωρίς να δώσει την πληροφορία. Ίδια οικογένεια με το
 * *«Review updates»* του Figma και τα προειδοποιητικά του Revit που **μετράνε τα
 * στοιχεία** που θα επηρεαστούν.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΡΙΑ ΠΟΥ ΑΥΤΗ Η ΟΘΟΝΗ **ΔΕΝ** ΚΑΝΕΙ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΕΙΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **Δεν μπλοκάρει τη δημοσίευση.** Ο μεσίτης μπορεί να **αποσύρεται** από μια περιοχή
 *    ξεπουλώντας απόθεμα — απολύτως νόμιμο, και πιθανότατα η **συχνότερη** πραγματική
 *    αιτία. Fail-open **με ορατότητα**, ποτέ fail-closed με φραγμό.
 * 2. **Δεν επεκτείνει μόνη της τη δήλωση.** Η δήλωση είναι **λόγος ανθρώπου**· αυτόματη
 *    επέκταση θα έβαζε λόγια στο στόμα του. Η **μία** πρόταση που δίνει είναι
 *    **υπολογίσιμη και φραγμένη** *(επόμενο βήμα ακτίνας)*, και την πατά ο ίδιος.
 * 3. **Δεν μαντεύει περιοχές.** Σημείο → `AdminEntity.id` **δεν λύνεται** *(§9 #1)*·
 *    όταν η δήλωση είναι διοικητική ή πολύγωνο, λέμε *«πρόσθεσέ τες»* — **δεν** επινοούμε
 *    ποιες. Το ψεύτικο *«μήπως εννοείς Δήμο Χ;»* θα ήταν ισχυρισμός χωρίς απόδειξη.
 *
 * 🔑 **Και δεν εμφανίζεται ΠΟΤΕ όταν δεν ξέρουμε.** Σήμερα η πιο συχνή απάντηση είναι
 * `unknown` *(μετρημένο: 6 ακίνητα, 0 με θέση)*. Η οθόνη σιωπά — γιατί μια προειδοποίηση
 * χτισμένη σε **δικό μας** κενό θα κατηγορούσε τον άνθρωπο για δικό μας λάθος.
 */

'use client';

import React from 'react';

import { useAuth } from '@/auth/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useCoverageResolvers } from '@/hooks/useCoverageResolvers';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  coverageEvidenceOf,
  listingsOutsideCoverage,
  nextRadiusCovering,
  type CoverageEvidence,
} from '@/lib/agency/coverage-agreement';
import { usePublicAgencyListings } from '@/services/realtime/hooks/usePublicListings';
import {
  isRadiusCoverage,
  type CoverageRadiusKm,
  type DeclaredCoverage,
} from '@/types/agency-coverage';

import { SHOWCASE_KEYS, SHOWCASE_NS } from './agency-showcase-labels';

interface CoverageAgreementNoticeProps {
  /** Η δήλωση **όπως τη γράφει αυτή τη στιγμή** ο άνθρωπος — όχι η δημοσιευμένη. */
  readonly value: DeclaredCoverage | null;
  /** Η ίδια δίοδος με τον `CoverageAreaPicker`: η πρόταση **γράφει το πεδίο**, δεν σώζει. */
  readonly onChange: (next: DeclaredCoverage | null) => void;
}

/**
 * **Η πράξη: ΓΡΑΦΕΙ ΤΟ ΠΕΔΙΟ, ΔΕΝ ΔΗΜΟΣΙΕΥΕΙ.**
 *
 * 🔑 Ο άνθρωπος βλέπει τη νέα ακτίνα στον επιλογέα και πατά «Δημοσίευση» **ο ίδιος** —
 * μία πράξη, μία απόφαση. Αυτόματη δημοσίευση εδώ θα ήταν η *«αυτόματη επέκταση της
 * δήλωσης»* που το ADR-846 §8.8.7 απορρίπτει, με ένα κλικ ενδιάμεσα για καμουφλάζ.
 *
 * ⚠️ **Ο φρουρός `isRadiusCoverage` ΔΕΝ είναι περιττός** παρότι το `nextRadiusCovering`
 * επιστρέφει `null` για κάθε άλλη μορφή: τα δύο σημεία **δεν είναι το ίδιο σημείο**, και
 * η μέρα που κάποιος αλλάξει το ένα, το άλλο **δεν πρέπει** να γράψει ακτίνα πάνω σε
 * πολύγωνο.
 */
function extendRadius(
  value: DeclaredCoverage | null,
  km: CoverageRadiusKm,
  onChange: (next: DeclaredCoverage | null) => void,
): void {
  if (value === null || !isRadiusCoverage(value)) return;
  onChange({ circle: { ...value.circle, radiusKm: km } });
}

/**
 * 🔴 **Η ΣΙΩΠΗ ΕΙΝΑΙ Η ΠΡΟΕΠΙΛΟΓΗ, ΚΑΙ ΕΧΕΙ ΤΕΣΣΕΡΙΣ ΑΙΤΙΕΣ.** Δεν ζωγραφίζεται τίποτα
 * όταν: δεν έχει ταυτότητα · φορτώνει · δεν υπάρχει τίποτα εκτός · **ή δεν ξέρουμε**.
 * Μόνο η **τρίτη** είναι «όλα καλά»· οι άλλες τρεις είναι *«δεν έχω κάτι να πω»* — και
 * ένα μήνυμα σε καθεμία θα ήταν θόρυβος που μαθαίνει τον άνθρωπο να μην το διαβάζει.
 */
export function CoverageAgreementNotice({
  value,
  onChange,
}: CoverageAgreementNoticeProps): React.ReactElement | null {
  const { user } = useAuth();
  const { listings, loading } = usePublicAgencyListings(user?.companyId ?? null);
  // 🔑 **Οι αναγνώστες έρχονται από τον SSoT** *(ADR-846 §8.8.14)*: η ταυτότητά τους
  //    κρέμεται από το στιγμιότυπο των αποτυπωμάτων, ώστε τα `useMemo` παρακάτω να
  //    ξαναγίνονται **ακριβώς όταν** φτάσουν τα δεδομένα — και όχι ποτέ.
  const { resolvers } = useCoverageResolvers();

  const evidence = React.useMemo(
    () => coverageEvidenceOf(value, listings, resolvers),
    [value, listings, resolvers],
  );

  const suggestion = React.useMemo(() => {
    if (evidence.outside === 0) return null;
    return nextRadiusCovering(value, listingsOutsideCoverage(value, listings, resolvers));
  }, [evidence.outside, value, listings, resolvers]);

  if (loading || evidence.agreement !== 'understated') return null;

  return (
    <AgreementNoticeBody
      evidence={evidence}
      suggestion={suggestion}
      onExtend={(km) => extendRadius(value, km, onChange)}
    />
  );
}

interface AgreementNoticeBodyProps {
  readonly evidence: CoverageEvidence;
  readonly suggestion: CoverageRadiusKm | null;
  readonly onExtend: (km: CoverageRadiusKm) => void;
}

/**
 * **Η όψη, χωρίς καμία κρίση** *(N.7.1)*.
 *
 * 🔑 **Εξήχθη επειδή ο ορχηστρωτής ξεπέρασε τις 40 γραμμές**, και η τομή έγινε εκεί που
 * υπάρχει **πραγματικό σύνορο**: από πάνω ζουν τα hooks και η ετυμηγορία, από κάτω
 * **μόνο** κείμενο. Ίδια απόφαση με το §8.7.2 — εξάγεται το κομμάτι που έχει **δικό του
 * όνομα και δική του ερώτηση**, ποτέ «οι πρώτες 40 γραμμές».
 */
function AgreementNoticeBody({
  evidence,
  suggestion,
  onExtend,
}: AgreementNoticeBodyProps): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);

  return (
    <aside
      className="flex flex-col gap-2 rounded-md border border-border bg-card p-3"
      // 🔑 Η κατάσταση **είναι** η ετυμηγορία — καμία δεύτερη σημαία να αποκλίνει.
      data-testid="coverage-agreement-notice"
      data-agreement={evidence.agreement}
    >
      <h3 className="m-0 text-sm font-semibold text-foreground">
        {t(SHOWCASE_KEYS.coverageAgreementTitle)}
      </h3>

      <p className="m-0 text-sm text-foreground">
        {t(SHOWCASE_KEYS.coverageAgreementOutside, {
          count: evidence.outside,
          total: evidence.total,
        })}
      </p>

      <p className="m-0 text-sm text-muted-foreground">
        {t(SHOWCASE_KEYS.coverageAgreementConsequence)}
      </p>

      {/* ⚠️ Η αβεβαιότητα λέγεται **δίπλα** στο εύρημα, ποτέ αντί γι' αυτό: αλλιώς ένα
          «δεν ξέρω» για δέκα ακίνητα θα έκρυβε το ένα που **ξέρουμε** ότι είναι έξω. */}
      {evidence.indeterminate > 0 && (
        <p className="m-0 text-sm text-muted-foreground">
          {t(SHOWCASE_KEYS.coverageAgreementUnknown, { count: evidence.indeterminate })}
        </p>
      )}

      {suggestion === null ? (
        <p className="m-0 text-sm text-muted-foreground">
          {t(SHOWCASE_KEYS.coverageAgreementNoAutoFix)}
        </p>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => onExtend(suggestion)}
        >
          {t(SHOWCASE_KEYS.coverageAgreementExtendRadius, { km: suggestion })}
        </Button>
      )}
    </aside>
  );
}
