import { LockBaseUserOptionsResolver, typedKeys, type KeyTypeMap, type TimeBasedKey } from './LockBaseUserOptionsResolver.ts';
import { FileLockUserOptions } from './FileLockUserOptions.ts';
import { FileLockInternalState } from './FileLockInternalState.ts';
//import { NumberArray } from 'lru-cache/raw';

/**
 * A class that resolves UserOptions for FileLock.
 */
export class FileLockUserOptionsResolver extends LockBaseUserOptionsResolver<FileLockUserOptions, FileLockInternalState> {
  
  /**
   * Static fields.
   */

  static readonly minHeartBeatTImeoutMs: number = 2000;

  /**
   * Instance methods.
   */

  /**
   * Constructor.
   * @param options User options.
   */
  constructor(options: FileLockUserOptions, defaultOptions?: FileLockUserOptions ) {
    super(options, defaultOptions);
  };

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

  /**
   * @internal
   * Transform, and complete options.
   * @param defaultOpts  Defalt options
   * @protected
   */
  protected override _normalizeOptions(defaultOpts?: FileLockUserOptions): void {
    super._normalizeOptions(defaultOpts);
    this.options.heartbeatTimeoutMs = Math.max(
      this.options.heartbeatTimeoutMs ?? 0, 
      FileLockUserOptionsResolver.minHeartBeatTImeoutMs
    );
  }

}

export { typedKeys };