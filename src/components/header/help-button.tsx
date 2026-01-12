'use client';

/**
 * =============================================================================
 * HELP BUTTON - ENTERPRISE HELP HUB ENTRY POINT
 * =============================================================================
 *
 * Enterprise Pattern: Centralized Help Hub access point
 * Following Google/Microsoft/Salesforce UX standards
 *
 * Features:
 * - Documentation/FAQ access
 * - Keyboard shortcuts reference
 * - Support/Contact options
 * - Command Palette trigger (Ctrl/Cmd+K)
 *
 * @module components/header/help-button
 * @enterprise ADR-023 - Help Hub Centralization
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  HelpCircle,
  BookOpen,
  Keyboard,
  MessageCircle,
  Command,
  ExternalLink,
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function HelpButton() {
  const iconSizes = useIconSizes();
  const router = useRouter();
  const { t } = useTranslation('common');

  // 🏢 ENTERPRISE: SSR-safe platform detection
  const [isMac, setIsMac] = React.useState(false);

  React.useEffect(() => {
    setIsMac(typeof navigator !== 'undefined' && navigator.platform?.includes('Mac'));
  }, []);

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  const handleCommandPalette = () => {
    // 🏢 ENTERPRISE: Dispatch global keyboard event for command palette
    // This allows the command palette to be triggered from anywhere
    const isWindows = typeof navigator !== 'undefined' && navigator.platform?.includes('Win');
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      ctrlKey: isWindows,
      bubbles: true,
    });
    document.dispatchEvent(event);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label={t('helpHub.menuLabel')}>
          <HelpCircle className={iconSizes.sm} />
          <span className="sr-only">{t('helpHub.menuLabel')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel>{t('helpHub.title')}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Command Palette */}
        <DropdownMenuItem onClick={handleCommandPalette}>
          <Command className={`mr-2 ${iconSizes.sm}`} />
          <span>{t('helpHub.commandPalette')}</span>
          <DropdownMenuShortcut>
            {isMac ? '⌘K' : 'Ctrl+K'}
          </DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Keyboard Shortcuts */}
        <DropdownMenuItem onClick={() => handleNavigation('/settings/shortcuts')}>
          <Keyboard className={`mr-2 ${iconSizes.sm}`} />
          <span>{t('helpHub.keyboardShortcuts')}</span>
        </DropdownMenuItem>

        {/* Documentation */}
        <DropdownMenuItem onClick={() => handleNavigation('/help/docs')}>
          <BookOpen className={`mr-2 ${iconSizes.sm}`} />
          <span>{t('helpHub.documentation')}</span>
          <ExternalLink className={`ml-auto ${iconSizes.xs}`} />
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Support */}
        <DropdownMenuItem onClick={() => handleNavigation('/help/support')}>
          <MessageCircle className={`mr-2 ${iconSizes.sm}`} />
          <span>{t('helpHub.support')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
