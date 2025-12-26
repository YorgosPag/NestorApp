'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, MapPin, Home, Filter, TrendingUp, Building, ArrowRight, ChevronDown, Star, Users, Shield } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTranslation } from '@/i18n';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS, GRADIENT_HOVER_EFFECTS } from '@/components/ui/effects';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function LandingPage() {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const { t } = useTranslation('landing');
  const router = useRouter();
  const [searchType, setSearchType] = useState('all');
  const [location, setLocation] = useState('');
  const [priceRange, setPriceRange] = useState('all');
  const [areaRange, setAreaRange] = useState('all');

  // 🏢 ENTERPRISE: Configurable price ranges
  const getPriceRanges = () => {
    try {
      const envPriceRanges = process.env.NEXT_PUBLIC_PRICE_RANGES_JSON;
      if (envPriceRanges) {
        return JSON.parse(envPriceRanges);
      }
    } catch (error) {
      console.warn('Failed to parse price ranges, using defaults');
    }

    const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '€';
    return [
      { value: "", label: "Όλες οι τιμές" },
      { value: "0-50000", label: `${currency}0 - ${currency}50.000` },
      { value: "50000-100000", label: `${currency}50.000 - ${currency}100.000` },
      { value: "100000-200000", label: `${currency}100.000 - ${currency}200.000` },
      { value: "200000+", label: `${currency}200.000+` }
    ];
  };

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
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-pink-600/10 backdrop-blur-3xl" aria-hidden="true" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <header className="text-center mb-12">
            <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 dark:text-gray-100 mb-6">
              {t('hero.findIdeal')}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                {t('hero.property')}
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              {t('hero.subtitle')}
            </p>
          </header>

          {/* Search Box */}
          <section className="max-w-4xl mx-auto" aria-label="Φόρμα Αναζήτησης Ακινήτων">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
              className={`bg-white dark:bg-gray-800/50 dark:backdrop-blur-sm ${quick.card} shadow-xl p-6`}
              role="search"
              aria-label="Αναζήτηση Ακινήτων"
            >
              <fieldset className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <legend className="sr-only">Κριτήρια Αναζήτησης Ακινήτων</legend>
                {/* Property Type */}
                <fieldset className="space-y-1">
                  <label htmlFor="search-type" className="text-xs font-semibold text-gray-500 dark:text-gray-400 block">
                    {t('search.propertyType')}
                  </label>
                  <Select value={searchType} onValueChange={setSearchType}>
                    <SelectTrigger id="search-type" className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 dark:text-white ${quick.input} focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer`}>
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
                  <label htmlFor="search-location" className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">
                    {t('search.location')}
                  </label>
                  <div className="relative">
                    <MapPin className={`absolute left-3 top-3.5 ${iconSizes.md} text-gray-400`} />
                    <input
                      id="search-location"
                      aria-label={t('search.location')}
                      inputMode="search"
                      type="text"
                      placeholder={t('search.locationPlaceholder')}
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className={`w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700/50 dark:text-white ${quick.input} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                  </div>
                </fieldset>

                {/* Price Range */}
                <fieldset className="space-y-1">
                  <label htmlFor="search-price" className="text-xs font-semibold text-gray-500 dark:text-gray-400 block">
                    Εύρος Τιμής
                  </label>
                  <Select value={priceRange} onValueChange={setPriceRange}>
                    <SelectTrigger id="search-price" className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 dark:text-white ${quick.input} focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer`}>
                      <SelectValue placeholder="Όλες οι τιμές" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Όλες οι τιμές</SelectItem>
                      <SelectItem value="0-50000">€0 - €50.000</SelectItem>
                      <SelectItem value="50000-100000">€50.000 - €100.000</SelectItem>
                      <SelectItem value="100000-200000">€100.000 - €200.000</SelectItem>
                      <SelectItem value="200000+">€200.000+</SelectItem>
                    </SelectContent>
                  </Select>
                </fieldset>

                {/* Area Range */}
                <fieldset className="space-y-1">
                  <label htmlFor="search-area" className="text-xs font-semibold text-gray-500 dark:text-gray-400 block">
                    Εμβαδόν
                  </label>
                  <Select value={areaRange} onValueChange={setAreaRange}>
                    <SelectTrigger id="search-area" className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 dark:text-white ${quick.input} focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer`}>
                      <SelectValue placeholder="Όλα τα μεγέθη" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Όλα τα μεγέθη</SelectItem>
                      <SelectItem value="0-50">0-50 m²</SelectItem>
                      <SelectItem value="50-100">50-100 m²</SelectItem>
                      <SelectItem value="100-150">100-150 m²</SelectItem>
                      <SelectItem value="150+">150+ m²</SelectItem>
                    </SelectContent>
                  </Select>
                </fieldset>
              </fieldset>

              <button 
                type="submit"
                className={`w-full mt-6 px-6 py-3 ${GRADIENT_HOVER_EFFECTS.PRIMARY_BUTTON} flex items-center justify-center gap-2 ${TRANSITION_PRESETS.STANDARD_ALL}`}
              >
                <Search className={iconSizes.md} />
                Αναζήτηση Ακινήτων
              </button>
            </form>

            {/* Quick Search Links */}
            <nav className="flex flex-wrap justify-center gap-3 mt-6" role="navigation" aria-label="Γρήγορες Συνδέσεις Αναζήτησης">
              <Link href="/properties?type=Στούντιο" className={`px-4 py-2 bg-white/80 dark:bg-gray-800/50 dark:text-gray-200 backdrop-blur text-sm font-medium text-gray-700 ${quick.pill} ${INTERACTIVE_PATTERNS.BUTTON_SUBTLE}`}>
                Στούντιο
              </Link>
              <Link href="/properties?type=Διαμέρισμα" className={`px-4 py-2 bg-white/80 dark:bg-gray-800/50 dark:text-gray-200 backdrop-blur text-sm font-medium text-gray-700 ${quick.pill} ${INTERACTIVE_PATTERNS.BUTTON_SUBTLE}`}>
                2 Υπνοδωμάτια
              </Link>
              <Link href="/properties?type=Μεζονέτα" className={`px-4 py-2 bg-white/80 dark:bg-gray-800/50 dark:text-gray-200 backdrop-blur text-sm font-medium text-gray-700 ${quick.pill} ${INTERACTIVE_PATTERNS.BUTTON_SUBTLE}`}>
                Μεζονέτες
              </Link>
              <Link href="/properties?view=floorplan" className={`px-4 py-2 bg-white/80 dark:bg-gray-800/50 backdrop-blur text-sm font-medium text-blue-600 dark:text-blue-400 ${quick.pill} flex items-center gap-1 ${INTERACTIVE_PATTERNS.BUTTON_SUBTLE}`}>
                <MapPin className={iconSizes.sm} />
                Δείτε σε Κάτοψη
              </Link>
            </nav>
          </section>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white dark:bg-gray-900" role="region" aria-label="Στατιστικά Εταιρείας">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8" role="list">
            <article className="text-center" role="listitem">
              <data value="5" className="text-3xl font-bold text-blue-600 mb-2">5+</data>
              <p className="text-gray-600 dark:text-gray-300">Διαθέσιμα Ακίνητα</p>
            </article>
            <article className="text-center" role="listitem">
              <data value="3" className="text-3xl font-bold text-purple-600 mb-2">3</data>
              <p className="text-gray-600 dark:text-gray-300">Premium Τοποθεσίες</p>
            </article>
            <article className="text-center" role="listitem">
              <data value="100" className="text-3xl font-bold text-green-600 mb-2">100%</data>
              <p className="text-gray-600 dark:text-gray-300">Εγγύηση Ποιότητας</p>
            </article>
            <article className="text-center" role="listitem">
              <data value="24" className="text-3xl font-bold text-orange-600 mb-2">24/7</data>
              <p className="text-gray-600 dark:text-gray-300">Υποστήριξη</p>
            </article>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900/50" role="region" aria-label="Χαρακτηριστικά Υπηρεσιών">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Γιατί να Επιλέξετε τα Ακίνητά μας;
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Προσφέρουμε την καλύτερη εμπειρία αναζήτησης ακινήτων με σύγχρονα εργαλεία
            </p>
          </header>

          <ul className="grid md:grid-cols-3 gap-8">
            <li>
              <article className={`bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm ${INTERACTIVE_PATTERNS.CARD_STANDARD}`}>
                <figure className={`${iconSizes.xl2} bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center mb-4`}>
                  <MapPin className={`${iconSizes.lg} text-blue-600`} />
                </figure>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Διαδραστική Κάτοψη
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Εξερευνήστε τα ακίνητα σε διαδραστική κάτοψη ορόφου και δείτε τη θέση τους
              </p>
              </article>
            </li>

            <li>
              <article className={`bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm ${INTERACTIVE_PATTERNS.CARD_STANDARD}`}>
                <figure className={`${iconSizes.xl2} bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center mb-4`}>
                  <Shield className={`${iconSizes.lg} text-purple-600`} />
                </figure>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Εγγυημένη Ποιότητα
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Όλα τα ακίνητα είναι ελεγμένα και πληρούν τις υψηλότερες προδιαγραφές
              </p>
              </article>
            </li>

            <li>
              <article className={`bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm ${INTERACTIVE_PATTERNS.CARD_STANDARD}`}>
                <figure className={`${iconSizes.xl2} bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center mb-4`}>
                  <Users className={`${iconSizes.lg} text-green-600`} />
                </figure>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Προσωπική Εξυπηρέτηση
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Η ομάδα μας είναι εδώ για να σας βοηθήσει σε κάθε βήμα της διαδικασίας
              </p>
              </article>
            </li>
          </ul>
        </div>
      </section>

      {/* Featured Properties Preview */}
      <section className="py-20" role="region" aria-label="Προτεινόμενα Ακίνητα">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Προτεινόμενα Ακίνητα
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Δείτε μερικά από τα πιο δημοφιλή ακίνητά μας
            </p>
          </header>

          <ul className="grid md:grid-cols-3 gap-8 mb-12">
            {/* Property Card 1 */}
            <li>
              <article className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden cursor-pointer ${INTERACTIVE_PATTERNS.CARD_ENHANCED}`} onClick={() => router.push('/properties')}>
              <figure className="h-48 bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                <Home className={`${iconSizes.huge} text-white`} aria-hidden="true" />
              </figure>
              <div className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Στούντιο B1</h3>
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 text-xs font-semibold rounded-full">
                    Διαθέσιμο
                  </span>
                </div>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2">€65.000</p>
                <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">35 m² • 1ος όροφος</p>
                <div className="flex items-center gap-1">
                  <Star className={`${iconSizes.sm} text-yellow-500 fill-current`} />
                  <Star className={`${iconSizes.sm} text-yellow-500 fill-current`} />
                  <Star className={`${iconSizes.sm} text-yellow-500 fill-current`} />
                  <Star className={`${iconSizes.sm} text-yellow-500 fill-current`} />
                  <Star className={`${iconSizes.sm} text-gray-300 dark:text-gray-600`} />
                  <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">4.0</span>
                </div>
              </div>
              </article>
            </li>

            {/* Property Card 2 */}
            <li>
              <article className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden cursor-pointer ${INTERACTIVE_PATTERNS.CARD_ENHANCED}`} onClick={() => router.push('/properties')}>
                <figure className="h-48 bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                  <Building className={`${iconSizes.huge} text-white`} aria-hidden="true" />
                </figure>
              <div className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Διαμέρισμα 2Δ</h3>
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 text-xs font-semibold rounded-full">
                    Διαθέσιμο
                  </span>
                </div>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2">€145.000</p>
                <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">75 m² • 2 υπνοδωμάτια</p>
                <div className="flex items-center gap-1">
                  <Star className={`${iconSizes.sm} text-yellow-500 fill-current`} />
                  <Star className={`${iconSizes.sm} text-yellow-500 fill-current`} />
                  <Star className={`${iconSizes.sm} text-yellow-500 fill-current`} />
                  <Star className={`${iconSizes.sm} text-yellow-500 fill-current`} />
                  <Star className={`${iconSizes.sm} text-yellow-500 fill-current`} />
                  <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">5.0</span>
                </div>
              </div>
              </article>
            </li>

            {/* Property Card 3 */}
            <li>
              <article className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden cursor-pointer ${INTERACTIVE_PATTERNS.CARD_ENHANCED}`} onClick={() => router.push('/properties')}>
                <figure className="h-48 bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                  <TrendingUp className={`${iconSizes.huge} text-white`} aria-hidden="true" />
                </figure>
              <div className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Μεζονέτα E1</h3>
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 text-xs font-semibold rounded-full">
                    Διαθέσιμο
                  </span>
                </div>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2">€280.000</p>
                <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">145 m² • 3 υπνοδωμάτια</p>
                <div className="flex items-center gap-1">
                  <Star className={`${iconSizes.sm} text-yellow-500 fill-current`} />
                  <Star className={`${iconSizes.sm} text-yellow-500 fill-current`} />
                  <Star className={`${iconSizes.sm} text-yellow-500 fill-current`} />
                  <Star className={`${iconSizes.sm} text-yellow-500 fill-current`} />
                  <Star className={`${iconSizes.sm} text-gray-300 dark:text-gray-600`} />
                  <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">4.5</span>
                </div>
              </div>
              </article>
            </li>
          </ul>

          <footer className="text-center">
            <Link
              href="/properties"
              className={`inline-flex items-center gap-2 px-8 py-3 ${GRADIENT_HOVER_EFFECTS.PRIMARY_BUTTON} ${TRANSITION_PRESETS.STANDARD_ALL}`}
            >
              Δείτε Όλα τα Ακίνητα
              <ArrowRight className={iconSizes.md} />
            </Link>
          </footer>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600" role="region" aria-label="Κλήση προς Δράση">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white mb-4">
            Έτοιμοι να Βρείτε το Νέο σας Σπίτι;
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Εξερευνήστε τη συλλογή μας με διαθέσιμα ακίνητα σε διαδραστική κάτοψη
          </p>
          <nav className="flex flex-col sm:flex-row gap-4 justify-center" role="navigation" aria-label="Κύριες Ενέργειες">
            <Link 
              href="/properties"
              className={`px-8 py-3 bg-white text-blue-600 font-semibold rounded-lg ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY}`}
            >
              Αναζήτηση Ακινήτων
            </Link>
            <Link 
              href="/properties?view=floorplan"
              className={`px-8 py-3 bg-transparent ${getStatusBorder('secondary')} text-white font-semibold ${quick.card} flex items-center justify-center gap-2 ${INTERACTIVE_PATTERNS.BUTTON_OUTLINE}`}
            >
              <MapPin className={iconSizes.md} />
              Προβολή σε Κάτοψη
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
