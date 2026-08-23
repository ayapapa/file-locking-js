import { BaseOptionsResolver, typedKeys, type KeyTypeMap, type TimeBasedKey } from './BaseOptionsResolver.ts';
import { FileLockUserOptions } from './FileLockUserOptions.ts';
import { FileLockInternalState } from './FileLockInternalState.ts';

export class FileLockUserOptionsResolver extends BaseOptionsResolver<FileLockUserOptions, FileLockInternalState> {
  
  /**
   * Constructor.
   * @param options User options.
   */
  constructor(options: FileLockUserOptions, defaultOptions?: FileLockUserOptions ) {
    super(options, defaultOptions);

    (options as any)._resolvedOpts = this.options;
  };

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

  public override getDefaultOptions(): FileLockUserOptions {
    return FileLockUserOptionsResolver.getDefaultOptions();
  }

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
  
  protected override _getTimeKeys(): TimeBasedKey<FileLockUserOptions>[] {
    const bases = super._getTimeKeys();
    bases.push('pollInterval', 'heartbeatInterval', 'heartbeatTimeout', 'retryInterval');
    return bases;
  }

}

export { typedKeys };