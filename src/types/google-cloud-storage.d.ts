/**
 * Ambient type declaration for @google-cloud/storage.
 *
 * The package is not listed directly in package.json but is installed
 * transitively via firebase-admin and resolved through pnpm's virtual store.
 * This declaration surfaces the minimal API used by the backup and storage
 * services (Bucket, File) until a direct dependency is added.
 *
 * Field types use `unknown`/`Record<string, unknown>` at boundaries; call
 * sites narrow via runtime checks or helper utilities.
 */
declare module '@google-cloud/storage' {
  export interface FileMetadata {
    [key: string]: unknown;
  }

  export interface File {
    name: string;
    metadata: FileMetadata;
    createReadStream(options?: Record<string, unknown>): NodeJS.ReadableStream & { destroy(error?: Error): void };
    createWriteStream(options?: Record<string, unknown>): NodeJS.WritableStream;
    exists(): Promise<[boolean]>;
    delete(options?: Record<string, unknown>): Promise<unknown>;
    getMetadata(): Promise<[FileMetadata]>;
    setMetadata(metadata: FileMetadata): Promise<unknown>;
    save(data: string | Buffer | Uint8Array, options?: Record<string, unknown>): Promise<void>;
    download(options?: Record<string, unknown>): Promise<[Buffer]>;
    copy(destination: File | string, options?: Record<string, unknown>): Promise<unknown>;
    move(destination: File | string, options?: Record<string, unknown>): Promise<unknown>;
    makePublic(): Promise<unknown>;
    getSignedUrl(options: Record<string, unknown>): Promise<[string]>;
  }

  export interface DeleteFilesOptions {
    prefix?: string;
    force?: boolean;
    [key: string]: unknown;
  }

  export interface Bucket {
    name: string;
    file(path: string, options?: Record<string, unknown>): File;
    getFiles(options?: Record<string, unknown>): Promise<[File[]]>;
    deleteFiles(options?: DeleteFilesOptions): Promise<void>;
    upload(path: string, options?: Record<string, unknown>): Promise<[File]>;
    exists(): Promise<[boolean]>;
    create(options?: Record<string, unknown>): Promise<unknown>;
    delete(options?: Record<string, unknown>): Promise<unknown>;
    getMetadata(): Promise<[Record<string, unknown>]>;
    setMetadata(metadata: Record<string, unknown>): Promise<unknown>;
  }

  export class Storage {
    constructor(options?: Record<string, unknown>);
    bucket(name?: string): Bucket;
  }
}
