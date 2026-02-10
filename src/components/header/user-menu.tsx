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

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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

const logger = createModuleLogger('UserMenu');

export function UserMenu() {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const layout = useLayoutClasses();
  const router = useRouter();
  // 🏢 ENTERPRISE: Centralized auth hook
  const { user, signOut } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
              <p className="text-xs leading-none text-muted-foreground">
                {user?.email || t('userMenu.noEmail')}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>
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
          className={`text-red-600 dark:text-red-400 ${layout.cursorPointer} focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/50`}
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
