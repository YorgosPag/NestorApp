/**
 * ADR-344 Phase 8 — Main-thread façade for the spell-check Web Worker.
 *
 * Responsibilities:
 *   - lazily spawn `spell.worker.ts` on first call
 *   - hand-rolled promise-based RPC over `postMessage` (requestId / response)
 *   - hydrate per-company custom dictionary on init
 *   - re-hydrate after `addCustomWord` / `removeCustomWord` so the TipTap
 *     decoration extension picks up changes without rebuilding the worker
 *
 * **SSoT module entry** — `.ssot-registry.json` module `text-spell` blocks
 * direct `nspell` imports outside this directory. Any new caller goes
 * through `getSpellChecker()`.
 *
 * @module text-engine/spell/spell-checker
 */

import { createModuleLogger } from '@/lib/telemetry';
import type {
  CustomTermPayload,
  MisspelledRange,
  SpellLanguage,
  SpellWorkerRequest,
  SpellWorkerResponse,
} from './spell.types';

const logger = createModuleLogger('SpellChecker');

let nextRequestId = 1;
function makeRequestId(): string {
  return `spell-${Date.now()}-${nextRequestId++}`;
}

interface PendingResolver {
  readonly resolve: (response: SpellWorkerResponse) => void;
  readonly reject: (reason: unknown) => void;
}

export interface SpellCheckerOptions {
  readonly languages: readonly SpellLanguage[];
  readonly initialCustomTerms: readonly CustomTermPayload[];
}

export interface SpellChecker {
  /** Run spell check over a flat text block. */
  checkText(text: string): Promise<readonly MisspelledRange[]>;
  /** Top-N suggestions for a single mis-spelled word. */
  suggest(word: string, language: SpellLanguage, limit?: number): Promise<readonly string[]>;
  /** Push a new custom term into the worker (call after the API POST resolves). */
  addCustomWord(term: CustomTermPayload): Promise<void>;
  /** Drop a custom term from the worker. */
  removeCustomWord(term: CustomTermPayload): Promise<void>;
  /** Replace the entire custom dictionary in one round trip. */
  hydrateCustomDictionary(terms: readonly CustomTermPayload[]): Promise<void>;
  /** Tear down the worker. The next call will lazy-spawn a fresh one. */
  dispose(): void;
}

class WorkerSpellChecker implements SpellChecker {
  private worker: Worker | null = null;
  private readonly pending = new Map<string, PendingResolver>();
  private readonly languages: readonly SpellLanguage[];
  private readonly initialCustomTerms: readonly CustomTermPayload[];
  private initPromise: Promise<void> | null = null;

  constructor(options: SpellCheckerOptions) {
    this.languages = options.languages;
    this.initialCustomTerms = options.initialCustomTerms;
  }

  private ensureWorker(): Worker {
    if (this.worker !== null) return this.worker;
    const worker = new Worker(new URL('./spell.worker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (event: MessageEvent<SpellWorkerResponse>) => {
      const response = event.data;
      const pending = this.pending.get(response.requestId);
      if (!pending) {
        logger.warn('Received response for unknown request', { requestId: response.requestId });
        return;
      }
      this.pending.delete(response.requestId);
      if (response.type === 'error') {
        pending.reject(new Error(response.message));
      } else {
        pending.resolve(response);
      }
    });
    worker.addEventListener('error', (event) => {
      logger.error('Spell worker crashed', { message: event.message });
      this.disposeInternal();
    });
    this.worker = worker;
    return worker;
  }

  private async send<T extends SpellWorkerResponse>(
    request: SpellWorkerRequest,
  ): Promise<T> {
    const worker = this.ensureWorker();
    await this.ensureInit();
    return new Promise<T>((resolve, reject) => {
      this.pending.set(request.requestId, {
        resolve: (r) => resolve(r as T),
        reject,
      });
      worker.postMessage(request);
    });
  }

  private ensureInit(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    const worker = this.ensureWorker();
    this.initPromise = new Promise<void>((resolve, reject) => {
      const requestId = makeRequestId();
      this.pending.set(requestId, {
        resolve: () => resolve(),
        reject,
      });
      worker.postMessage({
        type: 'init',
        requestId,
        languages: this.languages,
        customTerms: this.initialCustomTerms,
      } satisfies SpellWorkerRequest);
    });
    return this.initPromise;
  }

  async checkText(text: string): Promise<readonly MisspelledRange[]> {
    if (text.trim() === '') return [];
    const response = await this.send<Extract<SpellWorkerResponse, { type: 'check' }>>({
      type: 'check',
      requestId: makeRequestId(),
      text,
      languages: this.languages,
    });
    return response.misspelled;
  }

  async suggest(
    word: string,
    language: SpellLanguage,
    limit = 5,
  ): Promise<readonly string[]> {
    const response = await this.send<Extract<SpellWorkerResponse, { type: 'suggest' }>>({
      type: 'suggest',
      requestId: makeRequestId(),
      word,
      language,
      limit,
    });
    return response.suggestions;
  }

  async addCustomWord(term: CustomTermPayload): Promise<void> {
    await this.send<Extract<SpellWorkerResponse, { type: 'ack' }>>({
      type: 'addWord',
      requestId: makeRequestId(),
      term,
    });
  }

  async removeCustomWord(term: CustomTermPayload): Promise<void> {
    await this.send<Extract<SpellWorkerResponse, { type: 'ack' }>>({
      type: 'removeWord',
      requestId: makeRequestId(),
      term,
    });
  }

  async hydrateCustomDictionary(terms: readonly CustomTermPayload[]): Promise<void> {
    // Tear down + re-create the worker so the init message carries the new set.
    this.disposeInternal();
    Object.assign(this as { initialCustomTerms: readonly CustomTermPayload[] }, {
      initialCustomTerms: terms,
    });
    await this.ensureInit();
  }

  dispose(): void {
    this.disposeInternal();
  }

  private disposeInternal(): void {
    if (this.worker !== null) {
      this.worker.terminate();
      this.worker = null;
    }
    for (const pending of this.pending.values()) {
      pending.reject(new Error('Spell checker disposed'));
    }
    this.pending.clear();
    this.initPromise = null;
  }
}

let singleton: WorkerSpellChecker | null = null;

/**
 * Returns the lazily-spawned process-wide spell checker. First call spins
 * up the Web Worker + hydrates the per-company custom dictionary. Subsequent
 * calls return the same instance.
 *
 * If `options` differs from the cached options (e.g. company changed), call
 * `dispose()` first.
 */
export function getSpellChecker(options: SpellCheckerOptions): SpellChecker {
  if (singleton === null) {
    singleton = new WorkerSpellChecker(options);
  }
  return singleton;
}

/**
 * Tear down the singleton — used on logout / tenant switch. The next
 * `getSpellChecker()` call lazy-spawns a fresh worker with the new options.
 */
export function disposeSpellChecker(): void {
  if (singleton !== null) {
    singleton.dispose();
    singleton = null;
  }
}
