/** Monitoring object passed to the callback function executed after acquiring the lock. */
export interface Monitor {
  /** Whether the operation was cancelled. */
  cancelled: boolean;

  reason?: string;

  operation?: string;

  id?: string;
}

export interface BaseInternalState {
  /** Whether the BaseUserOptions was resolved. */
  resolved: boolean;

  /** Lock owner id. */
  ownerId?: string | null;

  monitor?: Monitor;

  release?: () => void;
}

