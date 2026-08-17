import { LockError } from './LockErrors.ts';

/**
 * Basic lock handling error. 
 */
export class FileLockError extends LockError {
  /**
   * Constructor.
   * @param msg   Error message.
   * @param params  Parameters.
   */
  constructor(msg: string | null, params?: {code?: string, props?: { [key: string]: any } }) {
    super(msg, params);
  }
};

class LockDirectoryAccessFailed extends FileLockError {
  /**
   * Constructor.
   * @param operation   Operation on the lock information storage directory.
   * @param code  Error code string.
   * @param params  Parameters.
   */
  constructor(fsErrorMsg: string | null, operation: string, code: string, params?: {path?: string, props?: { [key: string]: any } }) {
    const path = params?.path;
    const props = { ...params?.props };
    if (path != null) props.path = path;
    if (fsErrorMsg != null) props.fsErrorMsg = fsErrorMsg;
    super(`Failed to ${operation} the lock information storage directory${path ? '('+path+')' : ""}.`, { code , props });
  }
}

export class LockDirectoryStatFailed extends LockDirectoryAccessFailed {
  /**
   * Constructor.
   * @param orgMsg   Original error message.
   * @param code  Error code string.
   * @param params  Parameters.
   */
  constructor(fsErrorMsg: string | null, params?: {path?: string, props?: { [key: string]: any } }) {
    super(fsErrorMsg, 'check the status of', 'ELOCKDIRSTAT', params);
  }
}

export class LockDirectoryCreationFailed extends LockDirectoryAccessFailed {
  /**
   * Constructor.
   * @param orgMsg  Original error message.
   * @param code    Error code string.
   * @param params  Parameters.
   */
  constructor(fsErrorMsg: string | null, params?: {path?: string, props?: { [key: string]: any } }) {
    super(fsErrorMsg, 'create', 'ELOCKDIRCREATE', params);
  }
}
