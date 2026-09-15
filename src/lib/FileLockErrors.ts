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
    const p = { ...params };
    if (p.code == null) p.code = 'EFILELOCK'
    super(msg, p);
  }
};

/** 
 * Lock directory access error.
 */
class LockDirectoryAccessFailed extends FileLockError {
  /**
   * Constructor.
   * @param fsErrorMsg   fs's error message.
   * @param operation   Operation on the lock information directory.
   * @param code  Error code string.
   * @param params  Parameters.
   */
  constructor(fsErrMsg: string | null, operation: string, code: string, params?: {path?: string, props?: LockErrorProps }) {
    const path = params?.path;
    const props = { ...params?.props };
    if (path != null) props.path = path;
    if (fsErrMsg != null) props.fsErrMsg = fsErrMsg;
    super(`Failed to ${operation} the lock information directory${path ? '('+path+')' : ""}.`, { code , props });
  }
}

/**
 * Lock directory 'Stat' error.
 */
export class LockDirectoryStatFailed extends LockDirectoryAccessFailed {
  /**
   * Constructor.
   * @param fsErrMsg   fs's error message.
   * @param params  Parameters.
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
    if (key) props.key = key;
    super(
      `The lock${key ? '(key: ' + key + ')' : ""} has been compromised${reason ? '(' + reason +')' : ''}.`,
      {code: `ECOMPROMISED`, props }
    );
  }
}

export class LockFileBroken extends FileLockError {
  /**
   * Constructor.
   * @param reason Reason for the error.
   * @param params  Parameters.
   */
  constructor(params: { file: string, props?: LockErrorProps }) {
    const props = { ...{ file: params.file }, ...params.props };
    super(
      `ロックファイルの内容が破損しており、ロック状態を判定できません。対象プロセスが存在しないことを確認したうえで、必要ならロックファイルを手動で削除してください。`,
      {code: `EBROKEN`, props }
    );
  }
}

export { AlreadyLocked, DeadlockDetected, InvalidOptions, LockError , TTLExceeded };
