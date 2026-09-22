import { LockBaseOptionsResolver } from './LockBaseOptionsResolver.ts';
import { type FileLockRequiredNumericOptions, type FileLockOptions, type FileLockRequiredOptions } from './FileLockOptions.ts';
import { typedKeys, type KeyTypeMap, type TimeBasedKey } from './Util.ts'
/**
 * @internal
 * A class that resolves Options for FileLock.
 */
export class FileLockOptionsResolver extends LockBaseOptionsResolver<FileLockOptions, FileLockRequiredNumericOptions, FileLockRequiredOptions> {
  
  /**
   * Instance methods.
   */

  /**
   * Constructor.
   * @param options User options.
   */
  constructor(options: FileLockOptions, minimumOptions: FileLockRequiredNumericOptions, defaultOptions?: FileLockRequiredOptions ) {
    super(options, minimumOptions, defaultOptions);
  };

  /** Get the type-checking pairs `{'property name': 'value type'}` for the optional properties. */
  protected override _getCheckTypePairs(): KeyTypeMap<FileLockOptions> {
    const basics = super._getCheckTypePairs();
    return {
      ...basics,
      pollIntervalSec:      "number",
      pollIntervalMs:       "number",
      heartbeatIntervalSec: "number",
      heartbeatIntervalMs:  "number",
      heartbeatTtlSec:      "number",
      heartbeatTtlMs:       "number",
      retriesOnIOErr:       "number",
      retryIntervalSec:     "number",
      retryIntervalMs:      "number"
    };
  }
  
  /** Get an array of time-related base names (keys) from the option properties. */
  protected override _getTimeKeys(): TimeBasedKey<FileLockOptions>[] {
    const bases = super._getTimeKeys();
    bases.push('pollInterval', 'heartbeatInterval', 'heartbeatTtl', 'retryInterval');
    return bases;
  }

}

export { typedKeys };