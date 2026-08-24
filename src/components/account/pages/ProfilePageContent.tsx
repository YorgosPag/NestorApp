'use client';

/**
 * =============================================================================
 * ACCOUNT PROFILE PAGE CONTENT - PERSONAL INFORMATION
 * =============================================================================
 *
 * Enterprise Pattern: User identity management
 * Features: Avatar, display name, given/family name, email (read-only)
 *
 * @module components/account/pages/ProfilePageContent
 * @enterprise ADR-024 - Account Hub Centralization
 * @performance ADR-294 Batch 4 — lazy-loaded via LazyRoutes
 */

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import React, { useEffect, useState } from 'react';
import { Camera, Mail, User as UserIcon, Building2, Briefcase } from 'lucide-react';
import { EscoOccupationPicker } from '@/components/shared/EscoOccupationPicker';
import type { DeclaredOccupation } from '@/types/professional-identity';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/design-system';
import { useAuth } from '@/auth';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function ProfilePageContent() {
  const { user, updateUserProfile, declaredOccupation, updateDeclaredOccupation } = useAuth();
  const { t } = useTranslation(COMMON_NAMESPACES);
  const colors = useSemanticColors();
  const borders = useBorderTokens();
  const layout = useLayoutClasses();
  const iconSizes = useIconSizes();
  const typography = useTypography();

  // Form state
  const [givenName, setGivenName] = useState(user?.givenName || '');
  const [familyName, setFamilyName] = useState(user?.familyName || '');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ADR-798 Φάση 3 (Κ4) — το δηλωμένο επάγγελμα ως κατάσταση φόρμας.
  const [occupation, setOccupation] = useState<DeclaredOccupation>({});

  // 🔴 ΤΟ ΠΡΟΦΙΛ ΦΤΑΝΕΙ **ΑΡΓΟΤΕΡΑ** ΑΠΟ ΤΗΝ ΠΡΩΤΗ ΑΠΟΔΟΣΗ.
  //
  // Το `declaredOccupation` γεμίζει από το `syncUserProfileToFirestore` μετά το
  // `onAuthStateChanged`. Ένα σκέτο `useState(declaredOccupation ?? {})` θα
  // **πάγωνε** στην αρχική `null` και το πεδίο θα φαινόταν **κενό σε άνθρωπο που
  // έχει ήδη δηλώσει** — που θα τον έβαζε να ξαναγράψει, ή χειρότερα: να πατήσει
  // «Αποθήκευση» και να **σβήσει** ό,τι είχε δηλώσει. Είναι το ίδιο σφάλμα
  // εξαρτήσεων της Φάσης 2, σε νέα θέση, και **καμία πύλη δεν το πιάνει**.
  //
  // ⚠️ Μετά την αποθήκευση το context τίθεται από ό,τι **γράφτηκε πραγματικά**,
  // οπότε αυτό το effect ξανατρέχει και δείχνει τις **κανονικοποιημένες** τιμές
  // — π.χ. τη μισή ταξινόμηση που ο γραφέας έσβησε. Η οθόνη δεν λέει ποτέ ότι
  // αποθηκεύτηκε κάτι που δεν αποθηκεύτηκε.
  useEffect(() => {
    if (declaredOccupation !== null) setOccupation(declaredOccupation);
  }, [declaredOccupation]);

  const handleSave = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      // Δύο **αποθετήρια**, ένα κουμπί: τα ονόματα ζουν σε Firebase Auth, το
      // επάγγελμα στο Firestore. Και τα δύο `await` (N.7.2 #6 — ορθότητα, όχι
      // fire-and-forget) και **ιδεμπόταντα**: δεύτερο πάτημα = ίδιο αποτέλεσμα.
      await updateUserProfile(givenName, familyName);
      await updateDeclaredOccupation(occupation);
      setMessage({ type: 'success', text: t('account.profile.saveSuccess') });
    } catch {
      setMessage({ type: 'error', text: t('account.profile.saveError') });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className={borders.getElementBorder('card', 'default')}>
      <CardHeader>
        <CardTitle className={layout.flexCenterGap2}>
          <UserIcon className={iconSizes.md} aria-hidden="true" />
          {t('account.profile.title')}
        </CardTitle>
        <CardDescription>
          {t('account.profile.description')}
        </CardDescription>
      </CardHeader>

      <CardContent className={layout.flexColGap4}>
        {/* Avatar Section */}
        <section className={layout.flexCenterGap4}>
          <figure className="relative">
            <Avatar className="h-20 w-20">
              {user?.photoURL ? (
                <AvatarImage
                  src={user.photoURL}
                  alt={user.displayName || t('account.defaultUser')}
                  referrerPolicy="no-referrer"
                />
              ) : null}
              <AvatarFallback className={cn(colors.bg.muted, 'text-2xl')}>
                <UserIcon className={iconSizes.lg} />
              </AvatarFallback>
            </Avatar>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                'absolute -bottom-1 -right-1',
                'h-8 w-8 rounded-full',
                colors.bg.primary
              )}
              aria-label={t('account.profile.changePhoto')}
              disabled
            >
              <Camera className={iconSizes.xs} />
            </Button>
          </figure>
          <div>
            <p className={cn(typography.label.sm, colors.text.primary)}>
              {user?.displayName || t('account.defaultUser')}
            </p>
            <p className={cn(typography.body.sm, colors.text.muted)}>
              {t('account.profile.photoHint')}
            </p>
          </div>
        </section>

        {/* Form Fields */}
        <form className={layout.flexColGap4} onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <fieldset className={layout.flexColGap2}>
            <Label htmlFor="givenName">{t('account.profile.givenName')}</Label>
            <Input
              id="givenName"
              value={givenName}
              onChange={(e) => setGivenName(e.target.value)}
              placeholder={t('account.profile.givenNamePlaceholder')}
            />
          </fieldset>

          <fieldset className={layout.flexColGap2}>
            <Label htmlFor="familyName">{t('account.profile.familyName')}</Label>
            <Input
              id="familyName"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder={t('account.profile.familyNamePlaceholder')}
            />
          </fieldset>

          {/*
            ADR-798 Φάση 3 (Κ4) — Η ΔΗΛΩΣΗ ΤΟΥ ΕΠΑΓΓΕΛΜΑΤΟΣ.

            ⚠️ **Α5: εδώ και πουθενά αλλού.** Καμία modal, καμία οθόνη επιλογής,
            καμία ερώτηση πριν ή μετά το login: ο άνθρωπος το δηλώνει **όποτε
            θέλει ο ίδιος**. Το Revit ρωτά με modal στο πρώτο άνοιγμα και το
            πληρώνει με επίσημο άρθρο «How to disable» (ADR-748 §6.14).

            ⛔ **ΚΑΝΕΝΑ νέο picker**: το `EscoOccupationPicker` είναι ζωντανό,
            με ζωντανή αναζήτηση ESCO σε EL/EN και ελεύθερο κείμενο ως **νόμιμη**
            εναλλακτική (ADR-132 §1) — δεύτερο θα ήταν δεύτερο λεξιλόγιο.

            🔑 **Ο picker ζει ΜΕΣΑ στο `<Label>` επίτηδες**: δεν δέχεται `id`,
            οπότε ένα `htmlFor` θα έδειχνε **στο πουθενά** — ακριβώς ό,τι κάνει
            σήμερα το `SurveyLinkedContactField.tsx:137`. Η **έμμεση** συσχέτιση
            είναι έγκυρη HTML και δουλεύει εδώ επειδή το πρώτο labelable στοιχείο
            του δέντρου είναι το ίδιο το input (ο `PopoverAnchor` είναι `asChild`
            πάνω σε σκέτο `<div>`, και το κουμπί καθαρισμού έρχεται **μετά**).
            Επαληθεύτηκε ότι το Radix Label δεν σπάει το διπλό κλικ: ο guard του
            κάνει `closest("button, input, select, textarea")`.
          */}
          <fieldset className={layout.flexColGap2}>
            <Label className={layout.flexColGap2}>
              <span className={layout.flexCenterGap2}>
                <Briefcase className={iconSizes.xs} aria-hidden="true" />
                {t('account.profile.occupation')}
              </span>
              <EscoOccupationPicker
                value={occupation.profession ?? ''}
                escoUri={occupation.escoUri}
                iscoCode={occupation.iscoCode}
                onChange={setOccupation}
                placeholder={t('account.profile.occupationPlaceholder')}
                disabled={isLoading}
              />
            </Label>
            <p className={cn(typography.body.xs, colors.text.muted)}>
              {t('account.profile.occupationHint')}
            </p>
          </fieldset>

          <fieldset className={layout.flexColGap2}>
            <Label htmlFor="email" className={layout.flexCenterGap2}>
              <Mail className={iconSizes.xs} aria-hidden="true" />
              {t('account.profile.email')}
            </Label>
            <Input
              id="email"
              value={user?.email || ''}
              disabled
              readOnly
              className={colors.bg.muted}
            />
            <p className={cn(typography.body.xs, colors.text.muted)}>
              {t('account.profile.emailHint')}
            </p>
          </fieldset>

          <fieldset className={layout.flexColGap2}>
            <Label htmlFor="role" className={layout.flexCenterGap2}>
              <Building2 className={iconSizes.xs} aria-hidden="true" />
              {t('account.profile.role')}
            </Label>
            <Input
              id="role"
              value={t('account.profile.roleUser')}
              disabled
              readOnly
              className={colors.bg.muted}
            />
          </fieldset>

          {message && (
            <output
              role="status"
              className={cn(
                layout.padding3,
                borders.radiusClass.md,
                typography.body.sm,
                message.type === 'success'
                  ? cn(colors.bg.success, colors.text.success)
                  : cn(colors.bg.error, colors.text.error)
              )}
            >
              {message.text}
            </output>
          )}

          <footer className={layout.flexCenterBetween}>
            <Button
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? t('account.profile.saving') : t('account.profile.save')}
            </Button>
          </footer>
        </form>
      </CardContent>
    </Card>
  );
}

export default ProfilePageContent;
