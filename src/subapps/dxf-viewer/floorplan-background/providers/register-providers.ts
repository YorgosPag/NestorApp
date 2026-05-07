import { providerRegistry } from './provider-registry';
import { ImageProvider } from './ImageProvider';
import { PdfPageProvider } from './PdfPageProvider';

let _registered = false;

export function registerProviders(): void {
  if (_registered) return;
  _registered = true;
  providerRegistry.register('image', () => new ImageProvider());
  providerRegistry.register('pdf-page', () => new PdfPageProvider());
}
