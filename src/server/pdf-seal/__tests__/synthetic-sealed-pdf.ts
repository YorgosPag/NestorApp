/**
 * ADR-902 · ADR-918 — **Συνθετικό σφραγισμένο PDF** για τα tests του ελεγκτή σφραγίδας.
 *
 * 🔑 **Καταναλώνει τον παραγωγό** (`assemblePadesSeal`, ADR-918) — δεν χτίζει δικό του CMS. Μέχρι τις 21/10 εδώ
 * ζούσε μια **δεύτερη** κατασκευή `SignedData` (με `signingTime`, χωρίς χρονοσήμανση): ο ελεγκτής δοκιμαζόταν
 * απέναντι σε κάτι που **κανένας** παραγωγός δεν έφτιαχνε. Πλέον δοκιμάζεται απέναντι σε ό,τι στέλνουμε.
 * Το `assemblePadesSeal` (χωρίς αυτοέλεγχο) χρειάζεται επειδή ο ελεγκτής πρέπει να δει και **άκυρες** σφραγίδες
 * (π.χ. πιστοποιητικό εκτός ισχύος) — το `sealPdf` θα τις αρνιόταν πριν φτάσουν εδώ.
 *
 * Παράγεται μέσα στο test (κλειδί, πιστοποιητικό, PDF, TSA) — κανένα πραγματικό έγγραφο, κανένα δυαδικό fixture.
 */
import { PDFDocument, StandardFonts } from 'pdf-lib';

import { rfc3161TimestampAuthority } from '../rfc3161-timestamp.server';
import { assemblePadesSeal } from '../seal-pdf.server';
import { directSealSigner, makeSigner, syntheticProvider, TSA_URL, type SyntheticSigner } from './synthetic-seal-provider';

export { makeSigner, type SyntheticSigner };

export const SYNTHETIC_TEXT = 'SYNTHETIC PKA KAEK 050681726003/0/1';
const DAY = 86_400_000;

/** Ένα απλό, ασφράγιστο PDF μίας σελίδας. */
export async function unsignedSyntheticPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const page = doc.addPage([595, 842]);
  page.drawText(SYNTHETIC_TEXT, { x: 50, y: 780, size: 12, font: await doc.embedFont(StandardFonts.Helvetica) });
  return doc.save({ useObjectStreams: false });
}

let tsaSigner: Promise<SyntheticSigner> | null = null;

/** Σφραγίζει το συνθετικό PDF (PAdES B-T) με χρονοσήμανση `signingTime` από συνθετική TSA. */
export async function makeSealedPdf(signer: SyntheticSigner, signingTime: Date): Promise<Uint8Array> {
  tsaSigner ??= makeSigner('SYNTHETIC-TSA', new Date(signingTime.getTime() - 3650 * DAY), new Date(signingTime.getTime() + 3650 * DAY), 'SYNTHETIC TSA');
  const provider = syntheticProvider(signer, await tsaSigner, { tsa: { genTime: signingTime } });
  const outcome = await assemblePadesSeal(
    await unsignedSyntheticPdf(),
    { reason: 'synthetic', location: 'test' },
    {
      signer: directSealSigner(signer),
      timestampAuthority: rfc3161TimestampAuthority({ url: TSA_URL, basicAuth: null }, provider.transport),
      now: () => signingTime,
    },
  );
  if (outcome.kind !== 'assembled') throw new Error(`συνθετικό: ${outcome.reason} — ${outcome.detail}`);
  return outcome.pdf;
}
