/** Monitoring object passed to the callback function executed after acquiring the lock. */
export interface Monitor {
  /** Whether the operation was cancelled. */
  cancelled: boolean;

  /** The reason for cancellation determined by FileLock. */
  reason?: string;

  /** The object actually caught by the try-catch block. */
  cause?: unknown;

  /** Operation cancelled. */
  operation?: string;

  /** Monitor ID. */
  id?: string;
}

/** 
 * @internal
 * Basic status information.
 */
export interface LockBaseInternalState {
  /** Whether the BaseUserOptions was resolved. */
  //resolved: boolean;

  /** Lock owner id. */
  _ownerId: string | null;

  /** 
   * Lock context id. 
   * It is used to detect re-entrant locks within the same process—specifically, 
   * as an identifier to determine whether a locking operation is occurring within the same context.
   */
  _contextId: string;

  /** Monitoring information to be passed to the callback function. */
  _monitor: Monitor | null;
}

