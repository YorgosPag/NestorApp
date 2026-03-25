declare module 'proper-lockfile' {
  interface LockOptions {
    stale?: number;
    update?: number;
    retries?: number | { retries: number; minTimeout?: number; maxTimeout?: number };
    realpath?: boolean;
    fs?: object;
    lockfilePath?: string;
    onCompromised?: (err: Error) => void;
  }

  interface UnlockOptions {
    realpath?: boolean;
    fs?: object;
    lockfilePath?: string;
  }

  function lock(file: string, options?: LockOptions): Promise<() => Promise<void>>;
  function unlock(file: string, options?: UnlockOptions): Promise<void>;
  function check(file: string, options?: LockOptions): Promise<boolean>;

  const lockfile: {
    lock: typeof lock;
    unlock: typeof unlock;
    check: typeof check;
  };

  export default lockfile;
  export { lock, unlock, check };
}
