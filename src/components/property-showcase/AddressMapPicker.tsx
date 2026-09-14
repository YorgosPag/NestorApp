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

// 🔑 ADR-841 §7 Α21.16 (N.0.2) — ο πίνακας των παρόχων ήταν αντιγραμμένος και στο email template.
import { MAP_SEARCH_URLS, type MapSearchProvider } from '@/lib/geo/map-links';

type ProviderKey = MapSearchProvider;
const MAP_URLS = MAP_SEARCH_URLS;

interface AddressMapPickerProps {
  address: string;
  className?: string;
}

export function AddressMapPicker({ address, className }: AddressMapPickerProps) {
  const { t } = useTranslation('showcase');
  const [copied, setCopied] = useState(false);

  const handleOpen = (key: ProviderKey) => {
    const url = MAP_URLS[key](address);
    window.open(url, '_blank', 'noopener,noreferrer');
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

  const triggerClass =
    className
    ?? 'text-left hover:underline focus:outline-none focus-visible:underline';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={triggerClass}
          aria-label={t('header.contacts.addressMenu.title')}
        >
          {address}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        <DropdownMenuLabel>{t('header.contacts.addressMenu.title')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleOpen('googleMaps')}>
          <ExternalLink className="h-4 w-4 mr-2" aria-hidden />
          {t('header.contacts.addressMenu.googleMaps')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleOpen('googleEarth')}>
          <ExternalLink className="h-4 w-4 mr-2" aria-hidden />
          {t('header.contacts.addressMenu.googleEarth')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleOpen('bing')}>
          <ExternalLink className="h-4 w-4 mr-2" aria-hidden />
          {t('header.contacts.addressMenu.bing')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleOpen('apple')}>
          <ExternalLink className="h-4 w-4 mr-2" aria-hidden />
          {t('header.contacts.addressMenu.apple')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleOpen('osm')}>
          <ExternalLink className="h-4 w-4 mr-2" aria-hidden />
          {t('header.contacts.addressMenu.osm')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleOpen('waze')}>
          <ExternalLink className="h-4 w-4 mr-2" aria-hidden />
          {t('header.contacts.addressMenu.waze')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCopy} onSelect={(e) => e.preventDefault()}>
          {copied
            ? <Check className="h-4 w-4 mr-2" aria-hidden />
            : <Copy className="h-4 w-4 mr-2" aria-hidden />}
          {copied
            ? t('header.contacts.addressMenu.copied')
            : t('header.contacts.addressMenu.copyAddress')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
