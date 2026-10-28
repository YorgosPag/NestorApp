/**
 * ADR-923 §5.11 «3γ» Α10 — ΕΝΑΣ μορφοποιητής ετικέτας μονάδας για UI και PDF/email.
 */

import { formatUom } from '../uom-label';
import { uomLabelIn } from '../uom-label-bundle';

const echo = (key: string) => `<${key}>`;

describe('formatUom', () => {
  it('παλιά γραφή ⇒ κλειδί του κανονικού κωδικού (σύμβολο προεπιλογή)', () => {
    expect(formatUom('τεμ', echo)).toBe('<symbol.pcs>');
    expect(formatUom('m²', echo, 'name')).toBe('<name.m2>');
  });

  it('άγνωστη μονάδα ⇒ αυτούσια (ορατή, όχι κενό)', () => {
    expect(formatUom('  σημεία ', echo)).toBe('σημεία');
  });

  it('απούσα ⇒ κενό', () => {
    expect(formatUom(null, echo)).toBe('');
    expect(formatUom(undefined, echo)).toBe('');
  });
});

describe('uomLabelIn — στη γλώσσα του εγγράφου', () => {
  it('ελληνικό PDF', () => {
    expect(uomLabelIn('τεμ', 'el')).toBe('τεμ.');
    expect(uomLabelIn('pcs', 'el')).toBe('τεμ.');
    expect(uomLabelIn('m2', 'el', 'name')).toBe('Τετραγωνικό μέτρο');
  });

  it('αγγλικό PDF για ελληνική αποθηκευμένη γραφή', () => {
    expect(uomLabelIn('τεμ', 'en')).toBe('pcs');
    expect(uomLabelIn('τ.μ.', 'en')).toBe('m²');
  });
});
