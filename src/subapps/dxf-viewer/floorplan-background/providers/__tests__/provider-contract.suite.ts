import type { IFloorplanBackgroundProvider } from '../IFloorplanBackgroundProvider';
import type { ProviderSource } from '../types';

export interface ProviderContractFixture {
  provider: IFloorplanBackgroundProvider;
  validSource: ProviderSource;
  expectedMimeTypes: ReadonlyArray<string>;
}

/**
 * Generic contract test suite for all IFloorplanBackgroundProvider implementations.
 * Call inside a describe block per provider.
 *
 * @example
 * describe('PdfPageProvider contract', () => {
 *   runProviderContractSuite(() => ({
 *     provider: new PdfPageProvider(),
 *     validSource: { kind: 'file', file: testPdfFile },
 *     expectedMimeTypes: ['application/pdf'],
 *   }));
 * });
 */
export function runProviderContractSuite(
  getFixture: () => ProviderContractFixture,
): void {
  let fixture: ProviderContractFixture;

  beforeEach(() => {
    fixture = getFixture();
  });

  afterEach(async () => {
    await fixture.provider.dispose();
  });

  it('exposes an immutable id string', () => {
    expect(typeof fixture.provider.id).toBe('string');
    expect(fixture.provider.id.length).toBeGreaterThan(0);
  });

  it('exposes non-empty supportedMimeTypes', () => {
    expect(fixture.provider.supportedMimeTypes.length).toBeGreaterThan(0);
    fixture.expectedMimeTypes.forEach((mime) => {
      expect(fixture.provider.supportedMimeTypes).toContain(mime);
    });
  });

  it('capabilities.calibratable is always true (Q4 ADR-340)', () => {
    expect(fixture.provider.capabilities.calibratable).toBe(true);
  });

  it('capabilities flags are booleans', () => {
    const { capabilities } = fixture.provider;
    expect(typeof capabilities.multiPage).toBe('boolean');
    expect(typeof capabilities.exifAware).toBe('boolean');
    expect(typeof capabilities.vectorEquivalent).toBe('boolean');
    expect(typeof capabilities.calibratable).toBe('boolean');
  });

  it('loadAsync returns success:true with valid source', async () => {
    const result = await fixture.provider.loadAsync(fixture.validSource);
    expect(result.success).toBe(true);
    expect(result.bounds).toBeDefined();
    expect(result.bounds!.width).toBeGreaterThan(0);
    expect(result.bounds!.height).toBeGreaterThan(0);
  });

  it('getNaturalBounds matches loadAsync bounds after load', async () => {
    const result = await fixture.provider.loadAsync(fixture.validSource);
    expect(result.success).toBe(true);
    const bounds = fixture.provider.getNaturalBounds();
    expect(bounds.width).toBe(result.bounds!.width);
    expect(bounds.height).toBe(result.bounds!.height);
  });

  it('render does not throw with identity transform and small canvas', async () => {
    await fixture.provider.loadAsync(fixture.validSource);
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    expect(ctx).not.toBeNull();
    expect(() =>
      fixture.provider.render(ctx!, {
        transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        worldToCanvas: { scale: 1, offsetX: 0, offsetY: 0 },
        viewport: { width: 100, height: 100 },
        opacity: 1,
      }),
    ).not.toThrow();
  });

  it('dispose is idempotent (safe to call twice)', async () => {
    await fixture.provider.loadAsync(fixture.validSource);
    await expect(fixture.provider.dispose()).resolves.not.toThrow();
    await expect(fixture.provider.dispose()).resolves.not.toThrow();
  });

  it('loadAsync with invalid source returns success:false', async () => {
    const badSource: ProviderSource = { kind: 'url', url: 'https://invalid.invalid/404.xyz' };
    const result = await fixture.provider.loadAsync(badSource);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
}
