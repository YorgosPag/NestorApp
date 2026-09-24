'use client';

/**
 * @fileoverview **«Τι λέω στο AI;»** — οι κανόνες του κάδρου και δύο έτοιμες εντολές ανά σελίδα (ADR-881 §4.7).
 * @related landing-heroes-keys (`HERO_PROMPT_KEYS` · `HERO_GUIDE_RULE_KEYS`) · hooks/useCopyToClipboard
 * @module components/admin/landing-heroes/HeroPromptGuide
 *
 * 🔑 **Δύο βήματα, στην ΙΔΙΑ συνομιλία**: (1) η μέρα από εντολή· (2) η γαλάζια ώρα ως **επεξεργασία της ίδιας
 *    εικόνας**. Μια δεύτερη παραγωγή από την αρχή δίνει **άλλη** σκηνή, ακόμη και με ίδιο seed — και η
 *    εναλλαγή θέματος θα έμοιαζε με «άλλαξε ιστότοπος» αντί για «έπεσε το βράδυ» (ADR-777 §8.81.2).
 * 🔑 **Η εντολή είναι στα αγγλικά και στις δύο γλώσσες** — τα μοντέλα εικόνας αποδίδουν σταθερότερα· η
 *    εξήγηση γύρω της ακολουθεί τη γλώσσα της διεπαφής (N.11: όλα από τα locale).
 */

import React from 'react';
import { Check, Copy, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { LandingHeroPage } from '@/lib/landing/landing-hero-vocabulary';

import { HERO_GUIDE_RULE_KEYS, HERO_PROMPT_KEYS, LANDING_HEROES_NS } from './landing-heroes-keys';

export function HeroPromptGuide({ page }: { readonly page: LandingHeroPage }) {
  const { t } = useTranslation(LANDING_HEROES_NS);

  return (
    <details className="group rounded-lg border border-border p-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
        <Sparkles aria-hidden="true" className="h-4 w-4" />
        {t('guide.title')}
      </summary>
      <section className="mt-4 flex flex-col gap-4 text-sm">
        <p className="m-0 text-muted-foreground">{t('guide.intro')}</p>
        <ol className="m-0 flex list-decimal flex-col gap-1 pl-5">
          {HERO_GUIDE_RULE_KEYS.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ol>
        <PromptBlock title={t('guide.step1')} prompt={t(HERO_PROMPT_KEYS[page])} />
        <PromptBlock title={t('guide.step2')} prompt={t('guide.prompts.dusk')} />
        <p className="m-0 text-xs text-muted-foreground">{t('guide.chatgptNote')}</p>
      </section>
    </details>
  );
}

function PromptBlock({ title, prompt }: { readonly title: string; readonly prompt: string }) {
  const { t } = useTranslation(LANDING_HEROES_NS);
  const { copy, copied } = useCopyToClipboard();
  const Icon = copied ? Check : Copy;

  return (
    <figure className="m-0 flex flex-col gap-2">
      <figcaption className="flex flex-wrap items-center justify-between gap-2 font-medium">
        {title}
        <Button type="button" variant="outline" size="sm" onClick={() => void copy(prompt)}>
          <Icon aria-hidden="true" className="mr-2 h-4 w-4" />
          {t(copied ? 'guide.copied' : 'guide.copy')}
        </Button>
      </figcaption>
      <blockquote lang="en" className="m-0 whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">
        {prompt}
      </blockquote>
    </figure>
  );
}
