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
  constructor(msg?: string, params?: {code?: string, props?: LockErrorProps }) {
    super(msg, params);
  }
};

/** 
 * Lock directory access error.
 */
class LockDirectoryAccessFailed extends FileLockError {
  /**
   * Constructor.
   * @param fsErrorMsg   fs's error message.
   * @param operation   Operation on the lock information storage directory.
   * @param code  Error code string.
   * @param params  Parameters.
   */
  constructor(fsErrorMsg: string | null, operation: string, code: string, params?: {path?: string, props?: LockErrorProps }) {
    const path = params?.path;
    const props = { ...params?.props };
    if (path != null) props.path = path;
    if (fsErrorMsg != null) props.fsErrorMsg = fsErrorMsg;
    super(`Failed to ${operation} the lock information storage directory${path ? '('+path+')' : ""}.`, { code , props });
  }
}

/**
 * Lock directory 'Stat' error.
 */
export class LockDirectoryStatFailed extends LockDirectoryAccessFailed {
  /**
   * Constructor.
   * @param fsErrorMsg   fs's error message.
   * @param params  Parameters.
   */
  constructor(fsErrorMsg: string | null, params?: {path?: string, props?: LockErrorProps }) {
    super(fsErrorMsg, 'check the status of', 'ELOCKDIRSTAT', params);
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
    if (key) props.key = key;
    super(
      `The lock${key ? '(key: ' + key + ')' : ""} has been compromised. ${reason ?? ''}`,
      {code: `ECOMPROMISED`, props }
    );
    }
}

export { AlreadyLocked, DeadlockDetected, InvalidOptions, LockError , TTLExceeded };
