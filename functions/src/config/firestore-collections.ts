/**
 * =============================================================================
 * CLOUD FUNCTIONS: Firestore Collection Names
 * =============================================================================
 *
 * The names are PROJECTED from the app SSoT `src/config/firestore-collections.ts`
 * (ADR-874, CHECK 3.93) — never typed here. The projection is computed, not
 * listed: it carries every `COLLECTIONS.<KEY>` that any file under
 * `functions/src` reads, with the SSoT's value. Using a new key here is enough;
 * run `npm run generate:functions-projection` and the gate stays green.
 *
 * Before ADR-874 this file was a hand-kept copy of 24 names with the rule
 * "ensure it matches the main app" — a rule no gate asked.
 *
 * @module functions/config/firestore-collections
 */

export { COLLECTIONS } from '../generated/config/firestore-collections';
