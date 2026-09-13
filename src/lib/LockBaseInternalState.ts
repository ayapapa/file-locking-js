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
  /** 
   * Lock owner id. <br>
   * This ID is initially unset and is determined when the lock is acquired. 
   * Upon successful acquisition, the `ownerId` of the lock instance is assigned; 
   * in the case of a reentrant lock, the `ownerId` of the preceding lock is assigned. 
   * Although these two IDs are effectively identical, this behavior is 
   * adopted to account for the possibility of future reentrant locks 
   * on the same key involving different instances.
   */
  _ownerId: string | null;

  /** 
   * Lock context id. <br>
   * It is used to detect re-entrant locks within the same process—specifically, 
   * as an identifier to determine whether a locking operation is occurring within the same context.
   */
  _contextId: string;

  /** Monitoring information to be passed to the callback function. */
  _monitor: Monitor;
}

