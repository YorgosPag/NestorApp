// ============================================================================
// 🏢 ENTERPRISE: Universal Email Compose Helper
// ============================================================================
// Supports: Gmail, Outlook, Yahoo, Apple Mail, and any desktop email client.
// Extracted from ErrorBoundary for reuse across the application.
// @pattern Google — Single Responsibility, reusable utility
// ============================================================================

import { Mail, Globe, type LucideIcon } from 'lucide-react';
import { createModuleLogger } from '@/lib/telemetry';
import type { EmailProvider, EmailComposeOptions, EmailProviderConfig } from './types';

const logger = createModuleLogger('EmailCompose');

/**
 * Opens email compose window for the specified provider
 */
export function openEmailCompose(provider: EmailProvider, options: EmailComposeOptions): void {
  const { to, subject, body } = options;
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);

  let url: string;

  switch (provider) {
    case 'gmail':
      url = `https://mail.google.com/mail/?view=cm&to=${to}&su=${encodedSubject}&body=${encodedBody}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      break;

    case 'outlook':
      url = `https://outlook.live.com/mail/0/deeplink/compose?to=${to}&subject=${encodedSubject}&body=${encodedBody}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      break;

    case 'yahoo':
      url = `https://compose.mail.yahoo.com/?to=${to}&subject=${encodedSubject}&body=${encodedBody}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      break;

    case 'default':
    default: {
      url = `mailto:${to}?subject=${encodedSubject}&body=${encodedBody}`;
      const link = document.createElement('a');
      link.href = url;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      break;
    }
  }

  logger.info('Opened email compose', { provider, to });
}

/**
 * 🏢 ENTERPRISE: Available email providers with Lucide icons
 */
export const EMAIL_PROVIDERS: EmailProviderConfig[] = [
  { id: 'gmail', label: 'Gmail', labelEl: 'Gmail', Icon: Mail as LucideIcon },
  { id: 'outlook', label: 'Outlook / Hotmail', labelEl: 'Outlook / Hotmail', Icon: Mail as LucideIcon },
  { id: 'yahoo', label: 'Yahoo Mail', labelEl: 'Yahoo Mail', Icon: Mail as LucideIcon },
  { id: 'default', label: 'Default Email App', labelEl: 'Εφαρμογή Email', Icon: Globe as LucideIcon },
];
