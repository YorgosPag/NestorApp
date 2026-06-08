/**
 * ADR-423 / ADR-424 — Stage 0 Recognition Registry (SSoT wiring).
 *
 * The "big-player" pattern: every discipline/framework REGISTERS its recognizers
 * (+ optional space classifier) here, and the engine consumes the assembled set —
 * so adding a discipline (drainage, electrical, structural-424) is a registration,
 * NOT an edit to the engine. One registry owns the plug-in set; the kernel stays
 * agnostic (it never imports a concrete recognizer).
 *
 * A single app-wide `recognitionRegistry` is the SSoT instance; tests construct
 * their own `RecognitionRegistry` for isolation.
 *
 * @see ./recognizers/mep-recognition.ts (registerMepRecognition)
 */

import type { Recognizer } from './recognition-types';
import type { SpaceClassifier } from './space-classification';

/** One framework/discipline's recognition contribution. */
export interface RecognitionRegistration {
  /** Stable id (e.g. `'mep-sanitary'`) — re-registering replaces in place. */
  readonly id: string;
  readonly recognizers: readonly Recognizer[];
  /** Optional space classifier this discipline contributes. */
  readonly classifier?: SpaceClassifier;
}

/** Mutable registry of recognition contributions (insertion-ordered). */
export class RecognitionRegistry {
  private readonly registrations = new Map<string, RecognitionRegistration>();

  /** Register (or replace by id) a contribution. */
  register(registration: RecognitionRegistration): void {
    this.registrations.set(registration.id, registration);
  }

  /** Remove a contribution by id. Returns true if one existed. */
  unregister(id: string): boolean {
    return this.registrations.delete(id);
  }

  /** True if a contribution with this id is registered. */
  has(id: string): boolean {
    return this.registrations.has(id);
  }

  /** Flattened recognizers across all registrations. */
  recognizers(): readonly Recognizer[] {
    const out: Recognizer[] = [];
    for (const r of this.registrations.values()) out.push(...r.recognizers);
    return out;
  }

  /** Classifiers contributed across all registrations. */
  classifiers(): readonly SpaceClassifier[] {
    const out: SpaceClassifier[] = [];
    for (const r of this.registrations.values()) {
      if (r.classifier) out.push(r.classifier);
    }
    return out;
  }

  /** Clear all registrations (test teardown). */
  clear(): void {
    this.registrations.clear();
  }
}

/** App-wide SSoT registry instance. */
export const recognitionRegistry = new RecognitionRegistry();
