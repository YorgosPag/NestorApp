#!/usr/bin/env node
/**
 * ΓΕΝΝΗΤΟΡΑΣ ΤΙΜΩΝ ΑΝΑΦΟΡΑΣ ΕΝΕΡΓΕΙΑΣ (ADR-777 §8.95)
 * ===================================================
 * Γράφει το `src/lib/energy-cost/energy-reference-prices.json`: για κάθε πηγή ενέργειας που έχει **επίσημη** σειρά
 * τιμών καταναλωτή στην Ελλάδα, τα τελευταία εξάμηνα σε €/kWh **με όλους τους φόρους**.
 *
 * ΠΗΓΕΣ — καμία τιμή χωρίς περίοδο και προέλευση:
 *   • ηλεκτρική     Eurostat `nrg_pc_204`, οικιακοί, ζώνη DC (2.500–4.999 kWh), I_TAX, EUR/kWh
 *   • φυσικό αέριο  Eurostat `nrg_pc_202`, οικιακοί, ζώνη D2 (20–199 GJ),      I_TAX, EUR/kWh
 *   • πετρέλαιο     Weekly Oil Bulletin της Ευρ. Επιτροπής, «Prices with taxes», στήλη θέρμανσης της Ελλάδας
 *                   (€/1000 L) → μέσος όρος ανά εξάμηνο → €/kWh με την κατώτερη θερμογόνο ικανότητα της
 *                   ΤΟΤΕΕ 20701-4/2017, Πίνακας 3η (11,858 kWh/kg × 0,850 kg/L).
 *
 * ΧΡΗΣΗ:  npm run energy-prices:refresh        (δύο φορές τον χρόνο, όταν η Eurostat δημοσιεύει εξάμηνο)
 *
 * ⚠️ Το πετρέλαιο θέρμανσης διατίθεται στην Ελλάδα μόνο 15/10–30/4: τα εξάμηνα έχουν λίγες εβδομάδες. Εξάμηνο με
 *    λιγότερες από MIN_OIL_WEEKS εβδομάδες **δεν** γίνεται τιμή — μία εβδομάδα δεν είναι «τιμή εξαμήνου».
 * ⚠️ Το **τρέχον** εξάμηνο δεν γράφεται ποτέ για το πετρέλαιο: είναι ατελές, και θα άλλαζε σε κάθε εκτέλεση.
 * ⚠️ Αν μια πηγή δεν απαντήσει, ο γεννήτορας **σταματά** χωρίς να γράψει: μισός πίνακας θα έσβηνε σιωπηλά τις
 *    εκτιμήσεις για ένα καύσιμο.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const OUTPUT = path.resolve(__dirname, '..', 'src', 'lib', 'energy-cost', 'energy-reference-prices.json');

/** Πόσα εξάμηνα κρατά ο πίνακας — το παράθυρο από το οποίο βγαίνει το εύρος της εκτίμησης (δύο έτη). */
const WINDOW_SEMESTERS = 4;
const MIN_OIL_WEEKS = 4;

const EUROSTAT_API = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data';
const EUROSTAT_SERIES = {
  electricity: { dataset: 'nrg_pc_204', band: 'KWH2500-4999' },
  'natural-gas': { dataset: 'nrg_pc_202', band: 'GJ20-199' },
};

const OIL_BULLETIN_PAGE = 'https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en';
const OIL_SHEET = 'Prices with taxes';
const OIL_COLUMN = /^(GR|EL)_price_with_tax_heating_oil$/;
/** ΤΟΤΕΕ 20701-4/2017, Πίνακας 3η: κατώτερη θερμογόνος ικανότητα 11,858 kWh/kg, πυκνότητα 850 kg/m³ (ΕΛΟΤ ΕΝ 304). */
const OIL_KWH_PER_KG = 11.858;
const OIL_KG_PER_LITRE = 0.85;
const OIL_KWH_PER_LITRE = Math.round(OIL_KWH_PER_KG * OIL_KG_PER_LITRE * 1000) / 1000;

function round4(value) {
  return Math.round(value * 10000) / 10000;
}

function eurostatUrl({ dataset, band }) {
  const query = `format=JSON&lang=EN&geo=EL&nrg_cons=${band}&tax=I_TAX&currency=EUR&unit=KWH&lastTimePeriod=${WINDOW_SEMESTERS}`;
  return `${EUROSTAT_API}/${dataset}?${query}`;
}

/**
 * JSON-stat της Eurostat → `[{ period, eurPerKwh }]`, παλαιότερο πρώτο. Κάθε άλλη διάσταση έχει μία τιμή (το ζητά
 * το ερώτημα), άρα η θέση στο `value` **είναι** η θέση του εξαμήνου.
 */
function semesterPricesFromJsonStat(json) {
  const index = json && json.dimension && json.dimension.time && json.dimension.time.category.index;
  if (!index || !json.value) throw new Error('Eurostat: απάντηση χωρίς διάσταση χρόνου ή τιμές');
  const periods = Object.entries(index)
    .map(([period, position]) => ({ period, raw: json.value[String(position)] }))
    .filter((entry) => typeof entry.raw === 'number' && entry.raw > 0)
    .map((entry) => ({ period: entry.period, eurPerKwh: round4(entry.raw) }));
  if (periods.length === 0) throw new Error('Eurostat: κανένα εξάμηνο με τιμή');
  return periods.sort((a, b) => a.period.localeCompare(b.period));
}

function semesterOf(date) {
  return `${date.getUTCFullYear()}-S${date.getUTCMonth() < 6 ? 1 : 2}`;
}

/**
 * Εβδομαδιαίες τιμές (€/1000 L) → μέσος όρος ανά **ολοκληρωμένο** εξάμηνο, σε €/kWh, τα `WINDOW_SEMESTERS` νεότερα.
 * @param {ReadonlyArray<{date: Date, eurPer1000L: number}>} weeks
 * @param {Date} today
 */
function oilSemesterPrices(weeks, today) {
  const current = semesterOf(today);
  const bySemester = new Map();
  for (const { date, eurPer1000L } of weeks) {
    if (!(date instanceof Date) || !(eurPer1000L > 0)) continue;
    const semester = semesterOf(date);
    if (semester >= current) continue;
    bySemester.set(semester, [...(bySemester.get(semester) || []), eurPer1000L]);
  }
  return [...bySemester.entries()]
    .filter(([, prices]) => prices.length >= MIN_OIL_WEEKS)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-WINDOW_SEMESTERS)
    .map(([period, prices]) => {
      const meanPerLitre = prices.reduce((sum, price) => sum + price, 0) / prices.length / 1000;
      return { period, eurPerKwh: round4(meanPerLitre / OIL_KWH_PER_LITRE), weeks: prices.length };
    });
}

async function fetchOk(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
  return response;
}

async function fetchEurostat(series) {
  const json = await (await fetchOk(eurostatUrl(series))).json();
  return {
    origin: 'eurostat',
    dataset: series.dataset,
    band: series.band,
    updated: String(json.updated || '').slice(0, 10),
    periods: semesterPricesFromJsonStat(json),
  };
}

/** Ο σύνδεσμος του ιστορικού αλλάζει αναγνωριστικό σε κάθε ανάρτηση ⇒ διαβάζεται από τη σελίδα, δεν καρφώνεται. */
async function oilHistoryUrl() {
  const html = await (await fetchOk(OIL_BULLETIN_PAGE)).text();
  const match = html.match(/href="([^"]*Oil_Bulletin_Prices_History[^"]*\.xlsx)"/i);
  if (!match) throw new Error('Weekly Oil Bulletin: δεν βρέθηκε ο σύνδεσμος του ιστορικού');
  return new URL(match[1].replace(/&amp;/g, '&'), OIL_BULLETIN_PAGE).toString();
}

function numericCell(cell) {
  const value = cell && typeof cell === 'object' && 'result' in cell ? cell.result : cell;
  return typeof value === 'number' ? value : Number.NaN;
}

async function readOilWeeks(file) {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const sheet = workbook.getWorksheet(OIL_SHEET);
  if (!sheet) throw new Error(`Weekly Oil Bulletin: λείπει το φύλλο «${OIL_SHEET}»`);
  let column = 0;
  sheet.getRow(1).eachCell((cell, number) => {
    if (OIL_COLUMN.test(String(cell.value))) column = number;
  });
  if (column === 0) throw new Error('Weekly Oil Bulletin: λείπει η στήλη θέρμανσης της Ελλάδας');
  const weeks = [];
  sheet.eachRow((row) => {
    const date = row.getCell(1).value;
    if (date instanceof Date) weeks.push({ date, eurPer1000L: numericCell(row.getCell(column).value) });
  });
  return weeks;
}

async function fetchOil(today) {
  const url = await oilHistoryUrl();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oil-bulletin-'));
  const file = path.join(dir, 'history.xlsx');
  try {
    fs.writeFileSync(file, Buffer.from(await (await fetchOk(url)).arrayBuffer()));
    const periods = oilSemesterPrices(await readOilWeeks(file), today);
    if (periods.length === 0) throw new Error('Weekly Oil Bulletin: κανένα ολοκληρωμένο εξάμηνο με τιμές');
    return { origin: 'weekly-oil-bulletin', kwhPerLitre: OIL_KWH_PER_LITRE, periods };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  const today = new Date();
  const table = {
    generatedAt: today.toISOString().slice(0, 10),
    windowSemesters: WINDOW_SEMESTERS,
    sources: {
      electricity: await fetchEurostat(EUROSTAT_SERIES.electricity),
      oil: await fetchOil(today),
      'natural-gas': await fetchEurostat(EUROSTAT_SERIES['natural-gas']),
    },
  };
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(table, null, 2)}\n`);
  for (const [source, entry] of Object.entries(table.sources)) {
    const line = entry.periods.map((p) => `${p.period} ${p.eurPerKwh}`).join(' · ');
    console.log(`${source.padEnd(12)} ${line}`);
  }
  console.log(`→ ${path.relative(process.cwd(), OUTPUT)}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`❌ Οι τιμές αναφοράς ΔΕΝ γράφτηκαν: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { semesterPricesFromJsonStat, oilSemesterPrices, semesterOf, OIL_KWH_PER_LITRE, MIN_OIL_WEEKS };
