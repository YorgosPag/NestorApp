'use client';

// =============================================================================
// 🔐 AUTH ACTION CONTENT — FIREBASE EMAIL ACTION HANDLER
// =============================================================================
//
// Enterprise-grade email action handler for Firebase Authentication
// Handles: Email Verification, Password Reset, Email Recovery, Email Change (ADR-850)
//
// Following Fortune 500 standards (SAP, Salesforce, Microsoft, Google)
//
// 🔴 **ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΠΙΑ ΤΟ ΙΔΙΟ ΤΟ `page.tsx`** (ADR-785 / CHECK 3.55).
//
// Αυτό το component καλεί `useSearchParams()` — API που διαβάζει δεδομένα
// **αιτήματος**, άρα είναι **αδύνατο** να απαντηθεί σε χρόνο προαπόδοσης. Όσο
// ζούσε στο ίδιο το `page.tsx`, η διαδρομή `(auth)` δεν είχε **κανένα** όριο
// `<Suspense>` από πάνω της — και το `next build` **σταματούσε εκεί**:
//
//     ⨯ useSearchParams() should be wrapped in a suspense boundary at page
//       "/auth/action"  →  Export encountered an error, exiting the build.
//
// Δεν ήταν προειδοποίηση: **η παραγωγή δεν έφευγε καθόλου**. Το `docker-build.yml`
// (Tier 1) ήταν κόκκινο από **2026-08-11** — οκτώ μέρες, μηδέν deploy στο Netcup.
//
// Η θεραπεία είναι **αυτή που συστήνει το Next**: το hook ζει στο **μικρότερο**
// υποδέντρο, και το `page.tsx` το τυλίγει σε `<Suspense>`. Έτσι το κέλυφος
// **προαποδίδεται κανονικά** και μόνο αυτό το κομμάτι περιμένει το αίτημα —
// αντί για `force-dynamic`, που θα πετούσε τη στατική απόδοση ΟΛΗΣ της σελίδας.
// Ίδιο ιδίωμα με `src/app/(light)/search/results/page.tsx` και `oauth/consent`.
//
// ⚠️ Αν χρειαστεί να ξαναμπεί `useSearchParams` σε αρχείο διαδρομής, η CHECK 3.55
//    το μπλοκάρει **στο `git add`** — σε ~10s αντί για τα 22,6 λεπτά του build.
//
// 🔴 **ADR-850 — ΜΟΝΟ ΠΑΡΟΥΣΙΑΣΗ ΠΙΑ.** Η λογική *(ποιο mode, τι κάνει ο κωδικός,
// ποιος αποσυνδέεται)* ζει στο `useAuthActionCode.ts`, και το λεξιλόγιο των modes με
// τους πίνακες κειμένων στο `auth-action-modes.ts`. Αφορμή: το τέταρτο mode
// (`verifyAndChangeEmail`) θα έσπρωχνε αυτό το αρχείο πάνω από τις 500 γραμμές (N.7.1).
//
// Features:
// - Branded experience with app identity
// - Full i18n support (el/en)
// - Semantic HTML structure
// - Centralized design system
// - Proper error handling
// - Loading and success states
//
// @file auth/components/AuthActionContent.tsx
// @created 2026-01-27  (μετακόμισε από (auth)/auth/action/page.tsx, 2026-08-20)
// @enterprise ADR-040 · ADR-785 (CHECK 3.55) · ADR-850
// =============================================================================

import React, { useState } from 'react';
import { useRouter } from '@/lib/workspace/navigation';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects/hover-effects';
import { TRANSITION_PRESETS } from '@/components/ui/effects/transitions';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { AuthBrandMark } from './AuthScreenChrome';
import { AuthField } from './AuthField';
import { Lock, CheckCircle, XCircle, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { AUTH_ROUTES } from '@/lib/routes';
import { getSpacingClass } from '@/lib/design-system';
import {
  ACTION_PENDING_KEYS,
  ACTION_SUCCESS_KEYS,
  ACTION_TITLE_KEYS,
  parseAuthActionMode,
} from './auth-action-modes';
import {
  useAuthActionCode,
  type ActionStatus,
  type AuthActionCodeFlow,
  type RecoveryResetState,
} from './useAuthActionCode';

// =============================================================================
// AUTH ACTION CONTENT COMPONENT
// =============================================================================

export function AuthActionContent() {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const typography = useTypography();
  const layout = useLayoutClasses();
  const colors = useSemanticColors();

  // 🔑 **Φρουρός, όχι cast**: άγνωστο mode ⇒ `null` ⇒ «Άγνωστη ενέργεια».
  const flow = useAuthActionCode(
    parseAuthActionMode(searchParams.get('mode')),
    searchParams.get('oobCode'),
    t,
  );
  const { state } = flow;

  function titleOf(): string {
    if (state.status === 'error') return t('action.titles.error');
    if (state.mode === null) return t('action.descriptions.processing');
    return t(ACTION_TITLE_KEYS[state.mode]);
  }

  // ⚠️ **Πρόωρες επιστροφές, ένα `t()` ανά κλειδί** — εδώ ζούσε ternary τριών επιπέδων,
  //    και ο στατικός τεμαχιστής i18n βλέπει κλειδιά **ονομαστικά**, όχι μέσα σε `?:`.
  function descriptionOf(): string {
    if (state.status === 'loading') {
      return state.mode === null ? t('action.descriptions.processing') : t(ACTION_PENDING_KEYS[state.mode]);
    }
    if (state.status === 'success' && state.mode !== null) {
      return t(ACTION_SUCCESS_KEYS[state.mode], { email: state.email ?? '' });
    }
    if (state.status === 'input') return t('action.descriptions.resetPassword');
    return '';
  }

  const title = titleOf();
  const description = descriptionOf();

  // NOTE: Using <section> instead of <main> — το `(auth)/layout.tsx` παρέχει το <main> wrapper (ADR-777 §8.12)
  // ⚠️ Ούτε `shellAuthStandalone` εδώ (ADR-797 ΦΑΣΗ Β): το «γέμισε το παράθυρο και
  //    κεντράρισε» το δηλώνει **μία φορά** το `<main>` του `(auth)/layout.tsx`.
  return (
    <section className={layout.flexColGap4} aria-label={title}>
      {/* 🔴 Η μπάρα ρυθμίσεων ζει πλέον στο `(auth)/layout.tsx` (ADR-809). */}
      <section className={layout.flexColGap4}>
        <AuthBrandMark />

        <Card className={layout.cardAuthWidth}>
          <CardHeader className={`${layout.flexColGap2} ${layout.textCenter}`}>
            <figure className={layout.centerHorizontal} aria-hidden="true">
              <StatusIcon status={state.status} />
            </figure>
            <CardTitle className={typography.heading.lg}>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>

          <CardContent>
            <ActionBody flow={flow} onLogin={() => router.push(AUTH_ROUTES.login)} onHome={() => router.push(AUTH_ROUTES.home)} />
          </CardContent>
        </Card>

        <footer className={`${typography.body.xs} ${colors.text.muted} ${layout.textCenter}`}>
          {t('brand.footer')}
        </footer>
      </section>
    </section>
  );
}

// =============================================================================
// RENDER PIECES
// =============================================================================

function StatusIcon({ status }: { readonly status: ActionStatus }) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  if (status === 'loading') return <Spinner size="large" />;
  if (status === 'success') return <CheckCircle className={`${iconSizes.xl2} ${colors.text.success}`} />;
  if (status === 'error') return <XCircle className={`${iconSizes.xl2} ${colors.text.error}`} />;
  return <AlertTriangle className={`${iconSizes.xl2} ${colors.text.warning}`} />;
}

function ActionBody({
  flow,
  onLogin,
  onHome,
}: {
  readonly flow: AuthActionCodeFlow;
  readonly onLogin: () => void;
  readonly onHome: () => void;
}) {
  const { t } = useTranslation('auth');
  const colors = useSemanticColors();
  const typography = useTypography();
  const layout = useLayoutClasses();
  const { state } = flow;

  // SSoT: το ίδιο κουμπί ζωγραφίζεται και στο success και στο error branch
  const goToLoginButton = (
    <Button onClick={onLogin} className={layout.widthFull}>
      {t('action.buttons.goToLogin')}
    </Button>
  );

  return (
    <>
      {state.errorMessage && (
        <Alert variant="destructive" className={getSpacingClass('m', 'md', 'b')}>
          <AlertDescription>{state.errorMessage}</AlertDescription>
        </Alert>
      )}

      {state.mode === 'resetPassword' && state.status === 'input' && <PasswordResetForm flow={flow} />}

      {state.status === 'success' && state.mode === 'recoverEmail' && (
        <RecoveryResetAction state={flow.recoveryReset} email={state.email} onSend={flow.sendRecoveryReset} />
      )}

      {state.status === 'success' && (
        <nav className={`${layout.flexColGap2} ${layout.textCenter}`}>{goToLoginButton}</nav>
      )}

      {state.status === 'error' && (
        <nav className={`${layout.flexColGap2} ${layout.textCenter}`}>
          {goToLoginButton}
          <button
            type="button"
            onClick={onHome}
            className={`${typography.body.sm} ${colors.text.info} ${INTERACTIVE_PATTERNS.BUTTON_LINK_HOVER}`}
          >
            {t('action.buttons.goToHome')}
          </button>
        </nav>
      )}
    </>
  );
}

/**
 * **Νέος κωδικός μετά από ανάκτηση email** (ADR-850).
 *
 * 🔑 Η σύσταση της ίδιας της Firebase για το `recoverEmail`: αν την αλλαγή την έκανε
 * **άλλος**, η επαναφορά του email δεν αρκεί — ο νέος κωδικός τον κλειδώνει έξω. Είναι
 * και η άμυνα στο δηλωμένο υπόλοιπο του ADR-844 §13 (εκκρεμής αλλαγή email επιτιθέμενου).
 */
function RecoveryResetAction({
  state,
  email,
  onSend,
}: {
  readonly state: RecoveryResetState;
  readonly email: string | null;
  readonly onSend: () => Promise<void>;
}) {
  const { t } = useTranslation('auth');
  const colors = useSemanticColors();
  const typography = useTypography();
  const layout = useLayoutClasses();
  if (email === null) return null;

  return (
    <section className={`${layout.flexColGap2} ${getSpacingClass('m', 'md', 'b')}`}>
      <Button
        variant="outline"
        className={layout.widthFull}
        onClick={() => { void onSend(); }}
        disabled={state === 'sending' || state === 'sent'}
      >
        {state === 'sending' ? t('action.buttons.sendingReset') : t('action.buttons.resetAfterRecovery')}
      </Button>
      {state === 'sent' && (
        <output role="status" className={`${typography.body.sm} ${colors.text.success} ${layout.textCenter}`}>
          {t('action.messages.resetSent', { email })}
        </output>
      )}
      {state === 'failed' && (
        <output role="alert" className={`${typography.body.sm} ${colors.text.error} ${layout.textCenter}`}>
          {t('action.errors.resetFailed')}
        </output>
      )}
    </section>
  );
}

function PasswordResetForm({ flow }: { readonly flow: AuthActionCodeFlow }) {
  const { t } = useTranslation('auth');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const typography = useTypography();
  const layout = useLayoutClasses();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void flow.submitNewPassword(newPassword, confirmPassword); }}
      className={layout.flexColGap4}
    >
      {flow.state.email && (
        <p className={`${typography.body.sm} ${colors.text.muted} ${layout.textCenter}`}>{flow.state.email}</p>
      )}

      <AuthField id="newPassword" label={t('action.labels.newPassword')} icon={Lock}>
        <Input
          id="newPassword"
          type={showPassword ? 'text' : 'password'}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={flow.submitting}
          hasLeftIcon
          hasRightIcon
          required
          minLength={6}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className={`${layout.inputIconRight} ${colors.text.muted} ${INTERACTIVE_PATTERNS.TEXT_HOVER} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
          tabIndex={-1}
          aria-label={showPassword ? t('form.accessibility.hidePassword') : t('form.accessibility.showPassword')}
        >
          {showPassword ? <EyeOff className={iconSizes.sm} /> : <Eye className={iconSizes.sm} />}
        </button>
      </AuthField>

      <AuthField id="confirmPassword" label={t('action.labels.confirmNewPassword')} icon={Lock}>
        <Input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={flow.submitting}
          hasLeftIcon
          required
          minLength={6}
        />
      </AuthField>

      <Button type="submit" className={layout.widthFull} disabled={flow.submitting}>
        {flow.submitting && <Spinner size="small" className={layout.buttonIconSpacing} />}
        {t('action.buttons.setPassword')}
      </Button>
    </form>
  );
}
