'use client';

/**
 * =============================================================================
 * 🖼️ ΕΙΚΟΝΕΣ ΗΡΩΑ — ΤΟ ΕΡΓΑΛΕΙΟ ΤΟΥ ΠΑΡΟΧΟΥ (ADR-881)
 * =============================================================================
 * Μία καρτέλα ανά σελίδα (`/` · `/pro` · `/stay`), όπως ο theme editor του Shopify επεξεργάζεται μία
 * ενότητα τη φορά. Σε κάθε καρτέλα: τι είναι ζωντανό · νέα έκδοση · ιστορικό · οδηγός AI.
 *
 * 🔒 Η διαδρομή API φυλάσσεται από `super_admin` + `platform_landing_heroes:heroes:publish` — η οθόνη
 *    **δεν** είναι φρουρός, απλώς δεν έχει τι να δείξει σε όποιον αρνηθεί ο διακομιστής.
 * @module components/admin/pages/LandingHeroesPageContent
 * @performance lazy-loaded via LazyRoutes (ADR-294)
 */

import React from 'react';
import { AlertTriangle, ImageIcon, RefreshCw } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { LANDING_HERO_PAGES } from '@/lib/landing/landing-hero-vocabulary';

import { HeroPageWorkspace } from '../landing-heroes/HeroPageWorkspace';
import { HERO_ERROR_KEYS, HERO_PAGE_KEYS, LANDING_HEROES_NS } from '../landing-heroes/landing-heroes-keys';
import { useLandingHeroesAdmin } from '../landing-heroes/useLandingHeroesAdmin';

export function LandingHeroesPageContent() {
  const { t } = useTranslation(LANDING_HEROES_NS);
  const admin = useLandingHeroesAdmin();
  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-col gap-2">
        <h1 className="m-0 flex items-center gap-3 text-2xl font-bold">
          <ImageIcon aria-hidden="true" className="h-6 w-6" />
          {t('title')}
        </h1>
        <p className="m-0 text-muted-foreground">{t('subtitle')}</p>
      </header>
      {admin.error !== null && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle aria-hidden="true" className="h-4 w-4" />
          <AlertDescription>{t(HERO_ERROR_KEYS[admin.error])}</AlertDescription>
        </Alert>
      )}
      <LoadState status={admin.state.status} onRetry={() => void admin.reload()} />
      {admin.state.status === 'ready' && (
        <Tabs defaultValue="home">
          <TabsList>
            {LANDING_HERO_PAGES.map((page) => (
              <TabsTrigger key={page} value={page}>{t(HERO_PAGE_KEYS[page])}</TabsTrigger>
            ))}
          </TabsList>
          {LANDING_HERO_PAGES.map((page) => (
            // 🔑 `forceMount`: ένα μισοτελειωμένο πρόχειρο ΔΕΝ χάνεται με την αλλαγή καρτέλας.
            <TabsContent key={page} value={page} forceMount className="mt-6 data-[state=inactive]:hidden">
              <HeroPageWorkspace page={page} state={admin.state} admin={admin} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </main>
  );
}

/** Φόρτωση / σφάλμα φόρτωσης — με επανάληψη, ποτέ κενή οθόνη. */
function LoadState({ status, onRetry }: { readonly status: 'loading' | 'error' | 'ready'; readonly onRetry: () => void }) {
  const { t } = useTranslation(LANDING_HEROES_NS);
  if (status === 'loading') return <p className="text-muted-foreground">{t('loading')}</p>;
  if (status === 'ready') return null;
  return (
    <section className="flex flex-col items-start gap-3">
      <p className="m-0 text-destructive">{t('loadError')}</p>
      <Button type="button" variant="outline" onClick={onRetry}>
        <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />
        {t('retry')}
      </Button>
    </section>
  );
}
