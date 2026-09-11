'use client';

/**
 * @fileoverview **ΤΟ ΠΕΔΙΟ EMAIL ΤΟΥ ΠΡΟΦΙΛ** — η διεύθυνση, και ο δρόμος να αλλάξει (ADR-850).
 * @related components/account/pages/ProfilePageContent.tsx (ο ξενιστής) · AccountEmailChangeDialog.tsx
 * @module components/account/email-change/AccountEmailField
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΕΔΩ ΕΛΕΓΕ «ΤΟ EMAIL ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΑΛΛΑΞΕΙ» — ΚΑΙ ΜΕΤΑ ΤΟ ADR-844 §12 ΑΥΤΟ ΚΟΣΤΙΖΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το ADR-844 §12 **έδεσε** το email στη φόρμα πρώτης επαφής (πρότυπο Airbnb/LinkedIn): ο
 * συνδεδεμένος που θέλει να τον βρουν αλλού αλλάζει το email **του λογαριασμού**. Αλλά η
 * ροή **δεν υπήρχε** — το δέσιμο αφαίρεσε δυνατότητα χωρίς αντικατάσταση (§12.6 #3).
 *
 * 🏆 **Εδώ, δίπλα στο πεδίο** — εκεί που κοιτάζει ο άνθρωπος (Airbnb *Personal info ›
 * Email › Edit* · Google Account *Personal info*). Κάθε δρόμος λέει τη **δική του**
 * αλήθεια: ο λογαριασμός Google δεν βλέπει κουμπί που θα έσπαγε (πρότυπο Figma).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΤΑ ΔΥΟ `dynamic` ΕΙΝΑΙ ΤΟ ΟΡΙΟ ΤΗΣ ΚΛΕΙΣΤΟΤΗΤΑΣ (CHECK 3.34) — ΜΗΝ ΤΑ ΚΑΝΕΙΣ ΣΤΑΤΙΚΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μετρημένο 2026-09-11: με στατικό διάλογο, το slice του `/profile` πήγε **7.003 bytes**
 * έναντι ταβανιού **4.138** (σφράγιση 3.311 + 25%) — ~25 κλειδιά για μια οθόνη που οι
 * περισσότεροι **δεν ανοίγουν ποτέ**. Στατικές μένουν μόνο οι υποδείξεις, που φαίνονται
 * στο πρώτο βάψιμο. Ίδιο ιδίωμα με το `FirstContactAction` (ADR-844).
 */

import React from 'react';
import dynamic from 'next/dynamic';
import { Mail } from 'lucide-react';

import { useAuthProviderInfo } from '@/auth';
import { emailChangeRouteOf } from '@/auth/utils/authProviders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { cn } from '@/lib/design-system';

import { EMAIL_CHANGE_KEYS, EMAIL_CHANGE_ROUTE_HINT_KEYS } from './email-change-labels';

const AccountEmailChangeDialog = dynamic(
  () => import('./AccountEmailChangeDialog').then((mod) => mod.AccountEmailChangeDialog),
  { ssr: false },
);

const AccountPasswordLinkAction = dynamic(
  () => import('./AccountPasswordLinkAction').then((mod) => mod.AccountPasswordLinkAction),
  { ssr: false },
);

export function AccountEmailField({ email }: { readonly email: string }): React.JSX.Element {
  const { t } = useTranslation(COMMON_NAMESPACES);
  const { providerIds } = useAuthProviderInfo();
  const layout = useLayoutClasses();
  const colors = useSemanticColors();
  const typography = useTypography();
  const iconSizes = useIconSizes();
  const route = emailChangeRouteOf(providerIds);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  return (
    <fieldset className={layout.flexColGap2}>
      <Label htmlFor="email" className={layout.flexCenterGap2}>
        <Mail className={iconSizes.xs} aria-hidden="true" />
        {t('account.profile.email')}
      </Label>
      <Input id="email" value={email} disabled readOnly className={colors.bg.muted} />
      <p className={cn(typography.body.xs, colors.text.muted)}>
        {t(EMAIL_CHANGE_ROUTE_HINT_KEYS[route])}
      </p>

      {route === 'password' ? (
        <>
          {/* ⚠️ `type="button"`: ζούμε μέσα στη φόρμα του προφίλ — ένα προεπιλεγμένο
              `submit` θα αποθήκευε το προφίλ αντί να ανοίξει τον διάλογο. */}
          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={() => setDialogOpen(true)}
            disabled={email === ''}
          >
            {t(EMAIL_CHANGE_KEYS.open)}
          </Button>
          {/* 🔑 **Αποδίδεται μόνο όταν ανοίξει**: το κλείσιμο τον ξεπροσαρτά, και η
              επόμενη αλλαγή ξεκινά από καθαρή φόρμα — χωρίς καμία χειροκίνητη επαναφορά. */}
          {dialogOpen && (
            <AccountEmailChangeDialog
              open
              currentEmail={email}
              onClose={() => setDialogOpen(false)}
            />
          )}
        </>
      ) : (
        <AccountPasswordLinkAction email={email} />
      )}
    </fieldset>
  );
}
