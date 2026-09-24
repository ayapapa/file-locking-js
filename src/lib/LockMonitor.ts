/** Monitoring object passed to the callback function executed after acquiring the lock. */
export interface Monitor {
  /** Whether the operation was cancelled. */
  cancelled: boolean;

  /** The reason for cancellation determined by FileLock. */
  reason?: string;

  /**
   * The object actually caught by the try-catch block. <br>
   * In many cases, it is an instance of an error class (or a subclass thereof).
   */
  cause?: unknown;

  /** Operation cancelled. */
  operation?: string;

  /** Monitor ID. */
  id?: string;
}
