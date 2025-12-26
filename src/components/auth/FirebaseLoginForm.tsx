'use client';

// =============================================================================
// 🔑 FIREBASE LOGIN FORM
// =============================================================================
//
// ✅ Production-grade login form με Firebase Auth
// ❌ Replaces fake hardcoded authentication
// 🛡️ Integrates with Firestore Security Rules
//
// =============================================================================

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useFirebaseAuth } from '@/contexts/FirebaseAuthContext';
import { Loader2, Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';

// =============================================================================
// INTERFACES
// =============================================================================

interface FirebaseLoginFormProps {
  onSuccess?: () => void;
  className?: string;
  title?: string;
  description?: string;
  showSignUpOption?: boolean;
}

type FormMode = 'signin' | 'signup' | 'reset';

// =============================================================================
// FIREBASE LOGIN FORM COMPONENT
// =============================================================================

export function FirebaseLoginForm({
  onSuccess,
  className = '',
  title = 'Σύνδεση στο Σύστημα',
  description = 'Εισάγετε τα στοιχεία σας για πρόσβαση στην εφαρμογή',
  showSignUpOption = true
}: FirebaseLoginFormProps) {
  const iconSizes = useIconSizes();
  const { signIn, signUp, resetPassword, loading, error, clearError } = useFirebaseAuth();

  // Form state
  const [mode, setMode] = useState<FormMode>('signin');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ==========================================================================
  // FORM HANDLERS
  // ==========================================================================

  const handleInputChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
    clearError();
    setSuccessMessage(null);
  };

  const validateForm = (): string | null => {
    const { email, password, displayName, confirmPassword } = formData;

    if (!email.trim()) {
      return 'Το email είναι υποχρεωτικό.';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'Μη έγκυρο format email.';
    }

    if (mode !== 'reset' && !password) {
      return 'Ο κωδικός πρόσβασης είναι υποχρεωτικός.';
    }

    if (mode === 'signup') {
      if (password.length < 6) {
        return 'Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.';
      }

      if (password !== confirmPassword) {
        return 'Οι κωδικοί δεν ταιριάζουν.';
      }

      if (!displayName.trim()) {
        return 'Το όνομα είναι υποχρεωτικό.';
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setSuccessMessage(null);
      // Show validation error through error state
      console.error('Validation error:', validationError);
      return;
    }

    setLocalLoading(true);
    setSuccessMessage(null);

    try {
      const { email, password, displayName } = formData;

      if (mode === 'signin') {
        console.log('🔑 Attempting sign in...');
        await signIn(email, password);
        console.log('✅ Sign in successful');
        setSuccessMessage('Επιτυχής σύνδεση!');
        onSuccess?.();
      } else if (mode === 'signup') {
        console.log('🔑 Attempting sign up...');
        await signUp(email, password, displayName);
        console.log('✅ Sign up successful');
        setSuccessMessage('Επιτυχής εγγραφή! Ελέγξτε το email σας για επιβεβαίωση.');
        onSuccess?.();
      } else if (mode === 'reset') {
        console.log('🔑 Attempting password reset...');
        await resetPassword(email);
        console.log('✅ Password reset email sent');
        setSuccessMessage('Στάλθηκε email επαναφοράς κωδικού!');
        setMode('signin');
      }

      // Clear form on success
      setFormData({
        email: mode === 'reset' ? formData.email : '',
        password: '',
        displayName: '',
        confirmPassword: ''
      });
    } catch (error) {
      console.error('🔥 Authentication error:', error);
      // Error is handled by the context
    } finally {
      setLocalLoading(false);
    }
  };

  const isLoading = loading || localLoading;

  // ==========================================================================
  // FORM CONTENT BASED ON MODE
  // ==========================================================================

  const getTitle = () => {
    switch (mode) {
      case 'signin':
        return title;
      case 'signup':
        return 'Δημιουργία Λογαριασμού';
      case 'reset':
        return 'Επαναφορά Κωδικού';
    }
  };

  const getDescription = () => {
    switch (mode) {
      case 'signin':
        return description;
      case 'signup':
        return 'Δημιουργήστε νέο λογαριασμό για πρόσβαση στο σύστημα';
      case 'reset':
        return 'Εισάγετε το email σας για επαναφορά κωδικού';
    }
  };

  const getSubmitText = () => {
    switch (mode) {
      case 'signin':
        return 'Σύνδεση';
      case 'signup':
        return 'Δημιουργία Λογαριασμού';
      case 'reset':
        return 'Αποστολή Email';
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <Card className={`w-full max-w-md mx-auto ${className}`}>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">{getTitle()}</CardTitle>
        <CardDescription className="text-center">
          {getDescription()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Success Message */}
          {successMessage && (
            <Alert className={`${useBorderTokens().getStatusBorder('success')} bg-green-50 text-green-700`}>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Email Field */}
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <div className="relative">
              <Mail className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${iconSizes.sm} text-gray-400`} />
              <Input
                id="email"
                type="email"
                placeholder="your-email@example.com"
                value={formData.email}
                onChange={handleInputChange('email')}
                disabled={isLoading}
                className="pl-10"
                required
              />
            </div>
          </div>

          {/* Display Name Field (Sign Up Only) */}
          {mode === 'signup' && (
            <div className="space-y-2">
              <label htmlFor="displayName" className="text-sm font-medium">Όνομα</label>
              <Input
                id="displayName"
                type="text"
                placeholder="Το όνομά σας"
                value={formData.displayName}
                onChange={handleInputChange('displayName')}
                disabled={isLoading}
                required
              />
            </div>
          )}

          {/* Password Field */}
          {mode !== 'reset' && (
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">Κωδικός Πρόσβασης</label>
              <div className="relative">
                <Lock className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${iconSizes.sm} text-gray-400`} />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleInputChange('password')}
                  disabled={isLoading}
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className={iconSizes.sm} />
                  ) : (
                    <Eye className={iconSizes.sm} />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Confirm Password Field (Sign Up Only) */}
          {mode === 'signup' && (
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">Επιβεβαίωση Κωδικού</label>
              <div className="relative">
                <Lock className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${iconSizes.sm} text-gray-400`} />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleInputChange('confirmPassword')}
                  disabled={isLoading}
                  className="pl-10"
                  required
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading && <Loader2 className={`mr-2 ${iconSizes.sm} animate-spin`} />}
            {getSubmitText()}
          </Button>

          {/* Mode Switch Links */}
          <div className="text-center space-y-2">
            {mode === 'signin' && (
              <>
                <button
                  type="button"
                  onClick={() => setMode('reset')}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Ξεχάσατε τον κωδικό σας;
                </button>
                {showSignUpOption && (
                  <div>
                    <span className="text-sm text-gray-600">Δεν έχετε λογαριασμό; </span>
                    <button
                      type="button"
                      onClick={() => setMode('signup')}
                      className="text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      Εγγραφή
                    </button>
                  </div>
                )}
              </>
            )}

            {mode === 'signup' && (
              <div>
                <span className="text-sm text-gray-600">Έχετε ήδη λογαριασμό; </span>
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Σύνδεση
                </button>
              </div>
            )}

            {mode === 'reset' && (
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Επιστροφή στη σύνδεση
              </button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default FirebaseLoginForm;