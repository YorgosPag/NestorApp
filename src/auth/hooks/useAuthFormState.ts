/**
 * 📄 USE AUTH FORM STATE — Custom hook for auth form logic
 *
 * Encapsulates all state, handlers, and validation for AuthForm.
 * Extracted from AuthForm (Google SRP).
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from '@/lib/workspace/navigation';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
import type { AuthFormMode } from '../types/auth.types';
import type { WorkspaceHref } from '@/lib/workspace/route-worlds';
// 🔴 ADR-660 §5.4 / ADR-817 — Ο ΕΝΑΣ ΕΠΙΛΥΤΗΣ ΠΡΟΣΓΕΙΩΣΗΣ.
// ⚠️ ΜΗΝ γράψεις εδώ δικό σου `user.companyId ? … : …`: αυτή η απόφαση ζει σε ΕΝΑ
//    σημείο επίτηδες, και το `landing.ts` είναι η αυθεντία της.
import { resolvePostLoginRoute } from '@/lib/routes/landing';

const logger = createModuleLogger('AuthForm');

interface FormData {
  email: string;
  password: string;
  givenName: string;
  familyName: string;
  confirmPassword: string;
}

interface UseAuthFormStateOptions {
  defaultMode: AuthFormMode;
  onSuccess?: () => void;
  /**
   * **Ρητή παράκαμψη** της προσγείωσης — π.χ. «γύρνα εκεί που ήσουν».
   *
   * ⚠️ **ΧΩΡΙΣ ΠΡΟΕΠΙΛΟΓΗ, ΚΑΙ ΕΙΝΑΙ ΤΟ ΚΕΝΤΡΟ ΤΗΣ ΔΙΟΡΘΩΣΗΣ** (ADR-817 §9): μέχρι
   * τις 2026-08-26 έγραφε `redirectTo: AppHref` με προεπιλογή `AUTH_ROUTES.home`
   * (`/dashboard`) στο `AuthForm` — δηλαδή **κάθε** σύνδεση προσγειωνόταν στον
   * **εταιρικό** χώρο, και ο πολίτης κατέληγε σε σελίδα που ζητά εταιρικά δεδομένα.
   * Η απουσία σημαίνει πλέον *«ρώτα τον επιλυτή»*, όχι *«πήγαινε στο dashboard»*.
   *
   * 🔑 ADR-848 — `WorkspaceHref`: η επιστροφή του `?next=` είναι **συγκεκριμένη**
   * διεύθυνση (`/n/abc`), που το `AppHref` (σελίδες με αγκύλες) δεν χωρά.
   */
  redirectTo?: WorkspaceHref;
}

export function useAuthFormState({ defaultMode, onSuccess, redirectTo }: UseAuthFormStateOptions) {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const {
    user,
    signIn,
    signInWithGoogle,
    signUp,
    resetPassword,
    loading,
    error,
    sessionPhase,
    clearError,
    mfaRequired,
    verifyMfaCode,
    cancelMfaVerification,
  } = useAuth();

  // ── State ──

  const [mode, setMode] = useState<AuthFormMode>(defaultMode);
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    givenName: '',
    familyName: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  /**
   * **Πού προσγειώνεται ΑΥΤΟΣ ο άνθρωπος** — ρητή παράκαμψη, αλλιώς ο ΕΝΑΣ επιλυτής.
   *
   * 🔴 **ΓΙΑΤΙ ΥΠΟΛΟΓΙΖΕΤΑΙ ΣΕ ΚΑΘΕ ΑΠΟΔΟΣΗ ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΣΤΑΘΕΡΑ** (ADR-817 §9): τη
   * στιγμή της υποβολής το `user` είναι ακόμη `null` — η ταυτότητα φτάνει **μετά**,
   * από τον `AuthContext`. Ένας στόχος παγωμένος στο closure της υποβολής θα ήταν
   * **πάντα** ο στόχος του ανώνυμου. Επειδή το `landing` είναι παράγωγο του `user`,
   * το effect από κάτω πλοηγεί **μία φορά**, με τη σωστή διεύθυνση, όταν η ταυτότητα
   * προσγειωθεί (ADR-859: καμία «πρώτη ώθηση» από τους χειριστές, πια).
   *
   * ⚠️ Το `user ?? {}` **δεν** είναι αμυντικό θόρυβος: ο ανώνυμος έχει, εξ ορισμού,
   * ταυτότητα **χωρίς** οργανισμό — και ο επιλυτής απαντά ήδη σωστά γι' αυτόν.
   */
  const landing: WorkspaceHref = redirectTo ?? resolvePostLoginRoute(user ?? {});

  // ── Effects ──

  /**
   * 🔴 **ADR-859 — Η ΜΟΝΗ ΠΛΟΗΓΗΣΗ ΜΕΤΑ ΤΗ ΣΥΝΔΕΣΗ.**
   *
   * Μέχρι 2026-09-14 υπήρχαν **τέσσερις**: αυτή, και μία σε κάθε χειριστή (Google χωρίς
   * αναμονή · email και MFA με `setTimeout(…, 100)`). Οι τρεις των χειριστών έφευγαν
   * **πριν** το cookie — και, χειρότερα, **και** όταν η Google ζητούσε δεύτερο παράγοντα
   * ή ο κωδικός ήταν λάθος. Σε δημόσιο προορισμό (`/invite/<token>`) η φόρμα του κωδικού
   * δεν ξαναφαινόταν ποτέ. Ο `user` γίνεται μη-κενός **μόνο** μετά το `__session`
   * (ADR-819 §4.2), άρα αυτό το effect **δεν μπορεί** να προσπεράσει τη συνεδρία.
   *
   * ⛔ **ΚΑΜΙΑ ΠΡΟΦΟΡΤΩΣΗ ΤΟΥ `landing` ΟΣΟ ΕΙΝΑΙ ΑΝΩΝΥΜΟΣ.** Εδώ ζούσε
   * `router.prefetch(landing)`, και το Next κρατά ό,τι φέρνει το `router.prefetch` για
   * `staleTimes.static` (**5′**): η **ανώνυμη** απόδοση του προορισμού («Συνδεθείτε»)
   * μπορούσε να σερβιριστεί **μετά** τη σύνδεση — δεύτερος βρόχος, κρυμμένος πίσω από τον
   * πρώτο. Κάθε προορισμός εδώ εξαρτάται από την ταυτότητα, άρα δεν προφορτώνεται.
   */
  useEffect(() => {
    if (!loading && user) {
      router.replace(landing);
    }
  }, [loading, user, router, landing]);

  // ── Handlers ──

  const handleInputChange = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    clearError();
    setSuccessMessage(null);
    setValidationError(null);
  };

  const validateForm = (): string | null => {
    const { email, password, givenName, familyName, confirmPassword } = formData;

    if (!email.trim()) return t('validation.emailRequired');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return t('validation.emailInvalid');
    if (mode !== 'reset' && !password) return t('validation.passwordRequired');

    if (mode === 'signup') {
      if (password.length < 6) return t('validation.passwordMinLength');
      if (password !== confirmPassword) return t('validation.passwordMismatch');
      if (!givenName.trim()) return t('validation.givenNameRequired');
      if (!familyName.trim()) return t('validation.familyNameRequired');
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErr = validateForm();
    if (validationErr) {
      setValidationError(validationErr);
      return;
    }

    setLocalLoading(true);
    setSuccessMessage(null);
    setValidationError(null);

    try {
      const { email, password, givenName, familyName } = formData;

      if (mode === 'signin') {
        logger.info('[AuthForm] Sign in attempt');
        const outcome = await signIn(email, password);
        // ADR-859 — ΚΑΜΙΑ πλοήγηση εδώ: την κάνει το effect, όταν στηθεί η συνεδρία.
        if (outcome.kind === 'signed-in') {
          setSuccessMessage(t('messages.signinSuccess'));
          onSuccess?.();
        }
        return;
      } else if (mode === 'signup') {
        logger.info('[AuthForm] Sign up attempt');
        await signUp({ email, password, givenName, familyName });
        setSuccessMessage(t('messages.signupSuccess'));
        onSuccess?.();
      } else if (mode === 'reset') {
        logger.info('[AuthForm] Password reset attempt');
        await resetPassword(email);
        setSuccessMessage(t('messages.resetEmailSent'));
        setMode('signin');
      }

      setFormData({
        email: mode === 'reset' ? formData.email : '',
        password: '',
        givenName: '',
        familyName: '',
        confirmPassword: '',
      });
    } catch (err) {
      logger.error('[AuthForm] Error', { error: err });
    } finally {
      setLocalLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      setSuccessMessage(null);
      setValidationError(null);
      clearError();

      logger.info('[AuthForm] Google Sign-In attempt');
      const outcome = await signInWithGoogle();

      // ADR-859 — `second-factor-required` ⇒ μένουμε ΕΔΩ: η φόρμα του κωδικού αποδίδεται.
      if (outcome.kind === 'signed-in') {
        setSuccessMessage(t('google.success'));
        onSuccess?.();
      }
    } catch (err) {
      logger.error('[AuthForm] Google Sign-In error', { error: err });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleMfaVerification = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!mfaCode.trim() || mfaCode.length !== 6) {
      setValidationError(t('mfa.invalidCodeLength'));
      return;
    }

    setLocalLoading(true);
    setValidationError(null);

    try {
      const outcome = await verifyMfaCode(mfaCode);
      // ADR-859 — ο λάθος κωδικός ΔΕΝ πλοηγεί πια (μετρημένο ζωντανά: έφευγε).
      if (outcome.kind === 'signed-in') setSuccessMessage(t('mfa.verificationSuccess'));
    } catch (err) {
      logger.error('[AuthForm] MFA verification error', { error: err });
    } finally {
      setLocalLoading(false);
    }
  };

  const handleCancelMfa = () => {
    cancelMfaVerification();
    setMfaCode('');
    setValidationError(null);
  };

  const handleMfaCodeChange = (value: string) => {
    setMfaCode(value);
    setValidationError(null);
    clearError();
  };

  // ── Computed ──

  const isLoading = loading || localLoading || googleLoading;
  const displayError = validationError || error;
  /**
   * ADR-859 — **παράγεται**, δεν ορίζεται από χειριστή. Η οθόνη φόρτωσης δείχνεται όσο
   * στήνεται ή έχει στηθεί η συνεδρία· **ποτέ** όσο εκκρεμεί δεύτερος παράγοντας.
   */
  const isRedirecting = sessionPhase !== 'anonymous' && !mfaRequired;

  const titles: Record<AuthFormMode, string> = {
    signin: t('form.titles.signin'),
    signup: t('form.titles.signup'),
    reset: t('form.titles.reset'),
  };

  const descriptions: Record<AuthFormMode, string> = {
    signin: t('form.descriptions.signin'),
    signup: t('form.descriptions.signup'),
    reset: t('form.descriptions.reset'),
  };

  const submitTexts: Record<AuthFormMode, string> = {
    signin: t('form.submitButtons.signin'),
    signup: t('form.submitButtons.signup'),
    reset: t('form.submitButtons.reset'),
  };

  return {
    // 🔴 ADR-744 §18 — ΤΟ `t` ΔΕΝ ΕΠΙΣΤΡΕΦΕΤΑΙ ΠΙΑ. Ο μοναδικός καταναλωτής
    // (`AuthForm.tsx`) δηλώνει πλέον το δικό του `useTranslation('auth')`. Ένας hook
    // που δανείζει μεταφραστή κάνει τον καταναλωτή του **αόρατο** στον generator του
    // shell slice: το αρχείο που δανείζεται δηλώνει μηδέν namespace, άρα τα κλειδιά του
    // δεν αποδίδονται πουθενά και πέφτουν ΣΙΩΠΗΛΑ. Το `t` μένει για εσωτερική χρήση.
    // State
    mode,
    setMode,
    formData,
    showPassword,
    setShowPassword,
    isLoading,
    googleLoading,
    displayError,
    successMessage,
    mfaRequired,
    mfaCode,
    isRedirecting,
    // Handlers
    handleInputChange,
    handleSubmit,
    handleGoogleSignIn,
    handleMfaVerification,
    handleCancelMfa,
    handleMfaCodeChange,
    // Content
    titles,
    descriptions,
    submitTexts,
  };
}
