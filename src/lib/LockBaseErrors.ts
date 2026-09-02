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
  constructor(msg?: string, params?: { code?: string, props?: LockErrorProps/*{ [key: string]: any }*/ }) {
    //const org_stackTraceLimit = Error.stackTraceLimit;
    //Error.stackTraceLimit = 20;
    super(msg);
    const props = {...params?.props};
    this.code = (params?.code) ?? 'ELOCK';
    Object.assign(this, props);
    //Error.stackTraceLimit = org_stackTraceLimit;
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
  constructor(msg?: string | null, params?: { key: string, props?: LockErrorProps }) {
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
   * @param msg   Error message.
   * @param params  Parameters.
   */
  constructor(msg?: string | null, params?: { ttlMs: number, props?: LockErrorProps }) {
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
   * @param msg   Error message.
   * @param params  Parameters.
   */
  constructor(msg?: string, params?: { key: string, props?: { [key: string]: any} } ) {
    const key = params?.key;
    msg = msg || `Could not lock because the '${key ?? "key"}' is already locked.`;
    const props = {...params?.props};
    if (key != null) props.key = key;
    super(msg, { code:'ELOCKED' , props });
  }
};

/** Invalid options error. */
export class InvalidOptions extends LockError {
  /**
   * Constructor.
   * @param msg   Error message.
   * @param params  Parameters.
   */
  constructor(msg?: string, params?: { name?: string, props?: { [key: string]: any} } ) {
    const name: string | null = params?.name ?? null;
    msg = msg || `The value${name ? '(' + name + ')' : ''} of the specified options is invalid.`;
    const props = {...params?.props};
    if (name) props.name = name;
    super(msg, { code:'EINVAL' , props });
  }
};

/** 
 * Callstack. 
 */
export class CallStack extends LockError {
  /**
   * Constructor.
   * @param params  Parameters.
   */
  constructor(params?: { props?: LockErrorProps }) {
    const props = { ...params?.props };
    super('', { code: `CALLSTACK`, props });
    if (this.stack) this.stack = this.stack.replace('Error', 'CallStack');
  }
}

