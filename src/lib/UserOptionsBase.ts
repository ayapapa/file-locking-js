/** Basic user options. */
export interface UserOptionsBase {
  /** 
   * Maximum wait time (in seconds) to acquire the lock. 
   *  Cannot be used in conjunction with `timeoutMs`; it is internally converted to `timeoutMs`. The default value is the same as the default for `timeoutMs`.
   */
  timeoutSec?: number;

  /**
   * Maximum wait time to acquire the lock [milliseconds]. 
   *  Cannot be used in conjunction with timeoutSec. Default is 5000.
   */
  timeoutMs?: number;

  /**
   * Lock validity period (time to live)—i.e., the maximum time [seconds] from lock acquisition
   * until the callback function completes execution. An error (TTLExceeded) occurs if this period is exceeded.
   * Cannot be used in conjunction with ttlMs; it is internally converted to ttlMs. Defaults to the default value for ttlMs.
   */
  ttlSec?: number

  /**
   * Lock validity period (time to live): the maximum time [milliseconds] from lock acquisition
   *  until the callback function completes execution. An error (TTLExceeded) occurs if this
   *  period is exceeded. Cannot be used in conjunction with ttlSec. Default is 10000.
   */
  ttlMs?: number;

  /**
   *  Controls the behavior when attempting to acquire a lock using the same key while already holding a lock for that key. 
   *  The default is false (re-entrant locking is prohibited; a DeadlockDetected error is thrown upon detection). 
   *
   *  If true:
   *    You can proceed to acquire the lock (via withLock) using the same key,
   *    even if you already hold a lock for that key. 
   *    Use this setting when you need to allow recursive calls or wrapper functions
   *    that re-acquire the lock using the same key from within the locked block. 
   *    Internally, the system increments a lock counter instead of re-acquiring the lock. 
   *
   *  If false:
   *    If you attempt to acquire a lock using the same key while already holding it,
   *    a DeadlockDetected error is thrown immediately. 
   *
   *    Setting allowReentry to true creates the possibility of
   *    "processes protected by the same key" executing in an overlapping manner. 
   *    If the process already running under the lock (the initial phase)
   *    and the re-entering process (the subsequent phase) read or write to the same shared resource
   *    (such as in-memory data structures, files, or caches),
   *    the execution order or state transitions may yield unexpected results. 
   *
   *    For example, while a shared object is being updated within the locked block,
   *    a re-entering process using the same key might overwrite that object with a different value,
   *    leading to interference between the initial and subsequent processes. 
   *
   *    When enabling allowReentry,
   *    limit its use to processes where re-entry is known to be safe
   *    (such as read-only operations or operations where repeating the same action causes no inconsistencies). 
   */
   allowReentry?: boolean;
}


