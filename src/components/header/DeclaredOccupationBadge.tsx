'use client';

/**
 * **ΤΙ ΕΙΣΑΙ — ΚΑΙ ΤΙ ΚΑΝΕΙ ΑΥΤΟ.** Η υπόσχεση του ADR-798 §7, στην οθόνη.
 *
 * @related ADR-798 §7 · ADR-748 Ε7.γ′ · hooks/useDeclaredOccupation.ts · config/isco-job-affinity.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — μετρημένο 2026-08-25
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το **ADR-798 §7** υπόσχεται **κατά λέξη**:
 *
 * > «Η οθόνη δείχνει **ΠΑΝΤΑ** ποια από τις τρεις ισχύει — αλλιώς το `declared`
 * > διαβάζεται ως `verified`, που είναι **η ίδια η βλάβη** που το σχήμα υπάρχει
 * > για να κλείσει.»
 *
 * **Η οθόνη δεν έδειχνε ΠΟΤΕ καμία από τις τρεις.** Μετρημένο:
 *
 * | Τι | Καταναλωτές παραγωγής |
 * |---|---|
 * | `OccupationConfidence` (`unknown`·`declared`·`verified`) | **0** |
 * | `isClassified` | **0** *(11 εμφανίσεις: 5 ορισμός + 6 tests)* |
 * | `useDeclaredOccupation()` | **1** κλήση — και παίρνει **μόνο** `iscoCode` |
 * | `.tsx` σε `components`+`app` που αναφέρουν `occupation` | **3** — **και τα 3 ο γραφέας** |
 *
 * *(Παρονομαστής: το ίδιο grep βρίσκει **100+** `.confidence` αλλού ⇒ το όργανο
 * βλέπει· το μηδέν είναι πραγματικό.)*
 *
 * ⇒ Ο χαρακτηρισμός υπολογιζόταν σωστά και **πέθαινε στη μνήμη** — ίδιο σχήμα
 * με το `geocodingMetadata` του ΒΗΜΑΤΟΣ 4 *(12 αναγνώστες, 0 γραφείς)*,
 * ανάποδα: **1 γραφέας, 0 αναγνώστες οθόνης**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΟΥΣ ΜΕΓΑΛΟΥΣ — δείχνουμε τη ΣΥΝΕΠΕΙΑ, όχι το δεδομένο
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Figma · Notion · Linear** ρωτούν *«τι κάνεις;»* στο onboarding και το
 * χρησιμοποιούν για **marketing** — ο χρήστης δεν μαθαίνει ποτέ τι έκανε η
 * απάντησή του. Το **Slack** το κάνει *custom profile field του workspace*, που
 * **χάνεται όταν φύγεις**.
 *
 * Εδώ ο άνθρωπος βλέπει **τρία** πράγματα που κανείς τους δεν δείχνει μαζί:
 *   1. **τι δήλωσε**,
 *   2. **πόσο το εμπιστευόμαστε** *(δηλωμένο ≠ επαληθευμένο — §7)*,
 *   3. **ποια δουλειά υποδεικνύει** *(η συνέπεια, από τον ΙΔΙΟ πίνακα που την
 *      εκτελεί — άρα δεν μπορεί να αποκλίνει)*.
 *
 * ⚠️ **ΚΑΜΙΑ ΕΡΩΤΗΣΗ, ΚΑΝΕΝΑ MODAL** — **ADR-748 Ε7.γ′** *(έβδομη έρευνα, 14
 * πηγές)* και **ADR-798 Α5** *(απόφαση Giorgio)*. Το `unknown` γίνεται
 * **μη-μπλοκαριστική πρόταση** μέσα σε μενού που ο άνθρωπος άνοιξε **μόνος του**.
 * Ο Revit 2022 ρωτά με modal και έχει **επίσημο άρθρο «How to disable»** — όταν
 * το προϊόν χρειάζεται άρθρο για να απενεργοποιήσει μια οθόνη, **η οθόνη είναι
 * το σφάλμα**.
 *
 * ⛔ **ΜΗΝ** το μετατρέψεις σε modal/onboarding βήμα.
 * ⛔ **ΜΗΝ** δείξεις εδώ δικαίωμα ή ρόλο: το επάγγελμα **ΠΟΤΕ** δεν δίνει
 *    δικαίωμα *(ADR-798 Α4 · NIST SP 800-63 IAL1)*. Το `suggests` λέει
 *    *«προτείνει»*, ποτέ *«σου δίνει»*.
 * ⛔ **ΜΗΝ** χρησιμοποιήσεις `text-primary`: στο **προεπιλεγμένο σκοτεινό** θέμα
 *    λύνεται ταυτόσημα με το `--card` ⇒ **1,00:1 = αόρατο** *(CHECK 3.38)*.
 * ⚠️ **Το χρώμα ΔΕΝ είναι το μόνο κανάλι** *(CHECK 3.41 / WCAG 1.4.1)*: κάθε
 *    κατάσταση φέρει **δικό της εικονίδιο ΚΑΙ δικό της κείμενο**.
 *
 * @module components/header/DeclaredOccupationBadge
 */

import { useTranslation } from 'react-i18next';
import { Briefcase, BadgeCheck, CircleHelp } from 'lucide-react';

import { useRouter } from '@/lib/workspace/navigation';
import { ACCOUNT_ROUTES } from '@/lib/routes';
import { useDeclaredOccupation } from '@/hooks/useDeclaredOccupation';
import { resolveJobAffinity } from '@/config/isco-job-affinity';
import { JOBS } from '@/config/jobs-registry';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * Ο τόνος ανά κατάσταση — **σημασιολογικά tokens**, ποτέ ωμή κλίμακα Tailwind
 * *(CHECK 3.26/3.42)* και ποτέ `text-primary` *(CHECK 3.38)*.
 *
 * ⚠️ Το `verified` είναι σκόπιμα **success** και το `declared` **ουδέτερο**: αν
 * και τα δύο έβαφαν πράσινα, η διάκριση του §7 θα υπήρχε στον τύπο και **όχι
 * στην οθόνη** — δηλαδή θα έλειπε ακριβώς εκεί που την χρειάζεται ο άνθρωπος.
 */
const VERIFIED_TONE = 'text-[hsl(var(--text-success))]';

export interface DeclaredOccupationBadgeProps {
  /** Κλείνει το μενού που το φιλοξενεί, όταν ο άνθρωπος διαλέξει να δηλώσει. */
  readonly onNavigate?: () => void;
  readonly className?: string;
}

/**
 * Τι δουλειά υποδεικνύει η δήλωση — ή `null` όταν **δεν ξέρουμε**.
 *
 * ⚠️ **Η σιωπή είναι σωστή απάντηση**: επάγγελμα εκτός του πίνακα συγγένειας
 * δίνει `null`, ποτέ μαντεψιά *(`isco-job-affinity.ts` — «όπου δεν ξέρουμε,
 * σωπαίνουμε»)*. Οι διασταυρώσεις ESCO→O*NET της ίδιας της ΕΕ **δεν μπορούν
 * δομικά** να εκφράσουν «δεν ξέρω»· εδώ είναι ονομασμένη κατάσταση.
 */
function useSuggestedJobLabel(iscoCode: string | null): string | null {
  const { t } = useTranslation('navigation');
  const job = resolveJobAffinity(iscoCode);
  return job === null ? null : t(JOBS[job].labelKey);
}

export function DeclaredOccupationBadge({
  onNavigate,
  className,
}: DeclaredOccupationBadgeProps) {
  const { t } = useTranslation('navigation');
  const router = useRouter();
  const { occupation, confidence, iscoCode } = useDeclaredOccupation();
  const suggestedJob = useSuggestedJobLabel(iscoCode);

  const goToProfile = () => {
    onNavigate?.();
    router.push(ACCOUNT_ROUTES.profile);
  };

  // ── unknown ⇒ ΠΡΟΤΑΣΗ, ποτέ ερώτηση (Ε7.γ′) ───────────────────────────────
  // Το `unknown` σημαίνει «**δεν ρώτησε κανείς**», ποτέ «δεν έχει»
  // (useDeclaredOccupation.ts). Γι' αυτό το κείμενο δεν κατηγορεί.
  if (confidence === 'unknown') {
    return (
      <button
        type="button"
        onClick={goToProfile}
        className={cn(
          'flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left',
          'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
          className,
        )}
      >
        <CircleHelp className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block text-xs font-medium text-foreground">
            {t('jobs.occupation.declare')}
          </span>
          <span className="block text-xs leading-snug text-muted-foreground">
            {t('jobs.occupation.undeclaredHint')}
          </span>
        </span>
      </button>
    );
  }

  // ── declared / verified ⇒ τι είσαι, πόσο το ξέρουμε, τι κάνει ─────────────
  const isVerified = confidence === 'verified';
  // Αυθεντία της ετικέτας: το `escoLabel` όταν υπάρχει, αλλιώς ό,τι έγραψε ο
  // ίδιος. ⚠️ ΠΟΤΕ σκέτο `escoLabel`: στο **ελεύθερο κείμενο** — που είναι η
  // συνηθισμένη περίπτωση (ADR-132 §1) — λείπει, και η οθόνη θα έδειχνε **κενό**.
  const label = occupation?.escoLabel ?? occupation?.profession ?? '';

  return (
    <div className={cn('flex items-start gap-2 px-2 py-1.5', className)}>
      {isVerified ? (
        <BadgeCheck className={cn('mt-0.5 size-3.5 shrink-0', VERIFIED_TONE)} aria-hidden="true" />
      ) : (
        <Briefcase className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <div className="min-w-0">
        {/* Το `truncate` κόβει· το ολόκληρο κείμενο μένει προσβάσιμο από το
            ΚΕΝΤΡΙΚΟ Tooltip — ποτέ native `title=` (CHECK 3.23, ADR-350). */}
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="truncate text-xs font-medium text-foreground">{label}</p>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
        {/* §7 — η κατάσταση ΠΑΝΤΑ ορατή, με κείμενο (όχι μόνο χρώμα, 3.41). */}
        <p className={cn('text-xs leading-snug', isVerified ? VERIFIED_TONE : 'text-muted-foreground')}>
          {isVerified ? t('jobs.occupation.verified') : t('jobs.occupation.declared')}
        </p>
        {/* Η ΣΥΝΕΠΕΙΑ — από τον ίδιο πίνακα που την εκτελεί. */}
        <p className="text-xs leading-snug text-muted-foreground">
          {suggestedJob === null
            ? t('jobs.occupation.noSuggestion')
            : t('jobs.occupation.suggests', { job: suggestedJob })}
        </p>
      </div>
    </div>
  );
}
