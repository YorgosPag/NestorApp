/**
 * @fileoverview **ΟΙ ΓΡΗΓΟΡΕΣ ΕΙΔΙΚΟΤΗΤΕΣ ΤΟΥ `/pro`** — δεδομένα, ποτέ λογική.
 * @related ADR-896 §8 · lib/agency/occupation-query.ts (ο κριτής) ·
 *   components/mandate/OccupationQuickFilters.tsx (τα τσιπ) · config/profession-bridge.config.ts
 * @module config/occupation-families
 *
 * 🔑 **ΟΙΚΟΓΕΝΕΙΑ = ΕΠΙΜΕΛΗΜΕΝΟ ΣΥΝΟΛΟ ΕΠΑΛΗΘΕΥΜΕΝΩΝ URI ESCO** (Giorgio 2026-10-01).
 * Οι επαγγελματίες δηλώνουν **στενούς** τίτλους (*«ηλεκτρολόγος κτιρίων»*, *«τεχνικός
 * εγκαταστάσεων φυσικού αερίου»*). Τσιπ καρφωμένο σε **ένα** URI θα έλεγε «Υδραυλικός · 0»
 * ενώ υπάρχουν υδραυλικοί — ψευδές μηδέν. Ολόκληρη ομάδα ISCO θα έφερνε **άσχετους**
 * (το 3432 περιέχει σκηνογράφο, το 2165 ειδικό GIS). ⇒ Λίστα **ρητή**, όπως οι
 * κατηγορίες του Houzz — κάθε UUID **επαληθεύτηκε** στο `system/esco_cache/occupations`
 * (2026-10-01) και ο ISCO κωδικός του γράφεται δίπλα.
 *
 * ⚠️ **ΕΝΑ URI ΑΝΗΚΕΙ ΣΕ ΜΙΑ ΟΙΚΟΓΕΝΕΙΑ ΤΟ ΠΟΛΥ** — άγκυρα στο `occupation-query.test.ts`.
 * ⚠️ **Η σειρά είναι επιμελημένη σειρά ΕΙΔΙΚΟΤΗΤΩΝ** (η σειρά του Giorgio), όχι κατάταξη
 *    **επαγγελματιών** — δεν αγγίζει το «καμία κατάταξη» του `/pro` (ADR-843).
 * ⛔ **Καμία ετικέτα εδώ**: η λέξη του τσιπ ζει στα locales (`occupationFamily.<id>`, N.11).
 * ⛔ **Κανένας επινοημένος κωδικός** — ό,τι δεν υπάρχει στο ESCO δεν μπαίνει (π.χ. «γυψοσανιδάς»).
 */

import type { LucideIcon } from 'lucide-react';
import {
  AppWindow,
  Building2,
  Cog,
  DraftingCompass,
  Droplets,
  Grid3x3,
  HardHat,
  Home,
  LandPlot,
  Layers,
  PaintRoller,
  PlugZap,
  Shield,
  Snowflake,
  Sofa,
  Trees,
  Zap,
} from 'lucide-react';

import { PROJECT_ROLE_BRIDGE } from '@/config/profession-bridge.config';
import { escoOccupationUri } from '@/lib/esco/esco-uri';
import type { ProjectRole } from '@/types/entity-associations';

export const OCCUPATION_FAMILY_GROUPS = ['engineering', 'trades'] as const;
export type OccupationFamilyGroup = (typeof OCCUPATION_FAMILY_GROUPS)[number];

export interface OccupationFamily {
  readonly id: string;
  readonly group: OccupationFamilyGroup;
  readonly Icon: LucideIcon;
  /** Πλήρη ESCO occupation URI — η ταυτότητα με την οποία κρίνεται κάθε πιστοποίηση. */
  readonly escoUris: readonly string[];
}

/** Τα URI μηχανικών που ήδη ζουν στη γέφυρα ρόλων — **εισάγονται**, δεν ξαναγράφονται. */
function bridgedUri(role: ProjectRole): string {
  const uri = PROJECT_ROLE_BRIDGE[role].escoUri;
  if (uri === null) throw new Error(`occupation-families: role ${role} has no ESCO URI`);
  return uri;
}

const esco = escoOccupationUri;

export const OCCUPATION_FAMILIES = [
  // ── Μηχανικοί / μελέτη ─────────────────────────────────────────────────
  { id: 'surveyor', group: 'engineering', Icon: LandPlot, escoUris: [
    bridgedUri('surveyor'), // 2165 αγρονόμος τοπογράφος μηχανικός
    esco('2561879a-dd0a-454e-ae6e-9be6c488eb56'), // 2165 τεχνικός τοπογραφικών εφαρμογών
  ] },
  { id: 'architect', group: 'engineering', Icon: DraftingCompass, escoUris: [
    bridgedUri('architect'), // 2161 αρχιτέκτονας
    esco('efa81635-9125-4276-8902-9deb12170ea7'), // 2161 αρχιτέκτονας εσωτερικών χώρων
  ] },
  { id: 'interiorDesigner', group: 'engineering', Icon: Sofa, escoUris: [
    esco('73e776fb-4d99-4031-bad4-7716f121155d'), // 3432 διακοσμητής εσωτερικών χώρων
    esco('773e5ea3-235b-4e72-afc5-290dd841eed8'), // 3432 σύμβουλος διακόσμησης εσωτερικών χώρων
  ] },
  { id: 'civilEngineer', group: 'engineering', Icon: Building2, escoUris: [
    bridgedUri('structural_engineer'), // 2142 πολιτικός μηχανικός
    esco('2a914d26-42aa-46b5-acf3-097d51ba4617'), // 2142 μηχανικός δομικών έργων
    esco('efc75d4e-dfbf-4178-929c-0ae198801c36'), // 2142 γεωτεχνικός μηχανικός
  ] },
  { id: 'mechanicalEngineer', group: 'engineering', Icon: Cog, escoUris: [
    bridgedUri('mechanical_engineer'), // 2144 μηχανολόγος μηχανικός
    esco('1f97f6e6-0ac7-4e77-88ab-2e3801c5a223'), // 2144 μηχανικός θέρμανσης, ψύξης, εξαερισμού και κλιματισμού
  ] },
  { id: 'electricalEngineer', group: 'engineering', Icon: Zap, escoUris: [
    bridgedUri('electrical_engineer'), // 2151 ηλεκτρολόγος μηχανικός
    esco('77abfaec-a250-4765-95fa-6091e8da1bba'), // 2151 ηλεκτρομηχανολόγος μηχανικός
    esco('ac37627c-a999-4779-997e-9795cc4f9a3d'), // 2151 ηλεκτρολόγος μηχανικός διανομής ενέργειας
  ] },
  // ── Συνεργεία ──────────────────────────────────────────────────────────
  { id: 'plumber', group: 'trades', Icon: Droplets, escoUris: [
    esco('ed3cf43d-c2c1-4c46-82fc-1375e27e0290'), // 7126 υδραυλικός
    esco('3df28a39-9bfe-4e36-b394-a189ef967a74'), // 7126 τοποθετητής λουτρών
    esco('97b3cab1-f4f0-41ed-8c80-e65e6c067e95'), // 7126 τεχνικός εγκαταστάσεων φυσικού αερίου
    esco('7259dc48-004a-4ceb-aa4e-5bbd548c2397'), // 7126 μηχανικός θέρμανσης
    esco('461959ed-6a80-4c33-a75e-26aaeb52a5a7'), // 7126 τεχνικός αποχετεύσεων
  ] },
  { id: 'electrician', group: 'trades', Icon: PlugZap, escoUris: [
    esco('4910419f-b4af-4f59-b544-9dbebc8a74f0'), // 7411 ηλεκτρολόγος
    esco('33960bab-4423-4808-af6c-ec2b485dba41'), // 7411 ηλεκτρολόγος κτιρίων
    esco('5dbb9cf0-b226-402c-a295-2f42ef05ff8b'), // 7411 ηλεκτρολόγος οικιακών συσκευών
    esco('5df63943-f1bc-4438-90f1-92768a7a23c8'), // 7411 ηλεκτρολόγος βιομηχανικών εγκαταστάσεων
    esco('75b63949-1b93-4bf2-a777-ccf978dc3e8a'), // 7411 τεχνικός ηλιακής ενέργειας
  ] },
  { id: 'painter', group: 'trades', Icon: PaintRoller, escoUris: [
    esco('15620506-fb5d-49cd-87a2-1c9047fb406a'), // 7131 ελαιοχρωματιστής οικοδομών
    esco('a2abd144-2a36-45ea-919c-1fcc6ebc5d45'), // 7131 ταπετσέρης τοίχων
  ] },
  { id: 'tiler', group: 'trades', Icon: Grid3x3, escoUris: [
    esco('02447817-ea01-4d8b-b09c-8bc128e447e6'), // 7122 τοποθετητής πλακιδίων
    esco('a50d64e7-2dba-4418-81a7-92b2ba2e508f'), // 7114 τοποθετητής πλακιδίων terrazzo
  ] },
  { id: 'hvac', group: 'trades', Icon: Snowflake, escoUris: [
    esco('79f435d0-9bc6-4d25-a26a-acbe16569ebb'), // 7127 μηχανικός συντήρησης συστημάτων θέρμανσης, εξαερισμού, κλιματισμού (και ψύξης)
  ] },
  { id: 'windows', group: 'trades', Icon: AppWindow, escoUris: [
    esco('353a22a7-1c55-410c-a7a7-c531692b5e50'), // 7115 τοποθετητής παραθύρων
    esco('0b5e4142-90ad-48a6-8407-ed47b2664954'), // 7115 τοποθετητής θυρών
    esco('5f9e0588-e819-42f7-9975-f53198666c07'), // 7125 τοποθετητής υαλοπινάκων
  ] },
  { id: 'plasterer', group: 'trades', Icon: Layers, escoUris: [
    esco('f4a22809-c00c-4dd0-8b09-c7251f8dcd1c'), // 7123 σοβατζής
    esco('41a8e7c8-e1d8-4984-9b3c-dbbad1699f83'), // 7123 εγκαταστάτης οροφών
  ] },
  { id: 'insulation', group: 'trades', Icon: Shield, escoUris: [
    esco('b2dab4fb-b7f7-4f57-94b2-9c0f0848564a'), // 7124 μονωτής
  ] },
  // `HardHat`, όχι `BrickWall`: στα 16px το τουβλάκι ήταν σχεδόν ίδιο με το πλέγμα του Πλακά (Giorgio, 2026-10-01).
  { id: 'mason', group: 'trades', Icon: HardHat, escoUris: [
    esco('05f321f8-055b-407d-bf19-e0ddabda56b7'), // 7112 κτίστης
    esco('59cc9783-7289-4e1d-b80b-93c1776f49cc'), // 7111 κτίστης κατοικιών
    esco('f3fc11ca-9a72-40da-bf0f-b2aab7e33079'), // 7113 λιθοκτίστης
  ] },
  { id: 'roofer', group: 'trades', Icon: Home, escoUris: [
    esco('b4c6d1b0-929e-48be-9f67-47bd8c30658b'), // 7121 κατασκευαστής στεγών
  ] },
  { id: 'landscaper', group: 'trades', Icon: Trees, escoUris: [
    esco('e7970c7a-7769-4002-87d3-0a8ea94fdd6f'), // 6113 κηποτέχνης
    esco('a48b9a5a-5ded-482d-8cda-7fd097a32c16'), // 6113 συντηρητής χώρων πρασίνου
  ] },
] as const satisfies readonly OccupationFamily[];

export type OccupationFamilyId = (typeof OCCUPATION_FAMILIES)[number]['id'];
