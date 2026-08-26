/**
 * =============================================================================
 * 🔐 AUTH SCREEN CHROME — ΤΟ ΚΟΙΝΟ ΠΛΑΙΣΙΟ ΤΩΝ ΟΘΟΝΩΝ ΣΥΝΔΕΣΗΣ (SSoT)
 * =============================================================================
 *
 * Η μπάρα ρυθμίσεων (γλώσσα + θέμα) και το σήμα του προϊόντος ζωγραφίζονταν
 * **αυτούσια σε τρία αρχεία**: `AuthForm.tsx` · `MfaVerificationForm.tsx` ·
 * `AuthActionContent.tsx`. Το CHECK 3.28 (jscpd) το ανέφερε τη στιγμή που η
 * ADR-744 §18 έκανε τα δύο πρώτα **token-ταυτόσημα** — μέχρι τότε διέφεραν μόνο
 * στο `state.t(...)` έναντι `t(...)`, δηλαδή ο token-based ανιχνευτής ήταν τυφλός
 * σε ένα δίδυμο που υπήρχε **από την πρώτη μέρα**.
 *
 * 🔴 ΚΑΙ ΤΑ ΤΡΙΑ ΑΝΤΙΓΡΑΦΑ ΕΙΧΑΝ ΗΔΗ ΑΠΟΚΛΙΝΕΙ, ΟΠΩΣ ΠΑΝΤΑ. Το
 * `AuthActionContent.tsx` έγραφε σωστά `{t('brand.name')}`· τα άλλα δύο είχαν
 * **σκληρό `"Nestor App"`** με `eslint-disable custom/no-hardcoded-strings` από
 * πάνω — δηλαδή δύο παραβιάσεις του N.11 που ζούσαν πίσω από σίγαση, ενώ ο
 * σωστός δρόμος υπήρχε στο διπλανό αρχείο. Η ενοποίηση σβήνει και τις δύο.
 *
 * ⚠️ **ΤΟ NAMESPACE ΔΗΛΩΝΕΤΑΙ ΕΔΩ, ΔΕΝ ΔΑΝΕΙΖΕΤΑΙ** (ADR-744 §18). Ένα component
 * που παίρνει το `t` ως prop δηλώνει **μηδέν** namespace, και τότε ο generator του
 * shell slice αποδίδει τα κλειδιά του σε `targets = []` — τα χάνει **σιωπηλά**.
 * Γι' αυτό εδώ υπάρχει `useTranslation('auth')` και **καμία prop `t`**.
 *
 * @module auth/components/AuthScreenChrome
 * @see docs/centralized-systems/reference/adrs/ADR-744-i18n-shell-slice.md §18
 */

'use client';

import '@/lib/design-system';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import LogoPagonis from '@/components/property-viewer/Logo_Pagonis';
import { ShellUtilities } from '@/core/containers/ShellUtilities';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';

/** Η μπάρα ρυθμίσεων πάνω δεξιά: γλώσσα + θέμα. */
export function AuthToolbar() {
  const layout = useLayoutClasses();
  const { t } = useTranslation('auth');

  return (
    <nav className={layout.authToolbar} aria-label={t('navigation.settingsToolbar')}>
      {/*
        ✅ ADR-809 / CHECK 3.72 — ΕΝΑΣ ιδιοκτήτης των καθολικών δυνατοτήτων.
        Εδώ ήταν ο ΔΕΥΤΕΡΟΣ συναρμολογητής, και είχε ήδη αποκλίνει από τον
        `AppHeader`: έδινε **δύο** από τις τρεις.

        🔑 Ο λογαριασμός ΔΕΝ αποδίδεται εδώ, και **χωρίς καμία δήλωση**: το
        `UserMenu` κρίνει την ταυτότητα μόνο του, και σε αυτές τις οθόνες ο
        άνθρωπος **δεν έχει συνδεθεί ακόμη** ⇒ επιστρέφει `null`. Δομικά σωστό,
        όχι κατόπιν ρύθμισης — μια σημαία `account={false}` θα ήταν δεύτερη
        αλήθεια που θα απέκλινε.

        ⚠️ ΚΑΝΕΝΑ `signedOutAction`: μια πόρτα «Σύνδεση» πάνω στην **ίδια** την
        οθόνη σύνδεσης θα ήταν σύνδεσμος προς τον εαυτό της.
      */}
      <ShellUtilities />
    </nav>
  );
}

/**
 * Το σήμα του προϊόντος: λογότυπο + όνομα.
 *
 * Το `as` υπάρχει επειδή η ίδια σήμανση εμφανίζεται **και** ως επικεφαλίδα
 * ενότητας (`header`) **και** μέσα σε οθόνη κατάστασης, όπου ένα `<header>`
 * θα ήταν σημασιολογικά λάθος.
 */
export function AuthBrandMark({ as = 'header' }: { readonly as?: 'header' | 'fragment' }) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const typography = useTypography();
  const layout = useLayoutClasses();
  const { t } = useTranslation('auth');

  const mark = (
    <>
      <figure className={layout.centerHorizontal}>
        <LogoPagonis className={`${iconSizes.xl4} ${colors.text.primary}`} />
      </figure>
      <h1 className={`${typography.heading.lg} ${colors.text.primary}`}>{t('brand.name')}</h1>
    </>
  );

  if (as === 'fragment') return mark;
  return <header className={`${layout.flexColGap2} ${layout.textCenter}`}>{mark}</header>;
}

/**
 * Η ολόκληρη οθόνη σύνδεσης: μπάρα ρυθμίσεων, σήμα, και η κάρτα με τίτλο/περιγραφή.
 *
 * ⚠️ Ο **τίτλος** και η **περιγραφή** έρχονται ήδη μεταφρασμένα από τον καλούντα,
 * επίτηδες: το `AuthForm` τα διαλέγει από πίνακα ανά κατάσταση
 * (`titles[mode]`) ενώ το `MfaVerificationForm` έχει σταθερά κλειδιά. Ένα prop
 * `titleKey` θα ανάγκαζε το πρώτο να ξαναφτιάξει τον πίνακα εδώ.
 *
 * ⚠️ Το `AuthActionContent` **ΔΕΝ** το χρησιμοποιεί, και ο λόγος είναι δομικός: εκείνο
 * τυλίγει τα πάντα σε δικό του `<section aria-label={…}>` και δείχνει **τέσσερις**
 * διαφορετικές καταστάσεις (loading · success · error · input) με διαφορετική κάρτα.
 * Να το χωρέσει εδώ θα σήμαινε props για κάθε παραλλαγή — δηλαδή αφαίρεση που
 * περιγράφει τους καλούντες αντί για το κοινό.
 */
export function AuthScreen({ title, description, children }: {
  readonly title: React.ReactNode;
  readonly description: React.ReactNode;
  readonly children: React.ReactNode;
}) {
  const typography = useTypography();
  const layout = useLayoutClasses();

  return (
    <>
      {/*
        🔴 Η `<AuthToolbar />` **ΕΦΥΓΕ από εδώ** (2026-08-26, ADR-809). Ζούσε σε **τρία**
        σημεία μέσα στο δέντρο της σελίδας, άρα οι δύο οθόνες του `(auth)` που
        δεν περνούν από εδώ (`/oauth/consent` · `/mandate/[token]`) είχαν **μηδέν**
        γλώσσα και **μηδέν** θέμα. Πλέον ζει στο `(auth)/layout.tsx`, όπως σε
        **κάθε άλλη** γειτονιά — μία απόδοση αντί για τρεις.
        ⚠️ **ΜΗΝ την ξαναβάλεις εδώ** — θα αποδιδόταν ΔΥΟ φορές.
      */}
      <section className={layout.flexColGap4}>
        <AuthBrandMark />

        <Card className={layout.cardAuthWidth}>
          <CardHeader className={layout.flexColGap2}>
            <CardTitle className={`${typography.heading.lg} ${layout.textCenter}`}>
              {title}
            </CardTitle>
            <CardDescription className={layout.textCenter}>{description}</CardDescription>
          </CardHeader>

          {children}
        </Card>
      </section>
    </>
  );
}
