/**
 * ADR-648 Στάδιο Γ — Tekton-safe content escaping (ο parser του Τέκτονα δεν αποκωδικοποιεί XML
 * entities → `&apos;`/`&amp;` = hang). Regression pin του πραγματικού bug (46.tek).
 */

import { escapeTektonText } from '../tek-content-escape';
import { buildTextRecordXml } from '../tek-xml-writer';
import type { TekText } from '../tek-types';

describe('escapeTektonText — Tekton-safe (ΚΑΝΕΝΑ XML entity)', () => {
  it("apostrophe μένει ΣΚΕΤΟ (native πρακτική· ΟΧΙ &apos;)", () => {
    expect(escapeTektonText("A'")).toBe("A'");
    expect(escapeTektonText("Β'-Γ'-Δ'")).toBe("Β'-Γ'-Δ'");
  });

  it('quote μένει ΣΚΕΤΟ (νόμιμο σε XML content· ΟΧΙ &quot;)', () => {
    expect(escapeTektonText('πλάτος "A"')).toBe('πλάτος "A"');
  });

  it("ampersand → '+' (ούτε &amp; ούτε raw & — και τα δύο κολλάνε τον Τέκτονα)", () => {
    expect(escapeTektonText('Κουζίνα & Σαλόνι')).toBe('Κουζίνα + Σαλόνι');
  });

  it("'<' → '(' και '>' → ')' (θα απαιτούσαν entity)", () => {
    expect(escapeTektonText('h<5>')).toBe('h(5)');
  });

  it('ΠΟΤΕ δεν παράγει XML entity token', () => {
    const out = escapeTektonText(`A' & B" < C > D`);
    for (const ent of ['&amp;', '&apos;', '&quot;', '&lt;', '&gt;']) {
      expect(out).not.toContain(ent);
    }
  });
});

describe('buildTextRecordXml — apostrophe content (46.tek repro)', () => {
  const base: TekText = {
    id: 1, content: "A'", hAlign: 0, vAlign: 2, ptSize: 7,
    xmatrix: { x00: 1, x01: 0, x10: 0, x11: 1, x20: 10, x21: 20 },
    colorHex: 'FFFFFF',
  };

  it("γράφει <s>A'</s> ΣΚΕΤΟ, ΟΧΙ A&apos; (που κόλλαγε τον Τέκτονα)", () => {
    const xml = buildTextRecordXml(base);
    expect(xml).toContain("<s>A'</s>");
    expect(xml).not.toContain('&apos;');
  });
});
