import { LockBaseUserOptionsResolver, typedKeys, type KeyTypeMap, type TimeBasedKey } from './LockBaseUserOptionsResolver.ts';
import { FileLockUserOptions } from './FileLockUserOptions.ts';
import { FileLockInternalState } from './FileLockInternalState.ts';

/**
 * A class that resolves UserOptions for FileLock.
 */
export class FileLockUserOptionsResolver extends LockBaseUserOptionsResolver<FileLockUserOptions, FileLockInternalState> {
  
  /**
   * Static methods.
   */

  /** Get default options. */
  public static override getDefaultOptions(): FileLockUserOptions {
    return {
      ...super.getDefaultOptions(),
      pollIntervalMs: 100,
      heartbeatIntervalMs: 1000,
      heartbeatTimeoutMs: 10000,
      retriesOnIOErr: 1,
      retryIntervalMs: 100,
    }
  }

  /**
   * Instance methods.
   */

  /**
   * Constructor.
   * @param options User options.
   */
  constructor(options: FileLockUserOptions, defaultOptions?: FileLockUserOptions ) {
    super(options, defaultOptions);

    (options as any)._resolvedOpts = this.options;
  };

  /** Get default options. */
  public override getDefaultOptions(): FileLockUserOptions {
    return FileLockUserOptionsResolver.getDefaultOptions();
  }

  /** Get the type-checking pairs `{'property name': 'value type'}` for the optional properties. */
  protected override _getCheckTypePairs(): KeyTypeMap<FileLockUserOptions> {
    const basics = super._getCheckTypePairs();
    return {
      ...basics,
      pollIntervalSec:       "number",
      pollIntervalMs:        "number",
      heartbeatIntervalSec:  "number",
      heartbeatIntervalMs:   "number",
      heartbeatTimeoutSec:   "number",
      heartbeatTimeoutMs:    "number",
      retriesOnIOErr:        "number",
      retryIntervalSec:      "number",
      retryIntervalMs:       "number"
    };
  }
  
  /** Get an array of time-related base names (keys) from the option properties. */
  protected override _getTimeKeys(): TimeBasedKey<FileLockUserOptions>[] {
    const bases = super._getTimeKeys();
    bases.push('pollInterval', 'heartbeatInterval', 'heartbeatTimeout', 'retryInterval');
    return bases;
  }

}

export { typedKeys };