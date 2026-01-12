'use client';

// =============================================================================
// 🔐 AUTH FORM - UNIFIED AUTHENTICATION FORM
// =============================================================================
//
// Enterprise-grade authentication form with multiple modes:
// - Sign In: Email/password login
// - Sign Up: New account registration
// - Reset Password: Password recovery
//
// Features:
// - Form validation
// - Password visibility toggle
// - Localized error messages
// - Loading states
// - Success feedback
//
// =============================================================================

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
// 🏢 ENTERPRISE: Centralized Spinner component
import { Spinner } from '@/components/ui/spinner';
// 🏢 ENTERPRISE: App Logo for branding
import LogoPagonis from '@/components/property-viewer/Logo_Pagonis';
// 🏢 ENTERPRISE: Centralized design system hooks
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
// 🏢 ENTERPRISE: Centralized hover/transition effects
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects/hover-effects';
import { TRANSITION_PRESETS } from '@/components/ui/effects/transitions';
import type { AuthFormMode, AuthFormProps } from '../types/auth.types';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Reuse existing header components for auth pages (ADR-020.1)
import { LanguageSwitcher } from '@/components/header/language-switcher';
import { ThemeToggle } from '@/components/header/theme-toggle';

// =============================================================================
// FORM STATE INTERFACE
// =============================================================================

interface FormData {
  email: string;
  password: string;
  displayName: string;
  confirmPassword: string;
}

// =============================================================================
// AUTH FORM COMPONENT
// =============================================================================

export function AuthForm({
  defaultMode = 'signin',
  onSuccess,
  redirectTo = '/'
}: AuthFormProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('auth');
  // 🏢 ENTERPRISE: Next.js router for navigation
  const router = useRouter();
  // 🏢 ENTERPRISE: Centralized design system hooks
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const typography = useTypography();
  const layout = useLayoutClasses();
  const { signIn, signUp, resetPassword, loading, error, clearError } = useAuth();

  // Form state
  const [mode, setMode] = useState<AuthFormMode>(defaultMode);
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    displayName: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  // 🏢 ENTERPRISE: Redirect loading state for client-side navigation
  const [isRedirecting, setIsRedirecting] = useState(false);

  // ==========================================================================
  // FORM HANDLERS
  // ==========================================================================

  const handleInputChange = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
    clearError();
    setSuccessMessage(null);
    setValidationError(null);
  };

  const validateForm = (): string | null => {
    const { email, password, displayName, confirmPassword } = formData;

    if (!email.trim()) {
      return t('validation.emailRequired');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return t('validation.emailInvalid');
    }

    if (mode !== 'reset' && !password) {
      return t('validation.passwordRequired');
    }

    if (mode === 'signup') {
      if (password.length < 6) {
        return t('validation.passwordMinLength');
      }

      if (password !== confirmPassword) {
        return t('validation.passwordMismatch');
      }

      if (!displayName.trim()) {
        return t('validation.displayNameRequired');
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const error = validateForm();
    if (error) {
      setValidationError(error);
      return;
    }

    setLocalLoading(true);
    setSuccessMessage(null);
    setValidationError(null);

    try {
      const { email, password, displayName } = formData;

      if (mode === 'signin') {
        console.log('🔐 [AuthForm] Sign in attempt');
        await signIn(email, password);
        setSuccessMessage(t('messages.signinSuccess'));
        onSuccess?.();
        // 🏢 ENTERPRISE: Show loading overlay before redirect
        setIsRedirecting(true);
        console.log('🚀 [AuthForm] Redirecting to:', redirectTo);
        // Small delay to show the loading state before navigation
        setTimeout(() => {
          router.push(redirectTo);
        }, 100);
        return; // Exit early, no need to continue
      } else if (mode === 'signup') {
        console.log('🔐 [AuthForm] Sign up attempt');
        await signUp(email, password, displayName);
        setSuccessMessage(t('messages.signupSuccess'));
        onSuccess?.();
      } else if (mode === 'reset') {
        console.log('🔐 [AuthForm] Password reset attempt');
        await resetPassword(email);
        setSuccessMessage(t('messages.resetEmailSent'));
        setMode('signin');
      }

      // Clear form on success
      setFormData({
        email: mode === 'reset' ? formData.email : '',
        password: '',
        displayName: '',
        confirmPassword: ''
      });
    } catch (err) {
      console.error('🔐 [AuthForm] Error:', err);
    } finally {
      setLocalLoading(false);
    }
  };

  const isLoading = loading || localLoading;
  const displayError = validationError || error;

  // ==========================================================================
  // MODE-SPECIFIC CONTENT (i18n)
  // ==========================================================================

  const titles: Record<AuthFormMode, string> = {
    signin: t('form.titles.signin'),
    signup: t('form.titles.signup'),
    reset: t('form.titles.reset')
  };

  const descriptions: Record<AuthFormMode, string> = {
    signin: t('form.descriptions.signin'),
    signup: t('form.descriptions.signup'),
    reset: t('form.descriptions.reset')
  };

  const submitTexts: Record<AuthFormMode, string> = {
    signin: t('form.submitButtons.signin'),
    signup: t('form.submitButtons.signup'),
    reset: t('form.submitButtons.reset')
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  // 🏢 ENTERPRISE: Full-screen loading overlay during redirect
  // This provides immediate visual feedback during client-side navigation
  if (isRedirecting) {
    return (
      <main
        className={`${layout.shellAuthStandalone} ${colors.bg.primary}`}
        role="main"
        aria-label={t('navigation.redirecting', 'Μεταφορά στην εφαρμογή')}
      >
        <section
          className={`${layout.flexColGap4} ${layout.textCenter}`}
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          {/* Logo */}
          <figure className={layout.centerHorizontal}>
            <LogoPagonis className={`${iconSizes.xl4} ${colors.text.primary}`} />
          </figure>

          {/* App Name */}
          <h1 className={`${typography.heading.xl} ${colors.text.primary}`}>
            Nestor Pagonis
          </h1>

          {/* Spinner */}
          <figure className={layout.centerHorizontal}>
            <Spinner size="large" aria-label={t('loading.spinnerLabel', 'Φόρτωση')} />
          </figure>

          {/* Loading message */}
          <p className={`${typography.body.base} ${colors.text.muted}`}>
            {t('navigation.loadingApp', 'Μεταφορά στην εφαρμογή...')}
          </p>
        </section>
      </main>
    );
  }

  return (
    <>
      {/* 🏢 ENTERPRISE: Auth Toolbar - Language & Theme (Microsoft/Google pattern) */}
      <nav
        className={layout.authToolbar}
        aria-label={t('navigation.settingsToolbar', 'Ρυθμίσεις εμφάνισης')}
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
        <CardHeader className={layout.flexColGap2}>
          <CardTitle className={`${typography.heading.lg} ${layout.textCenter}`}>{titles[mode]}</CardTitle>
          <CardDescription className={layout.textCenter}>
            {descriptions[mode]}
          </CardDescription>
        </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className={layout.flexColGap4}>
          {/* Success Message */}
          {successMessage && (
            <Alert className={`${getStatusBorder('success')} ${colors.bg.success}`}>
              <AlertDescription className={colors.text.success}>
                {successMessage}
              </AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {displayError && (
            <Alert variant="destructive">
              <AlertDescription>{displayError}</AlertDescription>
            </Alert>
          )}

          {/* Email Field */}
          <fieldset className={layout.flexColGap2}>
            <label htmlFor="email" className={typography.label.sm}>{t('form.labels.email')}</label>
            <div className={layout.inputContainer}>
              <Mail className={`${layout.inputIconLeft} ${iconSizes.sm} ${colors.text.muted}`} />
              <Input
                id="email"
                type="email"
                placeholder={t('form.placeholders.email')}
                value={formData.email}
                onChange={handleInputChange('email')}
                disabled={isLoading}
                hasLeftIcon
                required
              />
            </div>
          </fieldset>

          {/* Display Name Field (Sign Up Only) */}
          {mode === 'signup' && (
            <fieldset className={layout.flexColGap2}>
              <label htmlFor="displayName" className={typography.label.sm}>{t('form.labels.displayName')}</label>
              <div className={layout.inputContainer}>
                <User className={`${layout.inputIconLeft} ${iconSizes.sm} ${colors.text.muted}`} />
                <Input
                  id="displayName"
                  type="text"
                  placeholder={t('form.placeholders.displayName')}
                  value={formData.displayName}
                  onChange={handleInputChange('displayName')}
                  disabled={isLoading}
                  hasLeftIcon
                  required
                />
              </div>
            </fieldset>
          )}

          {/* Password Field */}
          {mode !== 'reset' && (
            <fieldset className={layout.flexColGap2}>
              <label htmlFor="password" className={typography.label.sm}>{t('form.labels.password')}</label>
              <div className={layout.inputContainer}>
                <Lock className={`${layout.inputIconLeft} ${iconSizes.sm} ${colors.text.muted}`} />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('form.placeholders.password')}
                  value={formData.password}
                  onChange={handleInputChange('password')}
                  disabled={isLoading}
                  hasLeftIcon
                  hasRightIcon
                  required
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
          )}

          {/* Confirm Password Field (Sign Up Only) */}
          {mode === 'signup' && (
            <fieldset className={layout.flexColGap2}>
              <label htmlFor="confirmPassword" className={typography.label.sm}>{t('form.labels.confirmPassword')}</label>
              <div className={layout.inputContainer}>
                <Lock className={`${layout.inputIconLeft} ${iconSizes.sm} ${colors.text.muted}`} />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder={t('form.placeholders.password')}
                  value={formData.confirmPassword}
                  onChange={handleInputChange('confirmPassword')}
                  disabled={isLoading}
                  hasLeftIcon
                  required
                />
              </div>
            </fieldset>
          )}

          {/* Submit Button */}
          <Button type="submit" className={layout.widthFull} disabled={isLoading}>
            {isLoading && <Spinner size="small" className={layout.buttonIconSpacing} />}
            {submitTexts[mode]}
          </Button>

          {/* Mode Switch Links */}
          <nav className={`${layout.textCenter} ${layout.flexColGap2}`} aria-label={t('form.navigation.loginOptions')}>
            {mode === 'signin' && (
              <>
                <button
                  type="button"
                  onClick={() => setMode('reset')}
                  className={`${typography.body.sm} ${colors.text.info} ${INTERACTIVE_PATTERNS.BUTTON_LINK_HOVER}`}
                >
                  {t('form.navigation.forgotPassword')}
                </button>
                <p>
                  <span className={`${typography.body.sm} ${colors.text.muted}`}>{t('form.navigation.noAccount')} </span>
                  <button
                    type="button"
                    onClick={() => setMode('signup')}
                    className={`${typography.body.sm} ${colors.text.info} ${INTERACTIVE_PATTERNS.BUTTON_LINK_HOVER}`}
                  >
                    {t('form.navigation.signup')}
                  </button>
                </p>
              </>
            )}

            {mode === 'signup' && (
              <p>
                <span className={`${typography.body.sm} ${colors.text.muted}`}>{t('form.navigation.hasAccount')} </span>
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className={`${typography.body.sm} ${colors.text.info} ${INTERACTIVE_PATTERNS.BUTTON_LINK_HOVER}`}
                >
                  {t('form.navigation.signin')}
                </button>
              </p>
            )}

            {mode === 'reset' && (
              <button
                type="button"
                onClick={() => setMode('signin')}
                className={`${typography.body.sm} ${colors.text.info} ${INTERACTIVE_PATTERNS.BUTTON_LINK_HOVER}`}
              >
                {t('form.navigation.backToSignin')}
              </button>
            )}
          </nav>
        </form>
      </CardContent>
      </Card>
    </section>
    </>
  );
}

// =============================================================================
// LEGACY EXPORTS FOR BACKWARD COMPATIBILITY
// =============================================================================

export { AuthForm as FirebaseLoginForm };
export default AuthForm;
