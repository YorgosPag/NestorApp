import type { IFloorplanBackgroundProvider } from './IFloorplanBackgroundProvider';

type ProviderFactory = () => IFloorplanBackgroundProvider;

class FloorplanBackgroundProviderRegistry {
  private readonly factories = new Map<string, ProviderFactory>();

  register(id: string, factory: ProviderFactory): void {
    if (this.factories.has(id)) {
      throw new Error(`FloorplanBackgroundProvider '${id}' already registered`);
    }
    this.factories.set(id, factory);
  }

  get(id: string): IFloorplanBackgroundProvider {
    const factory = this.factories.get(id);
    if (!factory) {
      throw new Error(`FloorplanBackgroundProvider '${id}' not found. Registered: [${[...this.factories.keys()].join(', ')}]`);
    }
    return factory();
  }

  has(id: string): boolean {
    return this.factories.has(id);
  }

  registeredIds(): ReadonlyArray<string> {
    return [...this.factories.keys()];
  }
}

export const providerRegistry = new FloorplanBackgroundProviderRegistry();

export function registerProvider(id: string, factory: ProviderFactory): void {
  providerRegistry.register(id, factory);
}

export function getProvider(id: string): IFloorplanBackgroundProvider {
  return providerRegistry.get(id);
}
