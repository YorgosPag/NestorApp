'use client';

// =============================================================================
// 🔐 AUTH ACTION PAGE - FIREBASE EMAIL ACTION HANDLER
// =============================================================================
//
// Enterprise-grade email action handler for Firebase Authentication
// Handles: Email Verification, Password Reset, Email Recovery
//
// Following Fortune 500 standards (SAP, Salesforce, Microsoft, Google)
//
// Features:
// - Branded experience with app identity
// - Full i18n support (el/en)
// - Semantic HTML structure
// - Centralized design system
// - Proper error handling
// - Loading and success states
//
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import LogoPagonis from '@/components/property-viewer/Logo_Pagonis';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects/hover-effects';
import { TRANSITION_PRESETS } from '@/components/ui/effects/transitions';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { LanguageSwitcher } from '@/components/header/language-switcher';
import { ThemeToggle } from '@/components/header/theme-toggle';
import { Lock, CheckCircle, XCircle, AlertTriangle, Eye, EyeOff } from 'lucide-react';

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
// FIREBASE ERROR MAPPING
// =============================================================================

const mapFirebaseError = (error: unknown, t: (key: string) => string): string => {
  if (error instanceof Error) {
    const code = (error as { code?: string }).code;

    switch (code) {
      case 'auth/invalid-action-code':
        return t('action.errors.invalidCode');
      case 'auth/expired-action-code':
        return t('action.errors.expiredCode');
      case 'auth/user-not-found':
        return t('action.errors.userNotFound');
      case 'auth/weak-password':
        return t('action.errors.weakPassword');
      case 'auth/network-request-failed':
        return t('action.errors.networkError');
      default:
        return t('action.errors.generic');
    }
  }
  return t('action.errors.generic');
};

// =============================================================================
// AUTH ACTION PAGE COMPONENT
// =============================================================================

export default function AuthActionPage() {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('auth');

  // 🏢 ENTERPRISE: Next.js navigation
  const router = useRouter();
  const searchParams = useSearchParams();

  // 🏢 ENTERPRISE: Centralized design system hooks
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
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

  return (
    <main
      className={`${layout.shellAuthStandalone} ${colors.bg.primary}`}
      role="main"
      aria-label={getTitle()}
    >
      {/* 🏢 ENTERPRISE: Auth Toolbar - Language & Theme */}
      <nav
        className={layout.authToolbar}
        aria-label={t('navigation.settingsToolbar')}
      >
        <LanguageSwitcher />
        <ThemeToggle />
      </nav>

      <section className={layout.flexColGap4}>
        {/* 🏢 ENTERPRISE: App Branding - Logo + Name */}
        <header className={`${layout.flexColGap2} ${layout.textCenter}`}>
          <figure className={layout.centerHorizontal}>
            <LogoPagonis className={`${iconSizes.xl4} ${colors.text.primary}`} />
          </figure>
          <h1 className={`${typography.heading.xl} ${colors.text.primary}`}>
            Nestor Pagonis
          </h1>
        </header>

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
              <Alert variant="destructive" className={layout.marginBottom4}>
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
                <fieldset className={layout.flexColGap2}>
                  <label htmlFor="newPassword" className={typography.label.sm}>
                    {t('action.labels.newPassword')}
                  </label>
                  <div className={layout.inputContainer}>
                    <Lock className={`${layout.inputIconLeft} ${iconSizes.sm} ${colors.text.muted}`} />
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
                  </div>
                </fieldset>

                {/* Confirm Password Field */}
                <fieldset className={layout.flexColGap2}>
                  <label htmlFor="confirmPassword" className={typography.label.sm}>
                    {t('action.labels.confirmNewPassword')}
                  </label>
                  <div className={layout.inputContainer}>
                    <Lock className={`${layout.inputIconLeft} ${iconSizes.sm} ${colors.text.muted}`} />
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
                  </div>
                </fieldset>

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
                <Button
                  onClick={() => router.push('/login')}
                  className={layout.widthFull}
                >
                  {t('action.buttons.goToLogin')}
                </Button>
              </nav>
            )}

            {/* Error Actions */}
            {state.status === 'error' && (
              <nav className={`${layout.flexColGap2} ${layout.textCenter}`}>
                <Button
                  onClick={() => router.push('/login')}
                  className={layout.widthFull}
                >
                  {t('action.buttons.goToLogin')}
                </Button>
                <button
                  type="button"
                  onClick={() => router.push('/')}
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
          © 2026 Nestor Pagonis | Property Management System
        </footer>
      </section>
    </main>
  );
}
