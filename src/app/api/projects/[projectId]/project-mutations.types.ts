/**
 * Project Mutations — Shared types and schemas
 */

import { z } from 'zod';
import { PROJECT_STATUS_LABELS } from '@/types/project';
import type { ProjectStatus } from '@/types/project';
import { projectAddressesSchema } from '@/types/project/address-schemas';
// ADR-369 / ADR-650 M10 — 3-tier Revit reference (survey / base point / north).
import {
  ProjectSurveyPointSchema,
  ProjectBasePointSchema,
  ProjectNorthRotationSchema,
} from '@/types/project-elevation.schemas';
import { ProjectBasemapPlacementSchema } from '@/types/project-basemap-placement.schemas';

export const ProjectUpdateSchema = z.object({
  name: z.string().max(500).optional(),
  title: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  status: z.custom<ProjectStatus>((value): value is ProjectStatus => typeof value === 'string' && value in PROJECT_STATUS_LABELS).optional(),
  companyId: z.string().max(128).nullable().optional(),
  company: z.string().max(200).nullable().optional(),
  linkedCompanyId: z.string().max(128).nullable().optional(),
  linkedCompanyName: z.string().max(200).nullable().optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(200).optional(),
  addresses: projectAddressesSchema.optional(),
  // ADR-759 Φ3 — δηλωμένα ρητά, ΟΧΙ μέσω `.passthrough()`: το ζεύγος Ο.Τ./ΟΙΚ. είναι ο στόχος
  // δύο προτάσεων πινακίδας, και ένα πεδίο που περνά «επειδή δεν το κοιτάζει κανείς» δεν έχει
  // ούτε όριο μήκους ούτε ίχνος στο συμβόλαιο. (Το `buildingBlock` ήταν ήδη έτσι από το ADR-745.)
  buildingBlock: z.string().max(120).optional(),
  plotNumber: z.string().max(120).optional(),
  // ADR-759 Φ3γ — ο **ρητός** δείκτης «ποιο τοπογραφικό ισχύει». Δηλώνεται εδώ για τον ίδιο
  // λόγο με το ζεύγος από πάνω: το `.passthrough()` θα το άφηνε να περάσει «επειδή δεν το
  // κοιτάζει κανείς», δηλαδή χωρίς όριο μήκους και χωρίς ίχνος στο συμβόλαιο.
  // `nullable` επίτηδες: η **αποδέσμευση** του ενεργού είναι νόμιμη ενέργεια, όχι απουσία.
  activeSurveyRecordId: z.string().max(128).nullable().optional(),
  progress: z.number().min(0).max(100).optional(),
  totalValue: z.number().min(0).max(999_999_999).optional(),
  totalArea: z.number().min(0).max(999_999_999).optional(),
  startDate: z.string().max(30).nullable().optional(),
  completionDate: z.string().max(30).nullable().optional(),
  // ADR-369 / ADR-650 M10 — geo-referencing (Revit Shared Coordinates).
  surveyPoint: ProjectSurveyPointSchema.optional(),
  basePoint: ProjectBasePointSchema.optional(),
  northRotation: ProjectNorthRotationSchema.optional(),
  // ADR-782 §24 — η **χειροκίνητη τοποθέτηση υποβάθρου**, δηλωμένη ρητά για τον ίδιο λόγο με το
  // ζεύγος Ο.Τ./ΟΙΚ. από πάνω: το `.passthrough()` θα την άφηνε να περάσει «επειδή δεν την
  // κοιτάζει κανείς», δηλαδή χωρίς όριο μεγέθους και χωρίς ίχνος στο συμβόλαιο — και μιλάμε για
  // συντεταγμένες, όπου μια τιμή εκτός πλανήτη δεν σπάει τίποτα ορατά: απλώς ο χάρτης δεν
  // ζωγραφίζεται ποτέ ξανά και κανείς δεν ξέρει γιατί.
  // ⚠️ **ΔΕΝ** είναι γεωαναφορά (§23.1) — δες το docblock του σχήματος πριν τη συνδέσεις με το
  // `basePoint`/`northRotation` από πάνω. `nullable` επίτηδες: η **επαναφορά** είναι νόμιμη
  // ενέργεια του χρήστη, όχι απουσία πεδίου.
  basemapPlacement: ProjectBasemapPlacementSchema.nullable().optional(),
  _v: z.number().int().optional(),
}).passthrough();


export interface ProjectUpdateResponse {
  projectId: string;
  updated: boolean;
  _v?: number;
}

export interface ProjectDeleteResponse {
  projectId: string;
  deleted: boolean;
}
