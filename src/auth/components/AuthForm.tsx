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

// =============================================================================
// GOOGLE ICON - Official Google "G" Logo (Enterprise Branding)
// =============================================================================

interface GoogleIconProps {
  className?: string;
}

/**
 * Official Google "G" Logo following Google Brand Guidelines
 * Uses the official Google brand colors
 */
function GoogleIcon({ className }: GoogleIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
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
  givenName: string;
  familyName: string;
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
  const {
    signIn,
    signInWithGoogle,
    signUp,
    resetPassword,
    loading,
    error,
    clearError,
    // 🔐 MFA/2FA Support
    mfaRequired,
    verifyMfaCode,
    cancelMfaVerification
  } = useAuth();

  // Form state
  const [mode, setMode] = useState<AuthFormMode>(defaultMode);
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    givenName: '',
    familyName: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  // 🏢 ENTERPRISE: Redirect loading state for client-side navigation
  const [isRedirecting, setIsRedirecting] = useState(false);
  // 🔐 MFA/2FA verification state
  const [mfaCode, setMfaCode] = useState('');

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
    const { email, password, givenName, familyName, confirmPassword } = formData;

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

      if (!givenName.trim()) {
        return t('validation.givenNameRequired');
      }

      if (!familyName.trim()) {
        return t('validation.familyNameRequired');
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
      const { email, password, givenName, familyName } = formData;

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
        // 🏢 ENTERPRISE: Pass SignUpData object with structured name data
        await signUp({ email, password, givenName, familyName });
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
        givenName: '',
        familyName: '',
        confirmPassword: ''
      });
    } catch (err) {
      console.error('[ERROR] [AuthForm] Error:', err);
    } finally {
      setLocalLoading(false);
    }
  };

  // ==========================================================================
  // GOOGLE SIGN-IN HANDLER
  // ==========================================================================

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      setSuccessMessage(null);
      setValidationError(null);
      clearError();

      console.log('[ENTERPRISE] [AuthForm] Google Sign-In attempt');
      await signInWithGoogle();

      setSuccessMessage(t('google.success'));
      onSuccess?.();

      // Redirect after successful Google sign-in
      setIsRedirecting(true);
      console.log('[ENTERPRISE] [AuthForm] Redirecting to:', redirectTo);
      setTimeout(() => {
        router.push(redirectTo);
      }, 100);
    } catch (err) {
      console.error('[ERROR] [AuthForm] Google Sign-In error:', err);
    } finally {
      setGoogleLoading(false);
    }
  };

  // ==========================================================================
  // MFA VERIFICATION HANDLER
  // ==========================================================================

  const handleMfaVerification = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!mfaCode.trim() || mfaCode.length !== 6) {
      setValidationError(t('mfa.invalidCodeLength', 'Ο κωδικός πρέπει να είναι 6 ψηφία'));
      return;
    }

    setLocalLoading(true);
    setValidationError(null);

    try {
      await verifyMfaCode(mfaCode);
      // If successful, auth state listener will handle the redirect
      setSuccessMessage(t('mfa.verificationSuccess', 'Επαλήθευση επιτυχής!'));
      setIsRedirecting(true);
      setTimeout(() => {
        router.push(redirectTo);
      }, 100);
    } catch (err) {
      console.error('[ERROR] [AuthForm] MFA verification error:', err);
    } finally {
      setLocalLoading(false);
    }
  };

  const handleCancelMfa = () => {
    cancelMfaVerification();
    setMfaCode('');
    setValidationError(null);
  };

  const isLoading = loading || localLoading || googleLoading;
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
          <h1 className={`${typography.heading.lg} ${colors.text.primary}`}>
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

  // ==========================================================================
  // 🔐 MFA VERIFICATION UI
  // ==========================================================================
  // Enterprise 2FA verification screen when MFA is required
  if (mfaRequired) {
    return (
      <>
        {/* 🏢 ENTERPRISE: Auth Toolbar - Language & Theme */}
        <nav
          className={layout.authToolbar}
          aria-label={t('navigation.settingsToolbar', 'Ρυθμίσεις εμφάνισης')}
        >
          <LanguageSwitcher />
          <ThemeToggle />
        </nav>

        <section className={layout.flexColGap4}>
          {/* 🏢 ENTERPRISE: App Branding */}
          <header className={`${layout.flexColGap2} ${layout.textCenter}`}>
            <figure className={layout.centerHorizontal}>
              <LogoPagonis className={`${iconSizes.xl4} ${colors.text.primary}`} />
            </figure>
            <h1 className={`${typography.heading.lg} ${colors.text.primary}`}>
              Nestor Pagonis
            </h1>
          </header>

          <Card className={layout.cardAuthWidth}>
            <CardHeader className={layout.flexColGap2}>
              <CardTitle className={`${typography.heading.lg} ${layout.textCenter}`}>
                {t('mfa.title', 'Επαλήθευση δύο παραγόντων')}
              </CardTitle>
              <CardDescription className={layout.textCenter}>
                {t('mfa.description', 'Εισάγετε τον 6-ψήφιο κωδικό από την εφαρμογή αυθεντικοποίησης')}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleMfaVerification} className={layout.flexColGap4}>
                {/* Error Message */}
                {displayError && (
                  <Alert variant="destructive">
                    <AlertDescription>{displayError}</AlertDescription>
                  </Alert>
                )}

                {/* Success Message */}
                {successMessage && (
                  <Alert className={`${getStatusBorder('success')} ${colors.bg.success}`}>
                    <AlertDescription className={colors.text.success}>
                      {successMessage}
                    </AlertDescription>
                  </Alert>
                )}

                {/* MFA Code Input */}
                <fieldset className={layout.flexColGap2}>
                  <label htmlFor="mfaCode" className={typography.label.sm}>
                    {t('mfa.codeLabel', 'Κωδικός επαλήθευσης')}
                  </label>
                  <div className={layout.inputContainer}>
                    <Lock className={`${layout.inputIconLeft} ${iconSizes.sm} ${colors.text.muted}`} />
                    <Input
                      id="mfaCode"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder={t('mfa.codePlaceholder', '000000')}
                      value={mfaCode}
                      onChange={(e) => {
                        // Only allow digits
                        const value = e.target.value.replace(/\D/g, '');
                        setMfaCode(value);
                        setValidationError(null);
                        clearError();
                      }}
                      disabled={isLoading}
                      hasLeftIcon
                      required
                      autoComplete="one-time-code"
                      autoFocus
                    />
                  </div>
                  <p className={`${typography.body.sm} ${colors.text.muted}`}>
                    {t('mfa.codeHint', 'Ο κωδικός αλλάζει κάθε 30 δευτερόλεπτα')}
                  </p>
                </fieldset>

                {/* Submit Button */}
                <Button type="submit" className={layout.widthFull} disabled={isLoading}>
                  {isLoading && <Spinner size="small" className={layout.buttonIconSpacing} />}
                  {t('mfa.verifyButton', 'Επαλήθευση')}
                </Button>

                {/* Cancel Button */}
                <Button
                  type="button"
                  variant="outline"
                  className={layout.widthFull}
                  onClick={handleCancelMfa}
                  disabled={isLoading}
                >
                  {t('mfa.cancelButton', 'Ακύρωση')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      </>
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
          <h1 className={`${typography.heading.lg} ${colors.text.primary}`}>
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

          {/* Name Fields (Sign Up Only) - Enterprise: givenName + familyName */}
          {mode === 'signup' && (
            <>
              {/* Given Name (Όνομα) */}
              <fieldset className={layout.flexColGap2}>
                <label htmlFor="givenName" className={typography.label.sm}>{t('form.labels.givenName')}</label>
                <div className={layout.inputContainer}>
                  <User className={`${layout.inputIconLeft} ${iconSizes.sm} ${colors.text.muted}`} />
                  <Input
                    id="givenName"
                    type="text"
                    placeholder={t('form.placeholders.givenName')}
                    value={formData.givenName}
                    onChange={handleInputChange('givenName')}
                    disabled={isLoading}
                    hasLeftIcon
                    required
                    autoComplete="given-name"
                  />
                </div>
              </fieldset>

              {/* Family Name (Επώνυμο) */}
              <fieldset className={layout.flexColGap2}>
                <label htmlFor="familyName" className={typography.label.sm}>{t('form.labels.familyName')}</label>
                <div className={layout.inputContainer}>
                  <User className={`${layout.inputIconLeft} ${iconSizes.sm} ${colors.text.muted}`} />
                  <Input
                    id="familyName"
                    type="text"
                    placeholder={t('form.placeholders.familyName')}
                    value={formData.familyName}
                    onChange={handleInputChange('familyName')}
                    disabled={isLoading}
                    hasLeftIcon
                    required
                    autoComplete="family-name"
                  />
                </div>
              </fieldset>
            </>
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

          {/* Google Sign-In - Enterprise OAuth (Sign In & Sign Up modes only) */}
          {mode !== 'reset' && (
            <>
              {/* Divider */}
              <div className="relative flex items-center py-2" role="separator">
                <div className="flex-grow border-t border-border" />
                <span className={`mx-4 flex-shrink ${typography.body.sm} ${colors.text.muted}`}>
                  {t('google.divider')}
                </span>
                <div className="flex-grow border-t border-border" />
              </div>

              {/* Google Sign-In Button */}
              <Button
                type="button"
                variant="outline"
                className={layout.widthFull}
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                aria-label={t('google.buttonAriaLabel')}
              >
                {googleLoading ? (
                  <Spinner size="small" className={layout.buttonIconSpacing} />
                ) : (
                  <GoogleIcon className={`${iconSizes.sm} ${layout.buttonIconSpacing}`} />
                )}
                {t('google.signInButton')}
              </Button>
            </>
          )}

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
