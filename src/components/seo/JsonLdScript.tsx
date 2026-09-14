/**
 * @fileoverview **Το `<script type="application/ld+json">`** — γραμμένο μία φορά (ADR-841 §7 Α21.17).
 * @related lib/seo/json-ld.ts (η σειριοποίηση και το γιατί της διαφυγής)
 * @module components/seo/JsonLdScript
 *
 * ⚠️ **Χωρίς `'use client'`, επίτηδες**: τα δομημένα δεδομένα πρέπει να βρίσκονται στο HTML που στέλνει
 * ο **διακομιστής** — πολλοί ανιχνευτές δεν εκτελούν JavaScript καθόλου. Το component εισάγεται και από
 * client components (δεν έχει κατάσταση ούτε αγκίστρους), αλλά η θέση του είναι το server δέντρο.
 *
 * 🔑 Το `dangerouslySetInnerHTML` είναι **ο μόνος** τρόπος να μπει κείμενο σε `<script>` χωρίς το React να
 * το διαφύγει ως HTML (που θα χάλαγε το JSON). Η ασφάλεια ζει στο {@link serializeJsonLd} — γι' αυτό
 * το component **δεν δέχεται συμβολοσειρά**, μόνο τιμή.
 */

import React from 'react';

import { serializeJsonLd, type JsonLdValue } from '@/lib/seo/json-ld';

export function JsonLdScript({ data }: { readonly data: JsonLdValue }): React.ReactElement {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
