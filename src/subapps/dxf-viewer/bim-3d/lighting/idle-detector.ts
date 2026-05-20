interface IdleDetectorOpts {
  thresholdMs: number;
  onIdle: () => void;
  onActive: () => void;
}

export class IdleDetector {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private wasIdle = false;
  private readonly thresholdMs: number;
  private readonly onIdle: () => void;
  private readonly onActive: () => void;

  constructor(opts: IdleDetectorOpts) {
    this.thresholdMs = opts.thresholdMs;
    this.onIdle = opts.onIdle;
    this.onActive = opts.onActive;
  }

  /** Call every frame while camera is being interacted with. */
  notifyActive(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.wasIdle) {
      this.wasIdle = false;
      this.onActive();
    }
  }

  /** Call every frame while camera is still. */
  notifyIdle(): void {
    if (this.timer === null) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.wasIdle = true;
        this.onIdle();
      }, this.thresholdMs);
    }
  }

  dispose(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
