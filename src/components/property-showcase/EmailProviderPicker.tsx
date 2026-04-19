'use client';

import React, { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

type ProviderKey = 'gmail' | 'outlook' | 'yahoo' | 'defaultApp';

const COMPOSE_URLS: Record<Exclude<ProviderKey, 'defaultApp'>, (to: string) => string> = {
  gmail: (to) => `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}`,
  outlook: (to) => `https://outlook.live.com/owa/?path=/mail/action/compose&to=${encodeURIComponent(to)}`,
  yahoo: (to) => `https://compose.mail.yahoo.com/?to=${encodeURIComponent(to)}`,
};

interface EmailProviderPickerProps {
  address: string;
}

export function EmailProviderPicker({ address }: EmailProviderPickerProps) {
  const { t } = useTranslation('showcase');
  const [copied, setCopied] = useState(false);

  const handleProvider = (key: Exclude<ProviderKey, 'defaultApp'>) => {
    const url = COMPOSE_URLS[key](address);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDefaultApp = () => {
    window.location.href = `mailto:${address}`;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="text-left hover:underline focus:outline-none focus-visible:underline truncate"
          aria-label={t('header.contacts.emailMenu.title')}
        >
          {address}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        <DropdownMenuLabel>{t('header.contacts.emailMenu.title')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleProvider('gmail')}>
          <ExternalLink className="h-4 w-4 mr-2" aria-hidden />
          {t('header.contacts.emailMenu.gmail')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleProvider('outlook')}>
          <ExternalLink className="h-4 w-4 mr-2" aria-hidden />
          {t('header.contacts.emailMenu.outlook')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleProvider('yahoo')}>
          <ExternalLink className="h-4 w-4 mr-2" aria-hidden />
          {t('header.contacts.emailMenu.yahoo')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDefaultApp}>
          {t('header.contacts.emailMenu.defaultApp')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCopy} onSelect={(e) => e.preventDefault()}>
          {copied
            ? <Check className="h-4 w-4 mr-2" aria-hidden />
            : <Copy className="h-4 w-4 mr-2" aria-hidden />}
          {copied
            ? t('header.contacts.emailMenu.copied')
            : t('header.contacts.emailMenu.copyAddress')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
