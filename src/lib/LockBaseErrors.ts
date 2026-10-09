/** Type of LockeError proerties. */
export type LockErrorProps = Record<string, unknown>;

/**
 * Basic lock handling error. 
 */
export class LockError extends Error {
  public code:string = 'ELOCK';
  /**
   * Constructor.
   * @param msg   Error message.
   * @param params  Parameters.
   */
  constructor(msg: string, params?: { code?: string, props?: LockErrorProps | null}) {
    super(msg);
    Object.defineProperty(this, 'message', {
      value: msg,
      enumerable: true,
      configurable: true,
      writable: true,
    });
    const props = {...params?.props};
    this.code = (params?.code) ?? 'ELOCK';
    Object.assign(this, props);
  }
};

/**
 * Deadlock detection error. 
 */
export class DeadlockDetected extends LockError {
  /**
   * Constructor.
   * @param msg   Error message.
   * @param params  Parameters.
   */
  constructor(msg: string | null, params?: { key: string, props?: LockErrorProps }) {
    msg = msg || 'A deadlock was detected.';
    const props = {...params?.props};
    params?.key && (props.key = params?.key);
    super(msg, { code: 'EDEADLK' , props });
  }
};

/**
 * TTL exceeded error.
 */
export class TTLExceeded extends LockError {
  /**
   * Constructor.
   * @param msg   Error message.
   * @param params  Parameters.
   */
  constructor(msg: string | null, params?: { ttlMs: number, key: string, props?: LockErrorProps }) {
    const ttlMs = params?.ttlMs;
    msg = msg || `The maximum processing time(${ttlMs ?? "options.ttlMs"} milliseconds) while locked has been exceeded.`;
    const props = {...params?.props };
    if (ttlMs != null) props.ttlMs = ttlMs;
    if (params?.key != null) props.key = params.key;
    super(msg, { code: 'ETTLEXCEEDED', props });
  }
};

/** Already locked error. */
export class AlreadyLocked extends LockError {
  /**
   * Constructor.
   * @param msg   Error message.
   * @param params  Parameters.
   */
  constructor(msg: string, params?: { key: string, props?: LockErrorProps } ) {
    const key = params?.key;
    msg = msg || `Couldn't acquire the lock because the '${key ?? "key"}' is already locked.`;
    const props = {...params?.props};
    if (key != null) props.key = key;
    super(msg, { code:'EALREADYLOCKED' , props });
  }
};

/** Invalid options error. */
export class InvalidOptions extends LockError {
  /**
   * Constructor.
   * @param msg   Error message.
   * @param params  Parameters.
   */
  constructor(msg: string, params?: { name?: string, props?: LockErrorProps } ) {
    const name: string | null = params?.name ?? null;
    msg = msg || `The value of the specified options${name ? '(' + name + ')' : ''} is invalid.`;
    const props = {...params?.props};
    if (name) props.name = name;
    super(msg, { code:'EINVAL' , props });
  }
};

/** 
 * Processing was interrupted due to a failure to release the lock or decrement the lock counter. 
 * As this is likely caused by a file I/O error, a system check is recommended. 
 * Additionally, files or directories such as lock files or shared lock information
 * may remain, so they must be manually deleted.
 */
export class ReleaseFailed extends LockError {
  /**
   * Constructor.
   * @param msg   Error message.
   * @param params  Parameters.
   */
  constructor(msg: string, params?: { key: string, props?: LockErrorProps }) {
    msg = msg || "Processing is interrupted because the lock release or lock counter decrement failed.";
    const props = { ...params?.props };
    params?.key     && (props.key = params?.key);
    
    super(msg, { code:'ERELEASE' , props });
  }
};
