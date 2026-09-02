/** Monitoring object passed to the callback function executed after acquiring the lock. */
export interface Monitor {
  /** Whether the operation was cancelled. */
  cancelled: boolean;

  /** Reason for cancellation. */
  reason?: string;

  /** Cancelled operation. */
  operation?: string;

  /** Monitor ID. */
  id?: string;
}

/** Basic status information. */
export interface LockBaseInternalState {
  /** Whether the BaseUserOptions was resolved. */
  //resolved: boolean;

  /** Lock owner id. */
  ownerId: string | null;

  /** 
   * Lock context id. 
   * It is used to detect re-entrant locks within the same process—specifically, 
   * as an identifier to determine whether a locking operation is occurring within the same context.
   */
  contextId: string;

  /** Monitoring information to be passed to the callback function. */
  monitor?: Monitor;
}

