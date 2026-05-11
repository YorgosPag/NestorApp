/**
 * Ambient module declaration for `nspell` (MIT). The upstream package ships
 * without TypeScript types; we declare the surface area we actually use so
 * the worker can import it without `any`.
 *
 * Reference: https://github.com/wooorm/nspell
 */
declare module 'nspell' {
  export interface NSpell {
    /** Returns `true` if `word` is recognised by the dictionary. */
    correct(word: string): boolean;
    /** Suggests corrections for a (mis-)spelled word, ranked by likelihood. */
    suggest(word: string): string[];
    /** Adds `word` to the in-memory personal dictionary. */
    add(word: string): NSpell;
    /** Removes `word` from the in-memory personal dictionary. */
    remove(word: string): NSpell;
    /** Returns the canonical form of a word (e.g. Greek tonos folding). */
    spell(word: string): { correct: boolean; forbidden: boolean; warn: boolean };
    /** Hunspell-style word-form lookup. */
    wordCharacters(): string | undefined;
    /** Merge an additional dictionary into the running instance. */
    dictionary(dic: Buffer | string): NSpell;
    /** Merge an additional personal dictionary into the running instance. */
    personal(personal: Buffer | string): NSpell;
  }

  type DictionaryArg =
    | Buffer
    | string
    | { aff: Buffer | string; dic: Buffer | string };

  function nspell(aff: DictionaryArg, dic?: Buffer | string): NSpell;
  export default nspell;
}
