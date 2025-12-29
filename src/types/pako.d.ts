// Type declaration for pako compression library
declare module 'pako' {
  export function deflate(data: string | Uint8Array, options?: any): Uint8Array;
  export function inflate(data: Uint8Array, options?: any): Uint8Array;
  export function gzip(data: string | Uint8Array, options?: any): Uint8Array;
  export function ungzip(data: Uint8Array, options?: any): Uint8Array;

  const pako: {
    deflate: typeof deflate;
    inflate: typeof inflate;
    gzip: typeof gzip;
    ungzip: typeof ungzip;
  };

  export default pako;
}