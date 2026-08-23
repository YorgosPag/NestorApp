'use client';

// =============================================================================
// 🔐 AUTH ACTION CONTENT — FIREBASE EMAIL ACTION HANDLER
// =============================================================================
//
// Enterprise-grade email action handler for Firebase Authentication
// Handles: Email Verification, Password Reset, Email Recovery
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
// @enterprise ADR-040 · ADR-785 (CHECK 3.55)
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from '@/lib/workspace/navigation';
import { useSearchParams } from 'next/navigation';
import {
  applyActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
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
import { AuthToolbar, AuthBrandMark } from './AuthScreenChrome';
import { AuthField } from './AuthField';
import { Lock, CheckCircle, XCircle, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { AUTH_ROUTES } from '@/lib/routes';
import { getSpacingClass } from '@/lib/design-system';
import { mapFirebaseError } from './auth-action-errors';

// =============================================================================
// TYPES
// =============================================================================

type ActionMode = 'verifyEmail' | 'resetPassword' | 'recoverEmail';

type ActionStatus = 'loading' | 'success' | 'error' | 'input';

interface ActionState {
  status: ActionStatus;
  mode: ActionMode | null;
  email: string | null;
  errorMessage: string | null;
}

// =============================================================================
// AUTH ACTION CONTENT COMPONENT
// =============================================================================

export function AuthActionContent() {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('auth');

  // 🏢 ENTERPRISE: Next.js navigation
  const router = useRouter();
  const searchParams = useSearchParams();

  // 🏢 ENTERPRISE: Centralized design system hooks
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const typography = useTypography();
  const layout = useLayoutClasses();

  // ==========================================================================
  // STATE
  // ==========================================================================

  const [state, setState] = useState<ActionState>({
    status: 'loading',
    mode: null,
    email: null,
    errorMessage: null
  });

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ==========================================================================
  // URL PARAMETERS
  // ==========================================================================

  const mode = searchParams.get('mode') as ActionMode | null;
  const oobCode = searchParams.get('oobCode');

  // ==========================================================================
  // ACTION HANDLERS
  // ==========================================================================

  const handleVerifyEmail = useCallback(async (code: string) => {
    try {
      await applyActionCode(auth, code);
      setState({
        status: 'success',
        mode: 'verifyEmail',
        email: null,
        errorMessage: null
      });
    } catch (error) {
      setState({
        status: 'error',
        mode: 'verifyEmail',
        email: null,
        errorMessage: mapFirebaseError(error, t)
      });
    }
  }, [t]);

  const handlePreparePasswordReset = useCallback(async (code: string) => {
    try {
      const email = await verifyPasswordResetCode(auth, code);
      setState({
        status: 'input',
        mode: 'resetPassword',
        email,
        errorMessage: null
      });
    } catch (error) {
      setState({
        status: 'error',
        mode: 'resetPassword',
        email: null,
        errorMessage: mapFirebaseError(error, t)
      });
    }
  }, [t]);

  const handleRecoverEmail = useCallback(async (code: string) => {
    try {
      await applyActionCode(auth, code);
      setState({
        status: 'success',
        mode: 'recoverEmail',
        email: null,
        errorMessage: null
      });
    } catch (error) {
      setState({
        status: 'error',
        mode: 'recoverEmail',
        email: null,
        errorMessage: mapFirebaseError(error, t)
      });
    }
  }, [t]);

  // ==========================================================================
  // PROCESS ACTION ON MOUNT
  // ==========================================================================

  useEffect(() => {
    if (!oobCode) {
      setState({
        status: 'error',
        mode: null,
        email: null,
        errorMessage: t('action.errors.invalidCode')
      });
      return;
    }

    switch (mode) {
      case 'verifyEmail':
        handleVerifyEmail(oobCode);
        break;
      case 'resetPassword':
        handlePreparePasswordReset(oobCode);
        break;
      case 'recoverEmail':
        handleRecoverEmail(oobCode);
        break;
      default:
        setState({
          status: 'error',
          mode: null,
          email: null,
          errorMessage: t('action.errors.unknownMode')
        });
    }
  }, [mode, oobCode, handleVerifyEmail, handlePreparePasswordReset, handleRecoverEmail, t]);

  // ==========================================================================
  // PASSWORD RESET SUBMISSION
  // ==========================================================================

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      setState(prev => ({
        ...prev,
        errorMessage: t('validation.passwordMinLength')
      }));
      return;
    }

    if (newPassword !== confirmPassword) {
      setState(prev => ({
        ...prev,
        errorMessage: t('validation.passwordMismatch')
      }));
      return;
    }

    if (!oobCode) return;

    setIsSubmitting(true);
    setState(prev => ({ ...prev, errorMessage: null }));

    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setState({
        status: 'success',
        mode: 'resetPassword',
        email: state.email,
        errorMessage: null
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        errorMessage: mapFirebaseError(error, t)
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================================================
  // RENDER HELPERS
  // ==========================================================================

  const getTitle = (): string => {
    if (state.status === 'error') return t('action.titles.error');
    if (!state.mode) return t('action.descriptions.processing');
    return t(`action.titles.${state.mode}`);
  };

  const getDescription = (): string => {
    if (state.status === 'loading') {
      return state.mode === 'verifyEmail'
        ? t('action.descriptions.verifying')
        : t('action.descriptions.processing');
    }
    if (state.status === 'success' && state.mode) {
      return t(`action.messages.${state.mode === 'verifyEmail' ? 'emailVerified' : state.mode === 'resetPassword' ? 'passwordChanged' : 'emailRecovered'}`);
    }
    if (state.mode === 'resetPassword' && state.status === 'input') {
      return t('action.descriptions.resetPassword');
    }
    return '';
  };

  const getIcon = () => {
    const iconClass = iconSizes.xl2;

    if (state.status === 'loading') {
      return <Spinner size="large" />;
    }
    if (state.status === 'success') {
      return <CheckCircle className={`${iconClass} ${colors.text.success}`} />;
    }
    if (state.status === 'error') {
      return <XCircle className={`${iconClass} ${colors.text.error}`} />;
    }
    return <AlertTriangle className={`${iconClass} ${colors.text.warning}`} />;
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  // SSoT: το ίδιο κουμπί ζωγραφίζεται και στο success και στο error branch
  const goToLoginButton = (
    <Button
      onClick={() => router.push(AUTH_ROUTES.login)}
      className={layout.widthFull}
    >
      {t('action.buttons.goToLogin')}
    </Button>
  );

  // NOTE: Using <section> instead of <main> — το `(auth)/layout.tsx` παρέχει το <main> wrapper (ADR-777 §8.12)
  // This avoids nested <main> tags which cause HTML semantic issues
  return (
    <section
      className={`${layout.shellAuthStandalone} ${colors.bg.primary}`}
      aria-label={getTitle()}
    >
      <AuthToolbar />

      <section className={layout.flexColGap4}>
        <AuthBrandMark />

        <Card className={layout.cardAuthWidth}>
          <CardHeader className={`${layout.flexColGap2} ${layout.textCenter}`}>
            {/* Status Icon */}
            <figure className={layout.centerHorizontal} aria-hidden="true">
              {getIcon()}
            </figure>

            <CardTitle className={typography.heading.lg}>
              {getTitle()}
            </CardTitle>

            {getDescription() && (
              <CardDescription>
                {getDescription()}
              </CardDescription>
            )}
          </CardHeader>

          <CardContent>
            {/* Error Alert */}
            {state.errorMessage && (
              <Alert variant="destructive" className={getSpacingClass('m', 'md', 'b')}>
                <AlertDescription>{state.errorMessage}</AlertDescription>
              </Alert>
            )}

            {/* Password Reset Form */}
            {state.mode === 'resetPassword' && state.status === 'input' && (
              <form onSubmit={handlePasswordSubmit} className={layout.flexColGap4}>
                {/* Email Display */}
                {state.email && (
                  <p className={`${typography.body.sm} ${colors.text.muted} ${layout.textCenter}`}>
                    {state.email}
                  </p>
                )}

                {/* New Password Field */}
                <AuthField id="newPassword" label={t('action.labels.newPassword')} icon={Lock}>
                  <Input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isSubmitting}
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
                    {showPassword ? (
                      <EyeOff className={iconSizes.sm} />
                    ) : (
                      <Eye className={iconSizes.sm} />
                    )}
                  </button>
                </AuthField>

                {/* Confirm Password Field */}
                <AuthField id="confirmPassword" label={t('action.labels.confirmNewPassword')} icon={Lock}>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isSubmitting}
                    hasLeftIcon
                    required
                    minLength={6}
                  />
                </AuthField>

                {/* Submit Button */}
                <Button type="submit" className={layout.widthFull} disabled={isSubmitting}>
                  {isSubmitting && <Spinner size="small" className={layout.buttonIconSpacing} />}
                  {t('action.buttons.setPassword')}
                </Button>
              </form>
            )}

            {/* Success Actions */}
            {state.status === 'success' && (
              <nav className={`${layout.flexColGap2} ${layout.textCenter}`}>
                {goToLoginButton}
              </nav>
            )}

            {/* Error Actions */}
            {state.status === 'error' && (
              <nav className={`${layout.flexColGap2} ${layout.textCenter}`}>
                {goToLoginButton}
                <button
                  type="button"
                  onClick={() => router.push(AUTH_ROUTES.home)}
                  className={`${typography.body.sm} ${colors.text.info} ${INTERACTIVE_PATTERNS.BUTTON_LINK_HOVER}`}
                >
                  {t('action.buttons.goToHome')}
                </button>
              </nav>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <footer className={`${typography.body.xs} ${colors.text.muted} ${layout.textCenter}`}>
          {t('brand.footer')}
        </footer>
      </section>
    </section>
  );
}
