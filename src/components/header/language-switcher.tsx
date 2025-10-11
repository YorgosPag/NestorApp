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
import { preloadCriticalNamespaces } from '@/i18n/lazy-config';

const languages = [
  { code: 'el', name: 'Ελληνικά', flag: '🇬🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'pseudo', name: 'Pseudo (Dev)', flag: '🧪' },
];

export function LanguageSwitcher() {
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
      console.log(`🌍 Changing language to: ${languageCode}`);
      
      // Preload critical namespaces for the new language
      await preloadCriticalNamespaces(languageCode as any);

      // Also preload geo-canvas namespace if we're on that page
      if (window.location.pathname.includes('/geo/canvas')) {
        const { loadNamespace } = await import('@/i18n/lazy-config');
        await loadNamespace('geo-canvas', languageCode as any);
      }
      
      // Change language
      await i18n.changeLanguage(languageCode);
      
      // Store preference in localStorage
      localStorage.setItem('preferred-language', languageCode);
      
      console.log(`✅ Language changed successfully to: ${languageCode}`);
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
          variant="ghost" 
          size="sm" 
          className="flex items-center gap-2"
          disabled={isChanging}
        >
          <Globe className={`h-4 w-4 ${isChanging ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{currentLanguage.flag} {currentLanguage.name}</span>
          <span className="sm:hidden">{currentLanguage.flag}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
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