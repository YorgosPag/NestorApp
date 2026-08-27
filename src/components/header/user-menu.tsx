'use client';

/**
 * =============================================================================
 * USER MENU - ENTERPRISE DROPDOWN WITH LOGOUT
 * =============================================================================
 *
 * Enterprise Pattern: Optimistic UI for instant feedback
 * - Immediate redirect (no waiting for Firebase)
 * - Background signOut (fire & forget)
 * - Loading state during transition
 *
 * @module components/header/user-menu
 * @enterprise ADR-022 - Optimistic Auth Operations
 */

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { useState } from 'react';
import { useRouter } from '@/lib/workspace/navigation';

// 🏢 ENTERPRISE: Centralized auth (NO direct Firebase imports!)
import { useAuth } from '@/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
// ADR-798 §7 — «τι είσαι», ο χαρακτηρισμός του, και τι δουλειά υποδεικνύει.
import { DeclaredOccupationBadge } from '@/components/header/DeclaredOccupationBadge';
// ADR-820 §5.1 — «σε ποιου τον χώρο;»: η ΜΙΑ πόρτα ανάμεσα στους δύο κόσμους.
import { MySpacesSection } from '@/components/header/MySpacesSection';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  User,
  LogOut,
} from 'lucide-react';
// 🏢 ENTERPRISE: Centralized design system
import { useIconSizes } from '@/hooks/useIconSizes';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { Spinner } from '@/components/ui/spinner';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Centralized routes
import { ACCOUNT_ROUTES, AUTH_ROUTES } from '@/lib/routes';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

const logger = createModuleLogger('UserMenu');

/**
 * @param signedOut Τι μπαίνει στη θέση του μενού όταν **δεν** υπάρχει ταυτότητα
 *   — η πόρτα «Σύνδεση» του δημόσιου ιστότοπου, ή τίποτα.
 *
 * 🔑 **ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟΝ ΚΑΛΟΥΝΤΑ** (ADR-809): αυτό το component **ήδη**
 * κρίνει «υπάρχει άνθρωπος;» για να αποφασίσει αν θα αποδοθεί. Ένας καλών που
 * έκρινε **μόνος του** αν θα δείξει «Σύνδεση» θα ήταν **δεύτερη απάντηση στην
 * ίδια ερώτηση** (σχήμα ADR-749) — και οι δύο θα απέκλιναν στο παράθυρο του
 * `isLoggingOut`, όπου το μενού **επίτηδες** μένει ορατό με `user === null`:
 * ο καλών θα ζωγράφιζε «Σύνδεση» **δίπλα** στο ανοιχτό μενού.
 *
 * 🔴 Η ανάγκη γεννήθηκε από μετρημένο ψέμα: ο `PublicSiteHeader` έδειχνε
 * «Σύνδεση» **άνευ όρων**, δηλαδή και σε **συνδεδεμένο** άνθρωπο, σε **δύο**
 * γειτονιές — `(me)` (φρουρημένη από `ProtectedRoute`: **κανείς** ανώνυμος δεν
 * τη βλέπει ποτέ) και `(light)`.
 */
export function UserMenu({ signedOut }: Readonly<{ signedOut?: React.ReactNode }> = {}) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation(COMMON_NAMESPACES);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const layout = useLayoutClasses();
  const router = useRouter();
  // 🏢 ENTERPRISE: Centralized auth hook
  const { user, signOut } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // No user = no menu (after logout or before login) — και στη θέση του ό,τι
  // δήλωσε ο κόσμος. Χωρίς δήλωση, `undefined` ⇒ ταυτόσημο με το παλιό `null`:
  // η επέκταση είναι **γνήσια γενίκευση**, κανένας υπάρχων καλών δεν αλλάζει.
  if (!user && !isLoggingOut) return <>{signedOut}</>;

  /**
   * 🏢 ENTERPRISE: Optimistic Logout Pattern
   *
   * 1. Set loading state immediately
   * 2. Redirect FIRST (instant user feedback)
   * 3. SignOut in background (fire & forget)
   *
   * This matches Google/Microsoft logout UX
   */
  const handleLogout = async () => {
    // Prevent double-click
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    logger.info('Starting optimistic logout');

    // 🚀 OPTIMISTIC: Redirect immediately for instant feedback
    router.push(AUTH_ROUTES.login);

    // 🔥 FIRE & FORGET: SignOut in background
    try {
      await signOut();
      logger.info('Logout completed');
    } catch (error) {
      logger.error('Logout error (user already redirected)', { error });
      // User is already on login page, so this error is acceptable
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* 🏢 ENTERPRISE: suppressHydrationWarning for i18n SSR/CSR mismatch
            The server doesn't know user's language preference, so translations
            may differ between server and client render. This is expected behavior. */}
        <Button
          variant="outline"
          size="icon"
          disabled={isLoggingOut}
          className="relative overflow-hidden"
          suppressHydrationWarning
        >
          {isLoggingOut ? (
            <Spinner size="small" aria-label={t('userMenu.loggingOut')} />
          ) : user?.photoURL ? (
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={user.photoURL}
                alt={user.displayName || t('userMenu.defaultUser')}
                referrerPolicy="no-referrer"
              />
              <AvatarFallback>
                <User className={iconSizes.sm} />
              </AvatarFallback>
            </Avatar>
          ) : (
            <User className={iconSizes.sm} />
          )}
          <span className="sr-only" suppressHydrationWarning>{t('userMenu.menuLabel')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-3">
            {/* User Avatar */}
            <Avatar className="h-10 w-10">
              {user?.photoURL ? (
                <AvatarImage
                  src={user.photoURL}
                  alt={user.displayName || t('userMenu.defaultUser')}
                  referrerPolicy="no-referrer"
                />
              ) : null}
              <AvatarFallback>
                <User className={iconSizes.md} />
              </AvatarFallback>
            </Avatar>
            {/* User Info */}
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {user?.displayName || t('userMenu.defaultUser')}
              </p>
              <p className={cn("text-xs leading-none", colors.text.muted)}>
                {user?.email || t('userMenu.noEmail')}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* ADR-798 §7 — Η ΥΠΟΣΧΕΣΗ ΣΤΗΝ ΟΘΟΝΗ.
            Το §7 λέει «η οθόνη δείχνει ΠΑΝΤΑ ποια από τις τρεις ισχύει», και
            μετρήθηκε (2026-08-25) ότι δεν έδειχνε ΚΑΜΙΑ: `confidence` και
            `isClassified` είχαν **0** καταναλωτές παραγωγής.

            🔑 ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΗΝ ΜΠΑΡΑ: η ταυτότητα ζει δίπλα στο avatar —
            το ίδιο μενού που οδηγεί στο «Λογαριασμός». Στην κεφαλίδα θα ήταν
            **ένατο** στοιχείο σε μια σειρά που έχει ήδη οκτώ.
            ⚠️ ΚΑΜΙΑ ερώτηση/modal (ADR-748 Ε7.γ′ · ADR-798 Α5): όταν δεν έχει
            δηλωθεί τίποτα γίνεται **πρόταση**, μέσα σε μενού που άνοιξε ο ίδιος. */}
        <DeclaredOccupationBadge />
        <DropdownMenuSeparator />
        {/* ADR-820 §5.1 — ΟΙ ΧΩΡΟΙ ΜΟΥ.
            🔑 ΕΔΩ, ΚΑΙ ΟΧΙ ΣΤΟ SIDEBAR: αυτό το μενού είναι το **μόνο** σημείο που
            αποδίδεται και στους πέντε κόσμους (`ShellUtilities`, ADR-809 / CHECK
            3.72) ⇒ **μία ένθεση καλύπτει ΚΑΙ ΤΙΣ ΔΥΟ κατευθύνσεις**. Το sidebar ζει
            μόνο στο `(app)` (CHECK 3.52 Κ3) και θα ήθελε δεύτερη ένθεση αλλού.
            🔑 ΑΜΕΣΩΣ ΜΕΤΑ ΤΗΝ ΤΑΥΤΟΤΗΤΑ, ΠΡΙΝ ΤΙΣ ΠΡΑΞΕΙΣ — και είναι η ίδια σειρά
            που ήδη τηρεί το μενού: «ποιος είμαι» (avatar · email · επάγγελμα), μετά
            «πού είμαι», και τέλος τι μπορώ να **κάνω** (λογαριασμός · αποσύνδεση).
            ⚠️ ΚΑΜΙΑ κρίση ταυτότητας εδώ: την κάνει το ίδιο το τμήμα, μία φορά —
            ίδιο δόγμα με το `UserMenu` μέσα στο `ShellUtilities`. */}
        <MySpacesSection />
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => router.push(ACCOUNT_ROUTES.root)}
            className={layout.cursorPointer}
          >
            <User className={`${layout.buttonIconSpacing} ${iconSizes.sm}`} />
            <span>{t('userMenu.account')}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={`text-destructive ${layout.cursorPointer} focus:text-destructive focus:bg-destructive/10`}
        >
          {isLoggingOut ? (
            <Spinner size="small" className={layout.buttonIconSpacing} />
          ) : (
            <LogOut className={`${layout.buttonIconSpacing} ${iconSizes.sm}`} />
          )}
          <span>{isLoggingOut ? t('userMenu.loggingOut') : t('userMenu.logout')}</span>
          {!isLoggingOut && <DropdownMenuShortcut>{t('userMenu.keyboard.logout')}</DropdownMenuShortcut>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
