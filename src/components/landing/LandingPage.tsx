'use client';

import React, { useState } from 'react';
import { Link, useRouter } from '@/lib/workspace/navigation';
import { Search, MapPin, Home, TrendingUp, Building, ArrowRight, Users, Shield } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS, GRADIENT_HOVER_EFFECTS } from '@/components/ui/effects';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { LucideIcon } from 'lucide-react';
import { FeatureCard, PropertyShowcaseCard, type CardTone } from './LandingShowcaseCards';
import '@/lib/design-system';


/**
 * Τα τρία χαρακτηριστικά της αρχικής. Ο **τόνος** είναι σημασιολογικό κλειδί,
 * όχι κλάση — τη λύνει η ίδια η {@link FeatureCard} από το `useSemanticColors`.
 */
const FEATURE_CARDS = [
  { icon: MapPin, tone: 'info', titleKey: 'features.interactiveFloorplan.title', descriptionKey: 'features.interactiveFloorplan.description' },
  { icon: Shield, tone: 'accent', titleKey: 'features.guaranteedQuality.title', descriptionKey: 'features.guaranteedQuality.description' },
  { icon: Users, tone: 'success', titleKey: 'features.personalService.title', descriptionKey: 'features.personalService.description' },
] as const satisfies readonly {
  icon: LucideIcon;
  tone: CardTone;
  titleKey: string;
  descriptionKey: string;
}[];

/**
 * Τα τρία προβεβλημένα ακίνητα.
 *
 * ⚠️ Το `gradientClass` κρατά **ωμή παλέτα Tailwind** και μένει ΕΔΩ επίτηδες:
 * το CHECK 3.26 (ADR-365, baseline 0/0) μπλοκάρει ωμή παλέτα σε **νέο** αρχείο,
 * οπότε μετακόμισή του στο `LandingShowcaseCards.tsx` θα το έκανε παράβαση χωρίς
 * να το διορθώσει. Η σωστή θεραπεία είναι σημασιολογικά tokens — άλλη δουλειά.
 */
const SHOWCASE_PROPERTIES = [
  { key: 'studioB1', icon: Home, gradientClass: 'bg-gradient-to-br from-blue-400 to-blue-600', price: '€65.000', rating: 4.0 },
  { key: 'apartment2D', icon: Building, gradientClass: 'bg-gradient-to-br from-purple-400 to-purple-600', price: '€145.000', rating: 5.0 },
  { key: 'maisonetteE1', icon: TrendingUp, gradientClass: 'bg-gradient-to-br from-green-400 to-green-600', price: '€280.000', rating: 4.5 },
] as const satisfies readonly {
  key: string;
  icon: LucideIcon;
  gradientClass: string;
  price: string;
  rating: number;
}[];

export function LandingPage() {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation('landing');
  const router = useRouter();
  const [searchType, setSearchType] = useState('all');
  const [location, setLocation] = useState('');
  const [priceRange, setPriceRange] = useState('all');
  const [areaRange, setAreaRange] = useState('all');

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchType && searchType !== 'all') params.set('type', searchType);
    if (location) params.set('location', location);
    if (priceRange && priceRange !== 'all') params.set('price', priceRange);
    if (areaRange && areaRange !== 'all') params.set('area', areaRange);
    router.push(`/properties?${params.toString()}`);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-gray-900 dark:to-blue-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* 🏢 ENTERPRISE: Decorative overlay with pointer-events-none to prevent click blocking */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-pink-600/10 backdrop-blur-3xl pointer-events-none" aria-hidden="true" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <header className="text-center mb-12">
            <h1 className={`text-5xl lg:text-6xl font-bold ${colors.text.foreground} mb-6`}>
              {t('hero.findIdeal')}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                {t('hero.property')}
              </span>
            </h1>
            <p className={`text-xl ${colors.text.muted} max-w-2xl mx-auto`}>
              {t('hero.subtitle')}
            </p>
          </header>

          {/* Search Box */}
          <section className="max-w-4xl mx-auto" aria-label={t('search.searchCriteria')}>
            <form
              onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
              className={`${colors.bg.primary} ${quick.card} shadow-xl p-6`}
              role="search"
              aria-label={t('search.searchButton')}
            >
              <fieldset className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <legend className="sr-only">{t('search.searchCriteria')}</legend>
                {/* Property Type */}
                <fieldset className="space-y-1">
                  <label htmlFor="search-type" className={`text-xs font-semibold ${colors.text.muted} block`}>
                    {t('search.propertyType')}
                  </label>
                  <Select value={searchType} onValueChange={setSearchType}>
                    <SelectTrigger id="search-type" className={`w-full px-4 py-3 ${colors.bg.secondary} ${colors.text.foreground} ${quick.input} focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer`}>
                      <SelectValue placeholder={t('search.allTypes')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('search.allTypes')}</SelectItem>
                      <SelectItem value="Στούντιο">{t('search.types.studio')}</SelectItem>
                      <SelectItem value="Γκαρσονιέρα">{t('search.types.studio2')}</SelectItem>
                      <SelectItem value="Διαμέρισμα">{t('search.types.apartment')}</SelectItem>
                      <SelectItem value="Μεζονέτα">{t('search.types.maisonette')}</SelectItem>
                      <SelectItem value="Αποθήκη">{t('search.types.storage')}</SelectItem>
                    </SelectContent>
                  </Select>
                </fieldset>

                {/* Location */}
                <fieldset className="relative">
                  <label htmlFor="search-location" className={`text-xs font-semibold ${colors.text.muted} mb-1 block`}>
                    {t('search.location')}
                  </label>
                  <div className="relative">
                    <MapPin className={`absolute left-3 top-3.5 ${iconSizes.md} ${colors.text.muted}`} />
                    <input
                      id="search-location"
                      aria-label={t('search.location')}
                      inputMode="search"
                      type="text"
                      placeholder={t('search.locationPlaceholder')}
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className={`w-full pl-10 pr-4 py-3 ${colors.bg.secondary} ${colors.text.foreground} ${quick.input} focus:outline-none focus:ring-2 focus:ring-ring`}
                    />
                  </div>
                </fieldset>

                {/* Price Range */}
                <fieldset className="space-y-1">
                  <label htmlFor="search-price" className={`text-xs font-semibold ${colors.text.muted} block`}>
                    {t('search.priceRange')}
                  </label>
                  <Select value={priceRange} onValueChange={setPriceRange}>
                    <SelectTrigger id="search-price" className={`w-full px-4 py-3 ${colors.bg.secondary} ${colors.text.foreground} ${quick.input} focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer`}>
                      <SelectValue placeholder={t('search.allPrices')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('search.priceRanges.all')}</SelectItem>
                      <SelectItem value="0-50000">{t('search.priceRanges.up50k')}</SelectItem>
                      <SelectItem value="50000-100000">{t('search.priceRanges.50k100k')}</SelectItem>
                      <SelectItem value="100000-200000">{t('search.priceRanges.100k200k')}</SelectItem>
                      <SelectItem value="200000+">{t('search.priceRanges.above200k')}</SelectItem>
                    </SelectContent>
                  </Select>
                </fieldset>

                {/* Area Range */}
                <fieldset className="space-y-1">
                  <label htmlFor="search-area" className={`text-xs font-semibold ${colors.text.muted} block`}>
                    {t('search.areaRange')}
                  </label>
                  <Select value={areaRange} onValueChange={setAreaRange}>
                    <SelectTrigger id="search-area" className={`w-full px-4 py-3 ${colors.bg.secondary} ${colors.text.foreground} ${quick.input} focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer`}>
                      <SelectValue placeholder={t('search.allSizes')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('search.areaRanges.all')}</SelectItem>
                      <SelectItem value="0-50">{t('search.areaRanges.up50')}</SelectItem>
                      <SelectItem value="50-100">{t('search.areaRanges.50to100')}</SelectItem>
                      <SelectItem value="100-150">{t('search.areaRanges.100to150')}</SelectItem>
                      <SelectItem value="150+">{t('search.areaRanges.above150')}</SelectItem>
                    </SelectContent>
                  </Select>
                </fieldset>
              </fieldset>

              <button
                type="submit"
                className={`w-full mt-6 px-6 py-3 ${GRADIENT_HOVER_EFFECTS.PRIMARY_BUTTON} flex items-center justify-center gap-2 ${TRANSITION_PRESETS.STANDARD_ALL}`}
              >
                <Search className={iconSizes.md} />
                {t('search.searchButton')}
              </button>
            </form>

            {/* Quick Search Links */}
            <nav className="flex flex-wrap justify-center gap-3 mt-6" role="navigation" aria-label={t('quickLinks.ariaLabel')}>
              <Link href="/properties?type=Στούντιο" className={`px-4 py-2 ${colors.bg.primary}/80 backdrop-blur text-sm font-medium ${colors.text.muted} rounded-full ${INTERACTIVE_PATTERNS.BUTTON_SUBTLE}`}>
                {t('quickLinks.studio')}
              </Link>
              <Link href="/properties?type=Διαμέρισμα" className={`px-4 py-2 ${colors.bg.primary}/80 backdrop-blur text-sm font-medium ${colors.text.muted} rounded-full ${INTERACTIVE_PATTERNS.BUTTON_SUBTLE}`}>
                {t('quickLinks.twoBedroom')}
              </Link>
              <Link href="/properties?type=Μεζονέτα" className={`px-4 py-2 ${colors.bg.primary}/80 backdrop-blur text-sm font-medium ${colors.text.muted} rounded-full ${INTERACTIVE_PATTERNS.BUTTON_SUBTLE}`}>
                {t('quickLinks.maisonettes')}
              </Link>
              <Link href="/properties?view=floorplan" className={`px-4 py-2 ${colors.bg.primary}/80 backdrop-blur text-sm font-medium ${colors.text.info} rounded-full flex items-center gap-1 ${INTERACTIVE_PATTERNS.BUTTON_SUBTLE}`}>
                <MapPin className={iconSizes.sm} />
                {t('quickLinks.viewFloorplan')}
              </Link>
            </nav>
          </section>
        </div>
      </section>

      {/* Stats Section */}
      <section className={`py-16 ${colors.bg.primary}`} role="region" aria-label={t('stats.ariaLabel')}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8" role="list">
            <article className="text-center" role="listitem">
              <data value="5" className={`text-3xl font-bold ${colors.text.info} mb-2`}>5+</data>
              <p className={colors.text.muted}>{t('stats.availableProperties')}</p>
            </article>
            <article className="text-center" role="listitem">
              <data value="3" className={`text-3xl font-bold ${colors.text.accent} mb-2`}>3</data>
              <p className={colors.text.muted}>{t('stats.premiumLocations')}</p>
            </article>
            <article className="text-center" role="listitem">
              <data value="100" className={`text-3xl font-bold ${colors.text.success} mb-2`}>100%</data>
              <p className={colors.text.muted}>{t('stats.qualityGuarantee')}</p>
            </article>
            <article className="text-center" role="listitem">
              <data value="24" className="text-3xl font-bold ${colors.text.warning} mb-2">24/7</data>
              <p className={colors.text.muted}>{t('stats.support')}</p>
            </article>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={`py-20 ${colors.bg.secondary}`} role="region" aria-label={t('features.ariaLabel')}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="text-center mb-12">
            <h2 className={`text-3xl font-bold ${colors.text.foreground} mb-4`}>
              {t('features.title')}
            </h2>
            <p className={`text-lg ${colors.text.muted} max-w-2xl mx-auto`}>
              {t('features.subtitle')}
            </p>
          </header>

          <ul className="grid md:grid-cols-3 gap-8">
            {FEATURE_CARDS.map((card) => (
              <li key={card.titleKey}>
                <FeatureCard
                  icon={card.icon}
                  tone={card.tone}
                  title={t(card.titleKey)}
                  description={t(card.descriptionKey)}
                />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Featured Properties Preview */}
      <section className="py-20" role="region" aria-label={t('featuredProperties.ariaLabel')}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="text-center mb-12">
            <h2 className={`text-3xl font-bold ${colors.text.foreground} mb-4`}>
              {t('featuredProperties.title')}
            </h2>
            <p className={`text-lg ${colors.text.muted}`}>
              {t('featuredProperties.subtitle')}
            </p>
          </header>

          <ul className="grid md:grid-cols-3 gap-8 mb-12">
            {SHOWCASE_PROPERTIES.map((property) => (
              <li key={property.key}>
                <PropertyShowcaseCard
                  icon={property.icon}
                  gradientClass={property.gradientClass}
                  title={t(`featuredProperties.properties.${property.key}.title`)}
                  price={property.price}
                  details={t(`featuredProperties.properties.${property.key}.details`)}
                  availableLabel={t('featuredProperties.available')}
                  rating={property.rating}
                  onSelect={() => router.push('/properties')}
                />
              </li>
            ))}
          </ul>

          <footer className="text-center">
            <Link
              href="/properties"
              className={`inline-flex items-center gap-2 px-8 py-3 ${GRADIENT_HOVER_EFFECTS.PRIMARY_BUTTON} ${TRANSITION_PRESETS.STANDARD_ALL}`}
            >
              {t('featuredProperties.viewAll')}
              <ArrowRight className={iconSizes.md} />
            </Link>
          </footer>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600" role="region" aria-label={t('cta.ariaLabel')}>
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className={`text-3xl font-bold ${colors.text.foreground} mb-4`}>
            {t('cta.title')}
          </h2>
          <p className={`text-xl ${colors.text.foreground}/90 mb-8`}>
            {t('cta.description')}
          </p>
          <nav className="flex flex-col sm:flex-row gap-4 justify-center" role="navigation" aria-label={t('cta.ariaLabel')}>
            <Link
              href="/properties"
              className={`px-8 py-3 ${colors.bg.primary} ${colors.text.info} font-semibold rounded-lg ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY}`}
            >
              {t('cta.searchProperties')}
            </Link>
            <Link
              href="/properties?view=floorplan"
              className={`px-8 py-3 bg-transparent ${getStatusBorder('default')} ${colors.text.foreground} font-semibold ${quick.card} flex items-center justify-center gap-2 ${INTERACTIVE_PATTERNS.BUTTON_OUTLINE}`}
            > {/* 🏢 ENTERPRISE: Changed 'secondary' to 'default' - secondary not available in getStatusBorder */}
              <MapPin className={iconSizes.md} />
              {t('cta.viewFloorplan')}
            </Link>
          </nav>
        </div>
      </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": process.env.NEXT_PUBLIC_COMPANY_NAME || process.env.NEXT_PUBLIC_SITE_NAME || "Real Estate Platform",
            "url": process.env.NEXT_PUBLIC_SITE_URL || `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` || "https://localhost:3000",
            "potentialAction": {
              "@type": "SearchAction",
              "target": `${process.env.NEXT_PUBLIC_SITE_URL || `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` || "https://localhost:3000"}/properties?search={query}`,
              "query-input": "required name=query"
            }
          })
        }}
      />
    </main>
  );
}
