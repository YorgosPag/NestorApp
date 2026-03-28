// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
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
// Split: GoogleIcon, useAuthFormState, MfaVerificationForm (Google SRP)
// =============================================================================

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import LogoPagonis from '@/components/property-viewer/Logo_Pagonis';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects/hover-effects';
import { TRANSITION_PRESETS } from '@/components/ui/effects/transitions';
import { LanguageSwitcher } from '@/components/header/language-switcher';
import { ThemeToggle } from '@/components/header/theme-toggle';
import type { AuthFormProps } from '../types/auth.types';
import { AUTH_ROUTES } from '@/lib/routes';
import { GoogleIcon } from './GoogleIcon';
import { MfaVerificationForm } from './MfaVerificationForm';
import { useAuthFormState } from '../hooks/useAuthFormState';
import '@/lib/design-system';

// =============================================================================
// AUTH FORM COMPONENT
// =============================================================================

export function AuthForm({
  defaultMode = 'signin',
  onSuccess,
  redirectTo = AUTH_ROUTES.home,
}: AuthFormProps) {
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const typography = useTypography();
  const layout = useLayoutClasses();

  const state = useAuthFormState({ defaultMode, onSuccess, redirectTo });

  // ==========================================================================
  // RENDER: Redirect Loading Overlay
  // ==========================================================================

  if (state.isRedirecting) {
    return (
      <main
        className={`${layout.shellAuthStandalone} ${colors.bg.primary}`}
        role="main"
        aria-label={state.t('navigation.redirecting')}
      >
        <section
          className={`${layout.flexColGap4} ${layout.textCenter}`}
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <figure className={layout.centerHorizontal}>
            <LogoPagonis className={`${iconSizes.xl4} ${colors.text.primary}`} />
          </figure>
          {/* eslint-disable-next-line custom/no-hardcoded-strings */}
          <h1 className={`${typography.heading.lg} ${colors.text.primary}`}>Nestor Pagonis</h1>
          <figure className={layout.centerHorizontal}>
            <Spinner size="large" aria-label={state.t('loading.spinnerLabel')} />
          </figure>
          <p className={`${typography.body.base} ${colors.text.muted}`}>
            {state.t('navigation.loadingApp')}
          </p>
        </section>
      </main>
    );
  }

  // ==========================================================================
  // RENDER: MFA Verification
  // ==========================================================================

  if (state.mfaRequired) {
    return (
      <MfaVerificationForm
        mfaCode={state.mfaCode}
        onMfaCodeChange={state.handleMfaCodeChange}
        onSubmit={state.handleMfaVerification}
        onCancel={state.handleCancelMfa}
        isLoading={state.isLoading}
        displayError={state.displayError}
        successMessage={state.successMessage}
        t={state.t}
      />
    );
  }

  // ==========================================================================
  // RENDER: Main Auth Form (Sign In / Sign Up / Reset)
  // ==========================================================================

  return (
    <>
      <nav className={layout.authToolbar} aria-label={state.t('navigation.settingsToolbar')}>
        <LanguageSwitcher />
        <ThemeToggle />
      </nav>

      <section className={layout.flexColGap4}>
        <header className={`${layout.flexColGap2} ${layout.textCenter}`}>
          <figure className={layout.centerHorizontal}>
            <LogoPagonis className={`${iconSizes.xl4} ${colors.text.primary}`} />
          </figure>
          {/* eslint-disable-next-line custom/no-hardcoded-strings */}
          <h1 className={`${typography.heading.lg} ${colors.text.primary}`}>Nestor Pagonis</h1>
        </header>

        <Card className={layout.cardAuthWidth}>
          <CardHeader className={layout.flexColGap2}>
            <CardTitle className={`${typography.heading.lg} ${layout.textCenter}`}>
              {state.titles[state.mode]}
            </CardTitle>
            <CardDescription className={layout.textCenter}>
              {state.descriptions[state.mode]}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={state.handleSubmit} className={layout.flexColGap4}>
              {/* Success Message */}
              {state.successMessage && (
                <Alert className={`${getStatusBorder('success')} ${colors.bg.success}`}>
                  <AlertDescription className={colors.text.success}>
                    {state.successMessage}
                  </AlertDescription>
                </Alert>
              )}

              {/* Error Message */}
              {state.displayError && (
                <Alert variant="destructive">
                  <AlertDescription>{state.displayError}</AlertDescription>
                </Alert>
              )}

              {/* Email Field */}
              <fieldset className={layout.flexColGap2}>
                <label htmlFor="email" className={typography.label.sm}>
                  {state.t('form.labels.email')}
                </label>
                <div className={layout.inputContainer}>
                  <Mail className={`${layout.inputIconLeft} ${iconSizes.sm} ${colors.text.muted}`} />
                  <Input
                    id="email"
                    type="email"
                    placeholder={state.t('form.placeholders.email')}
                    value={state.formData.email}
                    onChange={state.handleInputChange('email')}
                    disabled={state.isLoading}
                    hasLeftIcon
                    required
                  />
                </div>
              </fieldset>

              {/* Name Fields (Sign Up Only) */}
              {state.mode === 'signup' && (
                <>
                  <fieldset className={layout.flexColGap2}>
                    <label htmlFor="givenName" className={typography.label.sm}>
                      {state.t('form.labels.givenName')}
                    </label>
                    <div className={layout.inputContainer}>
                      <User className={`${layout.inputIconLeft} ${iconSizes.sm} ${colors.text.muted}`} />
                      <Input
                        id="givenName"
                        type="text"
                        placeholder={state.t('form.placeholders.givenName')}
                        value={state.formData.givenName}
                        onChange={state.handleInputChange('givenName')}
                        disabled={state.isLoading}
                        hasLeftIcon
                        required
                        autoComplete="given-name"
                      />
                    </div>
                  </fieldset>

                  <fieldset className={layout.flexColGap2}>
                    <label htmlFor="familyName" className={typography.label.sm}>
                      {state.t('form.labels.familyName')}
                    </label>
                    <div className={layout.inputContainer}>
                      <User className={`${layout.inputIconLeft} ${iconSizes.sm} ${colors.text.muted}`} />
                      <Input
                        id="familyName"
                        type="text"
                        placeholder={state.t('form.placeholders.familyName')}
                        value={state.formData.familyName}
                        onChange={state.handleInputChange('familyName')}
                        disabled={state.isLoading}
                        hasLeftIcon
                        required
                        autoComplete="family-name"
                      />
                    </div>
                  </fieldset>
                </>
              )}

              {/* Password Field */}
              {state.mode !== 'reset' && (
                <fieldset className={layout.flexColGap2}>
                  <label htmlFor="password" className={typography.label.sm}>
                    {state.t('form.labels.password')}
                  </label>
                  <div className={layout.inputContainer}>
                    <Lock className={`${layout.inputIconLeft} ${iconSizes.sm} ${colors.text.muted}`} />
                    <Input
                      id="password"
                      type={state.showPassword ? 'text' : 'password'}
                      placeholder={state.t('form.placeholders.password')}
                      value={state.formData.password}
                      onChange={state.handleInputChange('password')}
                      disabled={state.isLoading}
                      hasLeftIcon
                      hasRightIcon
                      required
                    />
                    <button
                      type="button"
                      onClick={() => state.setShowPassword(!state.showPassword)}
                      className={`${layout.inputIconRight} ${colors.text.muted} ${INTERACTIVE_PATTERNS.TEXT_HOVER} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
                      tabIndex={-1}
                      aria-label={
                        state.showPassword
                          ? state.t('form.accessibility.hidePassword')
                          : state.t('form.accessibility.showPassword')
                      }
                    >
                      {state.showPassword ? (
                        <EyeOff className={iconSizes.sm} />
                      ) : (
                        <Eye className={iconSizes.sm} />
                      )}
                    </button>
                  </div>
                </fieldset>
              )}

              {/* Confirm Password (Sign Up Only) */}
              {state.mode === 'signup' && (
                <fieldset className={layout.flexColGap2}>
                  <label htmlFor="confirmPassword" className={typography.label.sm}>
                    {state.t('form.labels.confirmPassword')}
                  </label>
                  <div className={layout.inputContainer}>
                    <Lock className={`${layout.inputIconLeft} ${iconSizes.sm} ${colors.text.muted}`} />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder={state.t('form.placeholders.password')}
                      value={state.formData.confirmPassword}
                      onChange={state.handleInputChange('confirmPassword')}
                      disabled={state.isLoading}
                      hasLeftIcon
                      required
                    />
                  </div>
                </fieldset>
              )}

              {/* Submit Button */}
              <Button type="submit" className={layout.widthFull} disabled={state.isLoading}>
                {state.isLoading && <Spinner size="small" className={layout.buttonIconSpacing} />}
                {state.submitTexts[state.mode]}
              </Button>

              {/* Google Sign-In (Sign In & Sign Up only) */}
              {state.mode !== 'reset' && (
                <>
                  <div className="relative flex items-center py-2" role="separator">
                    <div className="flex-grow border-t border-border" />
                    <span className={`mx-4 flex-shrink ${typography.body.sm} ${colors.text.muted}`}>
                      {state.t('google.divider')}
                    </span>
                    <div className="flex-grow border-t border-border" />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className={layout.widthFull}
                    onClick={state.handleGoogleSignIn}
                    disabled={state.isLoading}
                    aria-label={state.t('google.buttonAriaLabel')}
                  >
                    {state.googleLoading ? (
                      <Spinner size="small" className={layout.buttonIconSpacing} />
                    ) : (
                      <GoogleIcon className={`${iconSizes.sm} ${layout.buttonIconSpacing}`} />
                    )}
                    {state.t('google.signInButton')}
                  </Button>
                </>
              )}

              {/* Mode Switch Links */}
              <nav
                className={`${layout.textCenter} ${layout.flexColGap2}`}
                aria-label={state.t('form.navigation.loginOptions')}
              >
                {state.mode === 'signin' && (
                  <>
                    <button
                      type="button"
                      onClick={() => state.setMode('reset')}
                      className={`${typography.body.sm} ${colors.text.info} ${INTERACTIVE_PATTERNS.BUTTON_LINK_HOVER}`}
                    >
                      {state.t('form.navigation.forgotPassword')}
                    </button>
                    <p>
                      <span className={`${typography.body.sm} ${colors.text.muted}`}>
                        {state.t('form.navigation.noAccount')}{' '}
                      </span>
                      <button
                        type="button"
                        onClick={() => state.setMode('signup')}
                        className={`${typography.body.sm} ${colors.text.info} ${INTERACTIVE_PATTERNS.BUTTON_LINK_HOVER}`}
                      >
                        {state.t('form.navigation.signup')}
                      </button>
                    </p>
                  </>
                )}

                {state.mode === 'signup' && (
                  <p>
                    <span className={`${typography.body.sm} ${colors.text.muted}`}>
                      {state.t('form.navigation.hasAccount')}{' '}
                    </span>
                    <button
                      type="button"
                      onClick={() => state.setMode('signin')}
                      className={`${typography.body.sm} ${colors.text.info} ${INTERACTIVE_PATTERNS.BUTTON_LINK_HOVER}`}
                    >
                      {state.t('form.navigation.signin')}
                    </button>
                  </p>
                )}

                {state.mode === 'reset' && (
                  <button
                    type="button"
                    onClick={() => state.setMode('signin')}
                    className={`${typography.body.sm} ${colors.text.info} ${INTERACTIVE_PATTERNS.BUTTON_LINK_HOVER}`}
                  >
                    {state.t('form.navigation.backToSignin')}
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
