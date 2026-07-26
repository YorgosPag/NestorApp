/**
 * `comment-attachment-upload.service` tests (ADR-366 Φ9/C.2 — wiring 2026-07-26).
 *
 * Μόνο το Firebase είναι mocked — το `image-asset-upload` SSoT και ο path builder τρέχουν
 * **αληθινά**, ώστε τα tests να ελέγχουν τα πραγματικά storage paths και την πραγματική
 * επικύρωση, όχι μια δεύτερη υλοποίησή τους.
 *
 * Το κρίσιμο test είναι το «άκυρο **δεύτερο** αρχείο ⇒ ΚΑΝΕΝΑ ανέβασμα»: εκεί κρέμεται η
 * απόφαση σειράς (upload → ένα create). Αν η επικύρωση γινόταν ανά αρχείο μέσα στον βρόχο,
 * ένα άκυρο αρχείο στη μέση θα άφηνε το πρώτο ζεύγος ήδη ανεβασμένο, για σχόλιο που δεν
 * πρόκειται ποτέ να γραφτεί — δηλαδή σκουπίδια από πρόβλημα **γνωστό εξ αρχής**.
 */

import { uploadCommentAttachments } from '../comment-attachment-upload.service';
import type { StagedFile } from '../CommentAttachmentUploader';

// ── Firebase storage mocks (μοτίβο: bim-material-thumbnail-upload.service.test) ──
const uploadBytesMock = jest.fn();
const refMock = jest.fn((_storage: unknown, path: string) => ({ path }));

jest.mock('@/lib/firebase', () => ({ storage: { __mock: true } }));
jest.mock('firebase/storage', () => ({
  ref: (storage: unknown, path: string) => refMock(storage, path),
  uploadBytes: (...args: unknown[]) => uploadBytesMock(...args),
  getDownloadURL: (target: { path: string }) => Promise.resolve(`https://dl/${target.path}`),
  deleteObject: jest.fn(),
}));

const COMPANY_ID = 'cmp_test';
const COMMENT_ID = 'cmt_bim_abc123';
const PREFIX = `companies/${COMPANY_ID}/bim-comment-attachments/${COMMENT_ID}`;

/** Έγκυρο μικροσκοπικό JPEG data URL — ο uploader παράγει πάντα `image/jpeg`. */
const THUMB_DATA_URL = `data:image/jpeg;base64,${btoa('thumb-bytes')}`;

function staged(id: string, name: string, bytes = 32, type = 'image/png'): StagedFile {
  return {
    id,
    file: new File([new Uint8Array(bytes)], name, { type }),
    thumbnailDataUrl: THUMB_DATA_URL,
  };
}

/** Τα paths με τη σειρά που ζητήθηκαν από το Storage. */
function uploadedPaths(): string[] {
  return refMock.mock.calls.map(([, path]) => path as string);
}

beforeEach(() => {
  jest.clearAllMocks();
  uploadBytesMock.mockResolvedValue(undefined);
});

describe('uploadCommentAttachments — happy path', () => {
  it('ανεβάζει ΔΥΟ objects ανά συνημμένο: πλήρες + `-thumb.jpg` δίπλα του', async () => {
    const out = await uploadCommentAttachments({
      companyId: COMPANY_ID,
      commentId: COMMENT_ID,
      staged: [staged('att_1', 'photo.png')],
    });

    expect(uploadedPaths()).toEqual([
      `${PREFIX}/att_1.png`,
      `${PREFIX}/att_1-thumb.jpg`,
    ]);
    expect(out).toEqual([
      {
        id: 'att_1',
        url: `https://dl/${PREFIX}/att_1.png`,
        thumbnailUrl: `https://dl/${PREFIX}/att_1-thumb.jpg`,
        name: 'photo.png',
        sizeBytes: 32,
      },
    ]);
  });

  it('η μικρογραφία είναι ΠΑΝΤΑ .jpg, ανεξάρτητα από την κατάληξη του πρωτότυπου', async () => {
    await uploadCommentAttachments({
      companyId: COMPANY_ID,
      commentId: COMMENT_ID,
      staged: [staged('att_2', 'scan.jpeg', 16, 'image/jpeg')],
    });

    expect(uploadedPaths()).toEqual([
      `${PREFIX}/att_2.jpeg`,
      `${PREFIX}/att_2-thumb.jpg`,
    ]);
  });

  it('κενή λίστα ⇒ κανένα I/O (η φόρμα χωρίς συνημμένα δεν πληρώνει τίποτα)', async () => {
    const out = await uploadCommentAttachments({
      companyId: COMPANY_ID,
      commentId: COMMENT_ID,
      staged: [],
    });

    expect(out).toEqual([]);
    expect(uploadBytesMock).not.toHaveBeenCalled();
  });
});

describe('uploadCommentAttachments — fail fast ΠΡΙΝ από κάθε ανέβασμα', () => {
  it('🔴 άκυρο ΔΕΥΤΕΡΟ αρχείο ⇒ ΚΑΝΕΝΑ ανέβασμα, ούτε του πρώτου', async () => {
    await expect(
      uploadCommentAttachments({
        companyId: COMPANY_ID,
        commentId: COMMENT_ID,
        staged: [staged('att_ok', 'good.png'), staged('att_bad', 'evil.gif')],
      }),
    ).rejects.toThrow(expect.objectContaining({ code: 'format' }));

    expect(uploadBytesMock).not.toHaveBeenCalled();
  });

  it('webp απορρίπτεται — client και `storage.rules` δέχονται ΜΟΝΟ png/jpg', async () => {
    await expect(
      uploadCommentAttachments({
        companyId: COMPANY_ID,
        commentId: COMMENT_ID,
        staged: [staged('att_w', 'shot.webp', 16, 'image/webp')],
      }),
    ).rejects.toThrow(expect.objectContaining({ code: 'format' }));

    expect(uploadBytesMock).not.toHaveBeenCalled();
  });

  it('αρχείο πάνω από 5MB απορρίπτεται με code "size"', async () => {
    await expect(
      uploadCommentAttachments({
        companyId: COMPANY_ID,
        commentId: COMMENT_ID,
        staged: [staged('att_big', 'huge.png', 5 * 1024 * 1024 + 1)],
      }),
    ).rejects.toThrow(expect.objectContaining({ code: 'size' }));

    expect(uploadBytesMock).not.toHaveBeenCalled();
  });
});
