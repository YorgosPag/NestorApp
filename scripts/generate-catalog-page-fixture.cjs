#!/usr/bin/env node
/**
 * @fileoverview Το **πραγματικό** περιεχόμενο σελίδων PDF ως data fixture (ADR-923 §5.5.1), με τον κώδικα της παραγωγής και χωρίς AI:
 * κομμάτια κειμένου · ζωγραφισμένες γραμμές · πίνακες ετικετών. Το PDF δεν μπαίνει στο αποθετήριο, μόνο όσα χρειάζονται οι άγκυρες.
 *
 * Χρήση: node scripts/generate-catalog-page-fixture.cjs <αρχείο.pdf> 85,86
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { REPO, withPdfService } = require('./lib/pdf-service-probe.cjs');

const OUTPUT = path.join(REPO, 'src/subapps/catalog/__tests__/fixtures/aries-page-structure.data.json');
const FIXTURE_DPI = 36;

/**
 * 🔴 Ό,τι βγάζει η παραγωγή, με την **πλήρη** ακρίβειά του: στρογγυλοποίηση έκρυψε ότι το κούμπωμα δεν έκανε τίποτα, γιατί έκανε ίσες τις
 * σχεδόν ίσες θέσεις. Η άγκυρα περνούσε και η παραγωγή έβγαζε 26 γραμμές αντί 24 (ADR-923 §5.5.1, τρίτη δοκιμή).
 */
async function pageOf(service, bytes, page) {
  const { items, rules, tagTables } = await service.readPdfPage(bytes, page, { dpi: FIXTURE_DPI });
  return { items, rules, tagTables };
}

async function main() {
  const [file, pagesArgument] = process.argv.slice(2);
  if (!file || !pagesArgument) throw new Error('χρήση: generate-catalog-page-fixture.cjs <αρχείο.pdf> 85,86');
  const bytes = fs.readFileSync(file);
  const fixture = await withPdfService(REPO, async (service) => {
    const pages = {};
    for (const page of pagesArgument.split(',').map(Number)) pages[page] = await pageOf(service, bytes, page);
    return pages;
  });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(fixture)}\n`);
  console.log(`✅ ${path.relative(REPO, OUTPUT)}: ${Object.entries(fixture).map(([page, { items, rules }]) => `σελ. ${page} ${items.length} κομμάτια, ${rules.length} γραμμές`).join(' · ')}`);
}

main().catch((error) => {
  console.error(`❌ ${error && error.message}`);
  process.exit(1);
});
