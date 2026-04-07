/**
 * Service Registry V2 - Service Initialization Logic
 *
 * Handles service initialization with retry, exponential backoff,
 * and timeout support. Extracted from ServiceRegistry.v2.ts per ADR-065.
 *
 * @module services/service-registry-initializer
 */

import type {
  ServiceName,
  ServiceFactory,
  ServiceFactoryOptions,
  ServiceMetadata,
} from './service-registry-types';

/**
 * Initialize a service with retry logic, exponential backoff, and timeout
 */
export async function initializeServiceInstance(
  name: ServiceName,
  factory: ServiceFactory,
  options: ServiceFactoryOptions,
  services: Map<ServiceName, unknown>,
  metadata: Map<ServiceName, ServiceMetadata>,
  weakRefs: Map<ServiceName, WeakRef<object>>
): Promise<unknown> {
  const { retries = 0, backoffMs = 100, timeout = 5000 } = options;
  const startTime = performance.now();

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error(`Service initialization timeout (${timeout}ms)`)),
          timeout
        );
      });

      const initPromise = Promise.resolve(factory());
      const service = await Promise.race([initPromise, timeoutPromise]);

      // Success — store service instance
      services.set(name, service);

      const meta = metadata.get(name);
      if (meta) {
        meta.initialized = true;
        meta.instanceCount++;
        meta.initializationTime = performance.now() - startTime;
        meta.lastAccessed = performance.now();
      }

      // Memory leak detection via WeakRef
      if (service && typeof service === 'object') {
        weakRefs.set(name, new WeakRef(service as object));
      }

      return service;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < retries) {
        const delay = backoffMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error(`Service "${name}" initialization failed`);
}
