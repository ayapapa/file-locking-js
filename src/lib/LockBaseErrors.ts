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
  constructor(msg?: string, params?: { code?: string, props?: LockErrorProps }) {
    super(msg);
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
  constructor(msg?: string | null, params?: { key: string, props?: LockErrorProps }) {
    msg = msg || 'A deadlock was detected.';
    super(msg, {
      code: 'EDEADLK' ,
      props: params?.key ? { ...params?.props , key: params.key } : { ...params?.props }
    });
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
  constructor(msg?: string, params?: { key: string, props?: LockErrorProps } ) {
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
  constructor(msg?: string, params?: { name?: string, props?: LockErrorProps } ) {
    const name: string | null = params?.name ?? null;
    msg = msg || `The value of the specified options${name ? '(' + name + ')' : ''} is invalid.`;
    const props = {...params?.props};
    if (name) props.name = name;
    super(msg, { code:'EINVAL' , props });
  }
};

