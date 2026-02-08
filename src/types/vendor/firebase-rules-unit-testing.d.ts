declare module '@firebase/rules-unit-testing' {
  import type { Firestore } from 'firebase-admin/firestore';

  export interface RulesTestContext {
    firestore(): Firestore;
  }

  export interface RulesTestEnvironment {
    authenticatedContext(uid: string, token?: Record<string, unknown>): RulesTestContext;
    unauthenticatedContext(): RulesTestContext;
    clearFirestore(): Promise<void>;
    cleanup(): Promise<void>;
    withSecurityRulesDisabled<T>(
      callback: (context: RulesTestContext) => Promise<T> | T
    ): Promise<T>;
  }

  export function initializeTestEnvironment(options: {
    projectId: string;
    firestore?: {
      rules: string;
      host?: string;
      port?: number;
    };
  }): Promise<RulesTestEnvironment>;

  export function assertFails<T>(promise: Promise<T>): Promise<unknown>;
  export function assertSucceeds<T>(promise: Promise<T>): Promise<T>;
}
