'use client';

import { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { changeLanguage, preloadCriticalNamespaces } from '@/i18n/lazy-config';
import { useIconSizes } from '@/hooks/useIconSizes';

const languages = [
  { code: 'el', name: 'Ελληνικά', flag: '🇬🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'pseudo', name: 'Pseudo (Dev)', flag: '🧪' },
];

export function LanguageSwitcher() {
  const iconSizes = useIconSizes();
  const { i18n } = useTranslation();
  const [isChanging, setIsChanging] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(languages[0]);

  useEffect(() => {
    const lang = languages.find(lang => lang.code === i18n.language) || languages[0];
    setCurrentLanguage(lang);
  }, [i18n.language]);

  const handleLanguageChange = async (languageCode: string) => {
    if (isChanging || languageCode === i18n.language) return;
    
    setIsChanging(true);
    
    try {
      // Import type from lazy-config
      type Language = 'el' | 'en' | 'pseudo';
      const nextLanguage = languageCode as Language;

      // Preload critical namespaces for the new language (non-blocking on failures)
      try {
        await preloadCriticalNamespaces(nextLanguage);
      } catch (error) {
        console.warn('⚠️ Failed to preload critical namespaces:', error);
      }

      // Preload route-specific namespaces to avoid fallback-to-el
      const { loadNamespace } = await import('@/i18n/lazy-config');
      if (window.location.pathname.includes('/geo/canvas')) {
        await loadNamespace('geo-canvas', nextLanguage);
      }
      if (window.location.pathname.startsWith('/admin')) {
        await loadNamespace('admin', nextLanguage);
      }
      
      // Change language (centralized helper also preloads critical namespaces)
      await changeLanguage(nextLanguage);
      
      // Store preference in localStorage
      localStorage.setItem('preferred-language', nextLanguage);
      
    } catch (error) {
      console.error('❌ Failed to change language:', error);
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative"
          disabled={isChanging}
        >
          <Globe className={`${iconSizes.sm} ${isChanging ? 'animate-spin' : ''}`} />
          <span className="absolute -bottom-0.5 -right-0.5 text-xs leading-none">{currentLanguage.flag}</span>
          <span className="sr-only">Αλλαγή γλώσσας - {currentLanguage.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onSelect={(event) => {
              event.preventDefault();
              handleLanguageChange(language.code);
            }}
            className={`flex items-center gap-2 ${
              currentLanguage.code === language.code ? 'bg-accent' : ''
            }`}
          >
            <span>{language.flag}</span>
            <span>{language.name}</span>
            {currentLanguage.code === language.code && (
              <span className="ml-auto text-xs text-muted-foreground">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
