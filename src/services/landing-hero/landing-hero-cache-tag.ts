/**
 * @fileoverview **Το tag της μνήμης των ηρώων** — γραμμένο μία φορά (ADR-881 §4.3).
 * @module services/landing-hero/landing-hero-cache-tag
 *
 * 🔑 Ξεχωριστό από τον αναγνώστη ώστε η δημοσίευση να το εισάγει **χωρίς** να φέρει μαζί το
 *    `unstable_cache` και τον ενσωματωμένο πίνακα — ο αναγνώστης το δηλώνει, η δημοσίευση το ακυρώνει.
 */
export const LANDING_HEROES_CACHE_TAG = 'landing-heroes';
