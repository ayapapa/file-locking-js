import { LockBaseOptionsResolver, typedKeys, type KeyTypeMap, type TimeBasedKey } from './LockBaseOptionsResolver.ts';
import { type FileLockMinimumOptions, type FileLockOptions, type FileLockRequiredOptions } from './FileLockOptions.ts';
//import { FileLockInternalState } from './FileLockInternalState.ts';
//import { NumberArray } from 'lru-cache/raw';

/**
 * @internal
 * A class that resolves Options for FileLock.
 */
export class FileLockOptionsResolver extends LockBaseOptionsResolver<FileLockOptions, FileLockMinimumOptions, FileLockRequiredOptions> {
  
  /**
   * Static fields.
   */

  static readonly minHeartBeatTimeoutMs: number = 2000;

  /**
   * Instance methods.
   */

  /**
   * Constructor.
   * @param options User options.
   */
  constructor(options: FileLockOptions, minimumOptions: FileLockMinimumOptions, defaultOptions?: FileLockRequiredOptions ) {
    super(options, minimumOptions, defaultOptions);
  };

  /** Get the type-checking pairs `{'property name': 'value type'}` for the optional properties. */
  protected override _getCheckTypePairs(): KeyTypeMap<FileLockOptions> {
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
  protected override _getTimeKeys(): TimeBasedKey<FileLockOptions>[] {
    const bases = super._getTimeKeys();
    bases.push('pollInterval', 'heartbeatInterval', 'heartbeatTimeout', 'retryInterval');
    return bases;
  }

}

export { typedKeys };