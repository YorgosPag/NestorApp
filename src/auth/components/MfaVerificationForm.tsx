/**
 * 📄 MFA VERIFICATION FORM — Two-factor authentication code entry
 *
 * Enterprise 2FA verification screen rendered when MFA is required.
 * Extracted from AuthForm (Google SRP).
 */

'use client';

import '@/lib/design-system';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import LogoPagonis from '@/components/property-viewer/Logo_Pagonis';
import { LanguageSwitcher } from '@/components/header/language-switcher';
import { ThemeToggle } from '@/components/header/theme-toggle';
import { Lock } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';

interface MfaVerificationFormProps {
  mfaCode: string;
  onMfaCodeChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isLoading: boolean;
  displayError: string | null;
  successMessage: string | null;
  t: (key: string) => string;
}

export function MfaVerificationForm({
  mfaCode,
  onMfaCodeChange,
  onSubmit,
  onCancel,
  isLoading,
  displayError,
  successMessage,
  t,
}: MfaVerificationFormProps) {
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const typography = useTypography();
  const layout = useLayoutClasses();

  return (
    <>
      <nav className={layout.authToolbar} aria-label={t('navigation.settingsToolbar')}>
        <LanguageSwitcher />
        <ThemeToggle />
      </nav>

      <section className={layout.flexColGap4}>
        <header className={`${layout.flexColGap2} ${layout.textCenter}`}>
          <figure className={layout.centerHorizontal}>
            <LogoPagonis className={`${iconSizes.xl4} ${colors.text.primary}`} />
          </figure>
          {/* eslint-disable-next-line custom/no-hardcoded-strings */}
          <h1 className={`${typography.heading.lg} ${colors.text.primary}`}>Nestor App</h1>
        </header>

        <Card className={layout.cardAuthWidth}>
          <CardHeader className={layout.flexColGap2}>
            <CardTitle className={`${typography.heading.lg} ${layout.textCenter}`}>
              {t('mfa.title')}
            </CardTitle>
            <CardDescription className={layout.textCenter}>{t('mfa.description')}</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={onSubmit} className={layout.flexColGap4}>
              {displayError && (
                <Alert variant="destructive">
                  <AlertDescription>{displayError}</AlertDescription>
                </Alert>
              )}

              {successMessage && (
                <Alert className={`${getStatusBorder('success')} ${colors.bg.success}`}>
                  <AlertDescription className={colors.text.success}>
                    {successMessage}
                  </AlertDescription>
                </Alert>
              )}

              <fieldset className={layout.flexColGap2}>
                <label htmlFor="mfaCode" className={typography.label.sm}>
                  {t('mfa.codeLabel')}
                </label>
                <div className={layout.inputContainer}>
                  <Lock
                    className={`${layout.inputIconLeft} ${iconSizes.sm} ${colors.text.muted}`}
                  />
                  <Input
                    id="mfaCode"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder={t('mfa.codePlaceholder')}
                    value={mfaCode}
                    onChange={(e) => onMfaCodeChange(e.target.value.replace(/\D/g, ''))}
                    disabled={isLoading}
                    hasLeftIcon
                    required
                    autoComplete="one-time-code"
                    autoFocus
                  />
                </div>
                <p className={`${typography.body.sm} ${colors.text.muted}`}>{t('mfa.codeHint')}</p>
              </fieldset>

              <Button type="submit" className={layout.widthFull} disabled={isLoading}>
                {isLoading && <Spinner size="small" className={layout.buttonIconSpacing} />}
                {t('mfa.verifyButton')}
              </Button>

              <Button
                type="button"
                variant="outline"
                className={layout.widthFull}
                onClick={onCancel}
                disabled={isLoading}
              >
                {t('mfa.cancelButton')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
