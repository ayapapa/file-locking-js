import { type Monitor } from './LockMonitor.ts';

/** 
 * @internal
 * Basic status information. <br>
 * It is the definition of the lock processing status to be maintained for each lock request. 
 * Internally, it is used during lock processing as part of the internal options merged 
 * with user-specified options.
 */
export interface LockBaseInternalState {
  /**
   * Lock sharer id. <br>
   * An identifier asserted when sharing a lock. This ID is a unique identifier 
   * assigned for each option (i.e., for each lock request).
   * Note: This ID is a unique identifier assigned to each lock request. 
   *  But if the lock is successfully acquired via the request (i.e., the key is not currently locked), 
   *  this is set to match this `lock` instance's owner ID upon acquisition.
   */
  _sharerId: string;

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

