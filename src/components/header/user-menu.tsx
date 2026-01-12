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
import {
  User,
  Settings,
  Keyboard,
  HelpCircle,
  LogOut,
} from 'lucide-react';
// 🏢 ENTERPRISE: Centralized design system
import { useIconSizes } from '@/hooks/useIconSizes';
import { Spinner } from '@/components/ui/spinner';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function UserMenu() {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
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
    console.log('🔐 [UserMenu] Starting optimistic logout');

    // 🚀 OPTIMISTIC: Redirect immediately for instant feedback
    router.push('/login');

    // 🔥 FIRE & FORGET: SignOut in background
    try {
      await signOut();
      console.log('✅ [UserMenu] Logout completed');
    } catch (error) {
      console.error('🔴 [UserMenu] Logout error (user already redirected):', error);
      // User is already on login page, so this error is acceptable
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" disabled={isLoggingOut}>
          {isLoggingOut ? (
            <Spinner size="small" aria-label={t('userMenu.loggingOut')} />
          ) : (
            <User className={iconSizes.sm} />
          )}
          <span className="sr-only">{t('userMenu.menuLabel')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user?.displayName || t('userMenu.defaultUser')}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email || t('userMenu.noEmail')}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <User className={`mr-2 ${iconSizes.sm}`} />
            <span>{t('userMenu.profile')}</span>
            <DropdownMenuShortcut>{t('userMenu.keyboard.profile')}</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings className={`mr-2 ${iconSizes.sm}`} />
            <span>{t('userMenu.settings')}</span>
            <DropdownMenuShortcut>{t('userMenu.keyboard.settings')}</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Keyboard className={`mr-2 ${iconSizes.sm}`} />
            <span>{t('userMenu.shortcuts')}</span>
            <DropdownMenuShortcut>{t('userMenu.keyboard.shortcuts')}</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <HelpCircle className={`mr-2 ${iconSizes.sm}`} />
          <span>{t('userMenu.help')}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="text-red-600 dark:text-red-400 cursor-pointer focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/50"
        >
          {isLoggingOut ? (
            <Spinner size="small" className="mr-2" />
          ) : (
            <LogOut className={`mr-2 ${iconSizes.sm}`} />
          )}
          <span>{isLoggingOut ? t('userMenu.loggingOut') : t('userMenu.logout')}</span>
          {!isLoggingOut && <DropdownMenuShortcut>{t('userMenu.keyboard.logout')}</DropdownMenuShortcut>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
