/**
 * Basic lock handling error. 
 */
export class LockError extends Error {
  /**
   * Constructor.
   * @param msg   Error message.
   * @param params  Parameters.
   * @param code  Error code string.
   * @param props A set of arbitrary properties to be attached to the error instance.
   */
  constructor(msg = '', params?: {code?: string, props?: { [key: string]: any } }) {
    const org_stackTraceLimit = Error.stackTraceLimit;
    Error.stackTraceLimit = 20;
    super(msg);
    const props = {...params?.props};
    const code = (params?.code) ?? 'ELOCK';
    Object.assign(this, { code, ...props });
    Error.stackTraceLimit = org_stackTraceLimit;
  }
};

/**
 * Deadlock detection error. 
 */
export class DeadlockDetected extends LockError {
  /**
   * Constructor.
   * @param params  Parameters.
   */
  constructor(msg?: string | null, params?: { key: string, props?: { [key: string]: any } }) {
    msg = msg || 'A deadlock was detected.';
    const props = { ...params?.props }
    if (params?.key) props.key = params?.key;
    super(msg, { code: 'EDEADLK' , props });
  }
};

/**
 * TTL exceeded error.
 */
export class TTLExceeded extends LockError {
  /**
   * Constructor.
   * @param params  Parameters.
   * @param props A set of arbitrary properties to be attached to the error instance.
   */
  constructor(msg?: string | null, params?: { ttlMs: number, props?: {[key: string]: any} }) {
    const ttlMs = params?.ttlMs;
    msg = msg || `The maximum processing time(${ttlMs ?? "options.ttlMs"} milliseconds) while locked has been exceeded.`;
    const props = {...params?.props };
    if (ttlMs != null) props.ttlMs = ttlMs;
    super(msg, { code: 'ETTLEXCEEDED', props });
  }
};

/** Already locked error. */
export class AlreadyLocked extends LockError {
  /**
   * Constructor.
   * @param code    Error code string.
   * @param key     Lock key.
   * @param params  Parameters.
   */
  constructor(msg?: string | null, params?: {key: string, props?: {[key: string]: any} } ) {
    const key = params?.key;
    msg = msg || `Could not lock because the '${key ?? "key"}' is already locked.`;
    const props = {...params?.props};
    if (key != null) props.key = key;
    super(msg, { code:'ELOCKED' , props });
  }
}

