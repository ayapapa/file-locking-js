/**
 * @internal 
 * Lock-related information stored in a lock file.
 */
export interface FileLockMeta {
  /** ID of the owner who acquired the lock. */
  ownerId: string,

  /** ID of the process executing the lock. */
  processId?: number,

  /** ID of the parent process of the lock-executing process. */
  parentProcessId?: number,

  /** An array containing the command-line arguments passed when the Node.js process was launched.  */
  processArgv?: string[],

  /** Lock expiration time. */
  expirationTime: number,

  /** 
   * The valid duration since the last heartbeat.
   * Exceeding this limit is one of the factors used to determine that the lock is invalid.
   */
  heartbeatTtlMs: number,

  /** The last heartbeat time. */
  lastHeartbeatAt: number,

  /** Lock counter.
   * A value that increments or decrements when re-entrant locking is permitted. 
   * ★★オーナー以外も書き換える可能性があるので、分離せよ★★
   */
  counter: number
}
