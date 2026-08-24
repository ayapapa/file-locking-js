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
export interface BaseInternalState {
  /** Whether the BaseUserOptions was resolved. */
  resolved: boolean;

  /** Lock owner id. */
  ownerId: string | null;

  /** Monitoring information to be passed to the callback function. */
  monitor?: Monitor;
}

