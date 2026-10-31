import 'server-only';

/**
 * Η **προεπισκόπηση μίας σελίδας** (ADR-923 §5.6): ο ίδιος δρόμος με την έκδοση (στιγμιότυπο → συνθέτης → Typst), με εύρος
 * ένα μοντέλο, χωρίς προαιρετικά πρότυπα και **χωρίς τιμές**. Η πληρότητα δεν φρενάρει εδώ: ο άνθρωπος βλέπει το ημιτελές.
 * 🔒 Τη συνταγή τη διαλέγει **εδώ** ο διακομιστής: η διαδρομή κρίνεται από `products`, ενώ η όψη συνταγών από `pricingView`.
 *    Ο καλών παίρνει μόνο την εικόνα χωρίς τιμές, ποτέ τη συνταγή, άρα χρήστης χωρίς `pricingView` δεν βλέπει τιμοκατάλογο.
 * @module server/catalog/publishing/publication-preview.server
 */

import type { AuthContext } from '@/lib/auth';
import { previewRecipeOf } from '@/subapps/catalog/publishing/compose-publication';
import type { PublicationPreviewWire, PublicationRecipeDefinition } from '@/subapps/catalog/types/publication';
import { readOwned, runCatalogReadOnly } from '../catalog-store.server';
import { resolvePublicationAssets } from './publication-assets.server';
import { publicationFailureOf } from './publication-run.server';
import { readPublicationSnapshot } from './publication-snapshot.server';
import { readPublicationRecipes } from './publication-views.server';
import { renderPublicationPreview } from './typst-adapter';
import { assertTypstAvailable, runTypst } from './typst-engine.server';

function previewRecipe(recipe: PublicationRecipeDefinition, modelId: string): PublicationRecipeDefinition {
  return {
    ...recipe,
    pricing: { kind: 'none' },
    scope: { kind: 'selection', entries: [{ kind: 'productModel', id: modelId }] },
    templates: { ...recipe.templates, enabled: [] },
  };
}

export async function renderPublicationEntryPreview(ctx: AuthContext, input: { readonly modelId: string }): Promise<PublicationPreviewWire> {
  try {
    const chosen = previewRecipeOf(await readPublicationRecipes(ctx));
    if (chosen === null) return { status: 'noRecipe' };
    await assertTypstAvailable();
    const { recipe, snapshot } = await runCatalogReadOnly(ctx, async (scope) => {
      const stored = await readOwned<PublicationRecipeDefinition>(scope, 'publicationRecipe', chosen.id);
      return { recipe: stored, snapshot: await readPublicationSnapshot(scope, previewRecipe(stored, input.modelId), { ignoreCompleteness: true }) };
    });
    const assets = await resolvePublicationAssets(snapshot.document, snapshot.assets);
    const png = await renderPublicationPreview({ document: snapshot.document, fontCode: recipe.theme.fontCode, readAsset: assets.read, run: runTypst });
    return { status: 'ready', pngBase64: Buffer.from(png).toString('base64') };
  } catch (cause) {
    const failure = publicationFailureOf(cause);
    if (failure === 'internal') throw cause;
    return { status: 'unavailable', failure };
  }
}
