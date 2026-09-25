import { LockError, AlreadyLocked, DeadlockDetected, InvalidOptions, TTLExceeded, type LockErrorProps } from './LockBaseErrors.ts';

/**
 * Basic lock handling error. 
 */
export class FileLockError extends LockError {
  /**
   * Constructor.
   * @param msg   Error message.
   * @param params  Parameters.
   */
  constructor(msg?: string, params?: {code: string, props?: LockErrorProps }) {
    const p = { ...params };
    // Avoided using `if` statements to ensure code coverage.
    p.code == null && (p.code = 'EFILELOCK');
    super(msg, p);
  }

  public static lockFailedDueToIO(key: string, causes: unknown[]) {
    return new FileLockError("Failed to acquire the lock due to a file I/O error.", { code: 'EIO', props: { key, causes } });
  }

  /**
   * @internal
   * Create a history file analysis error instance.
   * @param history  Path to the history file. 
   * @param cause    The parsing error that caused the issue.
   * @returns An instance of FileLockError.
   */
  public static dueToHistory(history: string, causes: unknown[]): FileLockError {
    return new FileLockError("Failed to parse the history file.", { code: 'EHISTORY', props: { history, causes } });
  }

 /**
  * Create a lock acquisition errors caused by history file analysis errors.
   * @param history  Path to the history file. 
   * @param cause    The parsing error that caused the issue.
   * @returns An instance of FileLockError.
  */
  public static lockFailedDueToHistory(history: string, causes: unknown[]): FileLockError {
    return new FileLockError("Failed to acquire the lock due to history parsing failure.", { code: 'EHISTORY', props: { history, causes } });
  }

};

/** 
 * @internal
 * Lock directory access error.
 */
class LockDirectoryAccessFailed extends FileLockError {
  /**
   * Constructor.
   * @param fsErrorMsg   fs's error message.
   * @param operation   Operation on the lock directory.
   * @param code  Error code string.
   * @param params  Parameters.
   */
  constructor(fsErrMsg: string | null, operation: string, code: string, params?: {path?: string, props?: LockErrorProps }) {
    const path = params?.path;
    const props = { ...params?.props };
    if (path != null) props.path = path;
    if (fsErrMsg != null) props.fsErrMsg = fsErrMsg;
    super(`Failed to ${operation} the lock directory${path ? '('+path+')' : ""}.`, { code , props });
  }
}

/**
 * Lock directory 'Stat' error.
 */
export class LockDirectoryStatFailed extends LockDirectoryAccessFailed {
  /**
   * Constructor.
   * @param fsErrMsg  fs's error message.
   * @param params    Parameters.
   */
  constructor(fsErrMsg: string | null, params?: {path?: string, props?: LockErrorProps }) {
    super(fsErrMsg, 'check the status of', 'ELOCKDIRSTAT', params);
  }
}

/**
 * Lock directory 'Creaate' error.
 */
export class LockDirectoryCreationFailed extends LockDirectoryAccessFailed {
  /**
   * Constructor.
   * @param fsErrorMsg   fs's error message.
   * @param params  Parameters.
   */
  constructor(fsErrorMsg: string | null, params?: {path?: string, props?: LockErrorProps }) {
    super(fsErrorMsg, 'create', 'ELOCKDIRCREATE', params);
  }
}

/** 
 * Lock compromised error. 
 */
export class LockCompromised extends FileLockError {
  /**
   * Constructor.
   * @param reason Reason for the error.
   * @param params  Parameters.
   */
  constructor(reason: string | null, params?: { key: string, props?: LockErrorProps }) {
    const key: string | null = params?.key ?? null;
    const props = { ...params?.props };
    if (params?.key) props.key = key;
    if (reason) props.reason = reason;
    super(
      `The lock was compromised during the locking process.`,
      {code: `ECOMPROMISED`, props }
    );
  }
}

/**
 * Lock file broken error.
 */
export class LockFileBroken extends FileLockError {
  /**
   * Constructor.
   * @param reason Reason for the error.
   * @param params  Parameters.
   */
  constructor(params: { path: string, props?: LockErrorProps }) {
    const props = { ...{ path: params.path }, ...params.props };
    super(
      `When checking whether a lock for the same key is already held, ` +
      `the contents of the existing lock file were found to be corrupted, ` +
      `making it impossible to determine the lock status. Please verify ` +
      `that the target process does not exist and delete the lock file if necessary.`,
      {code: `EBROKEN`, props }
    );
  }
}

export { AlreadyLocked, DeadlockDetected, InvalidOptions, LockError , TTLExceeded };
