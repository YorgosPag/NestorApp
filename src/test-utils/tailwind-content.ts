/**
 * @fileoverview **SSoT: «σαρώνει το Tailwind αυτό το αρχείο;»** — για άγκυρες κλάσεων.
 * @module test-utils/tailwind-content
 * @related `tailwind.config.ts` (`content`) · ADR-841 §7 Α21.13 · ADR-242 Βήμα 4 · ADR-910 §6.3
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ΤΡΕΙΣ ΑΓΚΥΡΕΣ, ΤΡΕΙΣ ΔΙΚΕΣ ΤΟΥΣ ΑΠΑΝΤΗΣΕΙΣ — ΜΙΑ ΤΟΥΣ ΨΕΥΔΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μετρημένο 2026-10-25: η ίδια ερώτηση απαντιόταν με **σύγκριση κειμένου** πάνω στο
 * `tailwind.config.ts` — «περιέχει το glob `'./src/x'`;» ή «απαριθμεί τη ρίζα `lib`;».
 * Η δεύτερη μορφή **κοκκίνισε ψευδώς**: το `content` σαρώνει τα `src/lib/**\/*.tsx` και
 * `src/lib/ui/**\/*.ts`, άρα η ρίζα `lib` «εμφανίζεται», ενώ το `src/lib/agency/*.ts`
 * **δεν σαρώνεται**. Το glob είναι η αλήθεια, όχι το πρώτο τμήμα του.
 *
 * 🔑 **Ρωτάμε τον ίδιο τον Tailwind**: `loadConfig` + `resolveConfig` (όπως ήδη τα
 * `results-layout-authority` / `viewer-narrow-layout`) και το `micromatch` **όπως το
 * λύνει το πακέτο `tailwindcss`** — καμία νέα εξάρτηση, καμία δεύτερη υλοποίηση glob.
 */

import { join } from 'node:path';

import { REPO_ROOT } from './read-source';

interface GlobMatcher {
  isMatch(path: string, patterns: readonly string[], options?: { readonly dot?: boolean }): boolean;
}

interface ResolvedTailwindContent {
  readonly content: { readonly files: ReadonlyArray<string | { readonly raw: string }> };
}

interface ContentGlobs {
  readonly include: readonly string[];
  readonly exclude: readonly string[];
}

let cached: ContentGlobs | null = null;

/** `./src/x/**` → `src/x/**` — σχετικά με τη ρίζα, όπως τα δίνουν οι καλούντες. */
function normalize(glob: string): string {
  return glob.replace(/^\.\//, '');
}

function contentGlobs(): ContentGlobs {
  if (cached !== null) return cached;
  /* eslint-disable @typescript-eslint/no-var-requires -- CommonJS-only εσωτερικά του Tailwind */
  const { loadConfig } = require('tailwindcss/lib/lib/load-config') as { loadConfig(path: string): object };
  const resolveConfig = require('tailwindcss/resolveConfig') as (config: object) => ResolvedTailwindContent;
  /* eslint-enable @typescript-eslint/no-var-requires */
  const files = resolveConfig(loadConfig(join(REPO_ROOT, 'tailwind.config.ts'))).content.files;
  const globs = files.filter((file): file is string => typeof file === 'string');

  cached = {
    include: globs.filter((glob) => !glob.startsWith('!')).map(normalize),
    exclude: globs.filter((glob) => glob.startsWith('!')).map((glob) => normalize(glob.slice(1))),
  };
  return cached;
}

function matcher(): GlobMatcher {
  // 🔑 Το micromatch του ΙΔΙΟΥ του Tailwind (pnpm: δεν είναι ορατό από τη ρίζα).
  const resolved = require.resolve('micromatch', { paths: [require.resolve('tailwindcss')] });
  return require(resolved) as GlobMatcher;
}

/** `true` αν το αρχείο (διαδρομή σχετική με τη ρίζα, π.χ. `src/lib/x.ts`) πέφτει στο `content` του Tailwind. */
export function isScannedByTailwind(repoRelativePath: string): boolean {
  const { include, exclude } = contentGlobs();
  const glob = matcher();
  return glob.isMatch(repoRelativePath, include, { dot: true }) && !glob.isMatch(repoRelativePath, exclude, { dot: true });
}
