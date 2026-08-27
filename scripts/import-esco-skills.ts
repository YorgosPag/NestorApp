/**
 * ============================================================================
 * ΕΙΣΑΓΩΓΗ ΔΕΞΙΟΤΗΤΩΝ ESCO (ADR-132)
 * ============================================================================
 *
 * Κατεβάζει **όλες** τις ESCO skills και τις γράφει στο
 * `system/esco_cache/skills`.
 *
 * Χρήση:
 *   npm run import:esco:skills
 *   npm run import:esco:skills -- --allow-partial   (εν γνώσει σου, μερικό)
 *
 * ⚠️ **ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΕΙΝΑΙ ΔΗΛΩΣΗ, ΟΧΙ ΜΗΧΑΝΗ.** Δες
 * `scripts/lib/esco/esco-import-runner.ts` — και το γιατί ήταν λάθος να είναι
 * δίδυμο του `import-esco-occupations.ts`.
 *
 * @see https://ec.europa.eu/esco/api/doc/esco_api_doc.html
 */

import { runEscoImport } from './lib/esco/esco-import-runner';
import { transformSkills } from './lib/esco/esco-skill-document';
import type { EscoSkillDocument } from '../src/types/contacts/esco-types';

const SKILLS_SCHEME = 'http://data.europa.eu/esco/concept-scheme/skills';

void runEscoImport<EscoSkillDocument>({
  title: 'Εισαγωγή δεξιοτήτων ESCO (ADR-132)',
  conceptType: 'skill',
  scheme: SKILLS_SCHEME,
  collection: 'system/esco_cache/skills',
  uriPrefix: 'http://data.europa.eu/esco/skill/',
  noun: 'δεξιότητες',
  transform: transformSkills,
  uriOf: (document) => document.uri,
}).then((exitCode) => {
  process.exitCode = exitCode;
});
