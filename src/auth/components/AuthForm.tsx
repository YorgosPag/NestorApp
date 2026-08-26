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
import { CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects/hover-effects';
import { TRANSITION_PRESETS } from '@/components/ui/effects/transitions';
import type { AuthFormProps } from '../types/auth.types';
import { GoogleIcon } from './GoogleIcon';
import { MfaVerificationForm } from './MfaVerificationForm';
import { useAuthFormState } from '../hooks/useAuthFormState';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { AuthBrandMark, AuthScreen } from './AuthScreenChrome';
import { AuthField } from './AuthField';
import '@/lib/design-system';

// =============================================================================
// AUTH FORM COMPONENT
// =============================================================================

export function AuthForm({
  defaultMode = 'signin',
  onSuccess,
  // 🔴 **ΚΑΜΙΑ ΠΡΟΕΠΙΛΟΓΗ** (ADR-817 §9): έγραφε `= AUTH_ROUTES.home` (`/dashboard`),
  //    άρα **κάθε** σύνδεση προσγειωνόταν στον ΕΤΑΙΡΙΚΟ χώρο — και ο πολίτης κατέληγε
  //    σε σελίδα που ζητά εταιρικά δεδομένα, με `AUTHORIZATION_ERROR` στην κονσόλα.
  //    Απόν ⇒ το `useAuthFormState` ρωτά τον ΕΝΑΝ επιλυτή (`landing.ts`).
  redirectTo,
}: AuthFormProps) {
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const typography = useTypography();
  const layout = useLayoutClasses();

  const state = useAuthFormState({ defaultMode, onSuccess, redirectTo });
  // 🔴 ADR-744 §18 — ΤΟ NAMESPACE ΔΗΛΩΝΕΤΑΙ ΕΔΩ, ΚΑΙ ΕΙΝΑΙ ΟΡΘΟΤΗΤΑ, ΟΧΙ ΣΤΥΛ.
  // Μέχρι 2026-08-22 αυτό το component δανειζόταν το `t` από το `useAuthFormState`
  // (`t(...)`), οπότε δήλωνε ΜΗΔΕΝ namespace. Ο generator του shell slice
  // αποδίδει τα κλειδιά ενός αρχείου στα namespaces ΠΟΥ ΤΟ ΙΔΙΟ δηλώνει — άρα
  // `targets = []` και **26 λυμένα κλειδιά έπεφταν σιωπηλά**. Αποτέλεσμα: 13 από
  // τα 16 ωμά κλειδιά που μέτρησε ζωντανά ο χρησμός (CHECK 3.51 Χ) στο /login.
  // Το prop-drilling του `t` είναι και το αντι-ιδίωμα του react-i18next.
  const { t } = useTranslation('auth');

  // ==========================================================================
  // RENDER: Redirect Loading Overlay
  // ==========================================================================

  if (state.isRedirecting) {
    // 🔴 ΗΤΑΝ `<main role="main">` ΜΕΣΑ ΣΤΟ `<main>` ΤΟΥ `(auth)/layout.tsx` — δύο
    //    landmarks `main` στην ίδια σελίδα, ενώ το WCAG επιτρέπει **ένα**. Το
    //    διπλανό `AuthActionContent` έφερε **ήδη** τη διόρθωση γραμμένη στο σχόλιό
    //    του («Using <section> instead of <main> … avoids nested <main> tags»), και
    //    το `(light)/layout.tsx` την πλήρωσε ξεχωριστά· αυτή η διαδρομή απλώς δεν
    //    ρωτήθηκε ποτέ. Βρέθηκε 2026-08-25 (ADR-797 ΦΑΣΗ Β).
    //
    // ⚠️ Ούτε `shellAuthStandalone`: το «γέμισε το παράθυρο και κεντράρισε» το
    //    κατέχει το layout — εδώ ήταν η **τρίτη** εμφωλευμένη δήλωσή του.
    // ⚠️ ΚΑΝΕΝΑ εξωτερικό wrapper: η `<section role="status">` παρακάτω **είναι ήδη**
    //    η ζωντανή περιοχή. Ένα δεύτερο `role="status"` γύρω της θα ανακοίνωνε το
    //    ίδιο μήνυμα **δύο φορές** στον αναγνώστη οθόνης.
    return (
      <section
        className={`${layout.flexColGap4} ${layout.textCenter}`}
        role="status"
        aria-label={t('navigation.redirecting')}
        aria-live="polite"
        aria-busy="true"
      >
        <AuthBrandMark as="fragment" />
        <figure className={layout.centerHorizontal}>
          <Spinner size="large" aria-label={t('loading.spinnerLabel')} />
        </figure>
        <p className={`${typography.body.base} ${colors.text.muted}`}>
          {t('navigation.loadingApp')}
        </p>
      </section>
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
      />
    );
  }

  // ==========================================================================
  // RENDER: Main Auth Form (Sign In / Sign Up / Reset)
  // ==========================================================================

  return (
    <AuthScreen
      title={state.titles[state.mode]}
      description={state.descriptions[state.mode]}
    >

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
              <AuthField id="email" label={t('form.labels.email')} icon={Mail}>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('form.placeholders.email')}
                  value={state.formData.email}
                  onChange={state.handleInputChange('email')}
                  disabled={state.isLoading}
                  hasLeftIcon
                  required
                />
              </AuthField>

              {/* Name Fields (Sign Up Only) */}
              {state.mode === 'signup' && (
                <>
                  <AuthField id="givenName" label={t('form.labels.givenName')} icon={User}>
                    <Input
                      id="givenName"
                      type="text"
                      placeholder={t('form.placeholders.givenName')}
                      value={state.formData.givenName}
                      onChange={state.handleInputChange('givenName')}
                      disabled={state.isLoading}
                      hasLeftIcon
                      required
                      autoComplete="given-name"
                    />
                  </AuthField>

                  <AuthField id="familyName" label={t('form.labels.familyName')} icon={User}>
                    <Input
                      id="familyName"
                      type="text"
                      placeholder={t('form.placeholders.familyName')}
                      value={state.formData.familyName}
                      onChange={state.handleInputChange('familyName')}
                      disabled={state.isLoading}
                      hasLeftIcon
                      required
                      autoComplete="family-name"
                    />
                  </AuthField>
                </>
              )}

              {/* Password Field */}
              {state.mode !== 'reset' && (
                <AuthField id="password" label={t('form.labels.password')} icon={Lock}>
                  <Input
                    id="password"
                    type={state.showPassword ? 'text' : 'password'}
                    placeholder={t('form.placeholders.password')}
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
                        ? t('form.accessibility.hidePassword')
                        : t('form.accessibility.showPassword')
                    }
                  >
                    {state.showPassword ? (
                      <EyeOff className={iconSizes.sm} />
                    ) : (
                      <Eye className={iconSizes.sm} />
                    )}
                  </button>
                </AuthField>
              )}

              {/* Confirm Password (Sign Up Only) */}
              {state.mode === 'signup' && (
                <AuthField id="confirmPassword" label={t('form.labels.confirmPassword')} icon={Lock}>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder={t('form.placeholders.password')}
                    value={state.formData.confirmPassword}
                    onChange={state.handleInputChange('confirmPassword')}
                    disabled={state.isLoading}
                    hasLeftIcon
                    required
                  />
                </AuthField>
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
                      {t('google.divider')}
                    </span>
                    <div className="flex-grow border-t border-border" />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className={layout.widthFull}
                    onClick={state.handleGoogleSignIn}
                    disabled={state.isLoading}
                    aria-label={t('google.buttonAriaLabel')}
                  >
                    {state.googleLoading ? (
                      <Spinner size="small" className={layout.buttonIconSpacing} />
                    ) : (
                      <GoogleIcon className={`${iconSizes.sm} ${layout.buttonIconSpacing}`} />
                    )}
                    {t('google.signInButton')}
                  </Button>
                </>
              )}

              {/* Mode Switch Links */}
              <nav
                className={`${layout.textCenter} ${layout.flexColGap2}`}
                aria-label={t('form.navigation.loginOptions')}
              >
                {state.mode === 'signin' && (
                  <>
                    <button
                      type="button"
                      onClick={() => state.setMode('reset')}
                      className={`${typography.body.sm} ${colors.text.info} ${INTERACTIVE_PATTERNS.BUTTON_LINK_HOVER}`}
                    >
                      {t('form.navigation.forgotPassword')}
                    </button>
                    <p>
                      <span className={`${typography.body.sm} ${colors.text.muted}`}>
                        {t('form.navigation.noAccount')}{' '}
                      </span>
                      <button
                        type="button"
                        onClick={() => state.setMode('signup')}
                        className={`${typography.body.sm} ${colors.text.info} ${INTERACTIVE_PATTERNS.BUTTON_LINK_HOVER}`}
                      >
                        {t('form.navigation.signup')}
                      </button>
                    </p>
                  </>
                )}

                {state.mode === 'signup' && (
                  <p>
                    <span className={`${typography.body.sm} ${colors.text.muted}`}>
                      {t('form.navigation.hasAccount')}{' '}
                    </span>
                    <button
                      type="button"
                      onClick={() => state.setMode('signin')}
                      className={`${typography.body.sm} ${colors.text.info} ${INTERACTIVE_PATTERNS.BUTTON_LINK_HOVER}`}
                    >
                      {t('form.navigation.signin')}
                    </button>
                  </p>
                )}

                {state.mode === 'reset' && (
                  <button
                    type="button"
                    onClick={() => state.setMode('signin')}
                    className={`${typography.body.sm} ${colors.text.info} ${INTERACTIVE_PATTERNS.BUTTON_LINK_HOVER}`}
                  >
                    {t('form.navigation.backToSignin')}
                  </button>
                )}
              </nav>
            </form>
          </CardContent>
    </AuthScreen>
  );
}

// =============================================================================
// LEGACY EXPORTS FOR BACKWARD COMPATIBILITY
// =============================================================================

export { AuthForm as FirebaseLoginForm };
export default AuthForm;
