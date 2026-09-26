import { LockBaseOptionsResolver } from './LockBaseOptionsResolver.ts';
import { type FileLockRequiredNumericOptions, type FileLockOptions, type FileLockRequiredOptions } from './FileLockOptions.ts';
import { typedKeys, type KeyTypeMap, type TimeBasedKey } from './Util.ts';
import { Contracts } from '@ayapapa-npm/contracts-js';
import { InvalidOptions } from './LockBaseErrors.ts';

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
      retryIntervalMs:      "number",
      invalidTtlSec:        "number",
      invalidTtlMs:         "number",
    };
  }
  
  /** Get an array of time-related base names (keys) from the option properties. */
  protected override _getTimeKeys(): TimeBasedKey<FileLockOptions>[] {
    const bases = super._getTimeKeys();
    bases.push('pollInterval', 'heartbeatInterval', 'heartbeatTtl', 'retryInterval', 'invalidTtl');
    return bases;
  }

  /**
   * @internal
   * Transform, and complete options.
   * @param defaultOptions  User default options
   * @protected
   */
  protected override _normalizeOptions(): void {
    super._normalizeOptions();
    Contracts.VERIFY_DEBUG(this.options.heartbeatTtlMs != null, 
      "invalid `heartbeatTtlMs`. Maybe a bug.", InvalidOptions, { name: 'heartbeatTtlMs' } )
    if ('invalidTtlMs' in this.options) {
      // As this has been verified above, it will be used as the definitive value.
      this.options.invalidTtlMs = Math.max(this.options.invalidTtlMs, this.options.heartbeatTtlMs!)
    }
  }

}

export { typedKeys };