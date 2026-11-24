'use client';

import { useCallback, useState } from 'react';

import { CompanyBrandLogoSection } from './brand/CompanyBrandLogoSection';
import { SelfContactSection } from './self-contact/SelfContactSection';

/**
 * Καρτέλα «Στοιχεία» της εταιρείας — η ταυτότητα του χώρου: **ποια επαφή είναι ο χώρος** (ADR-951) και το
 * **λογότυπο** (ADR-ACC-018 §17).
 *
 * 🔑 Η σύνδεση με «χρήση της εικόνας της επαφής» αλλάζει το λογότυπο στον server ⇒ η ενότητα λογοτύπου ξαναστήνεται
 *    (`key`) και ξαναδιαβάζει — μία πηγή, καμία τοπική αντιγραφή ανάμεσα στις δύο ενότητες.
 */
export function CompanyInfoTab() {
  const [logoRevision, setLogoRevision] = useState(0);
  const onBrandLogoChanged = useCallback(() => setLogoRevision((value) => value + 1), []);
  return (
    <>
      <SelfContactSection onBrandLogoChanged={onBrandLogoChanged} />
      <CompanyBrandLogoSection key={logoRevision} />
    </>
  );
}
