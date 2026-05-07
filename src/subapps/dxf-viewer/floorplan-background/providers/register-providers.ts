import { providerRegistry } from './provider-registry';
import { ImageProvider } from './ImageProvider';

let _registered = false;

export function registerProviders(): void {
  if (_registered) return;
  _registered = true;
  providerRegistry.register('image', () => new ImageProvider());
  // Phase 4: providerRegistry.register('pdf-page', () => new PdfPageProvider());
}
