import { type KeyTypeMap, type AllOptions as AllOptionsT, type TimeBasedKey } from './BaseUserOptions.ts';
import { BaseOptionsResolver } from './BaseOptionsResolver.ts';
import { FileLockUserOptions } from './FileLockUserOptions.ts';

//type FileLockTimeBasedKey extends TimeBasedKey = 'pollInterval' | 'heartbeatInterval' | 'heartbeatTimeout' | 'retryInterval';
//type FileLockTimeBasedKey = 'timeout' | 'ttl' | 'pollInterval' | 'heartbeatInterval' | 'heartbeatTimeout' | 'retryInterval';


export class FileLockUserOptionsResolver extends BaseOptionsResolver<FileLockUserOptions> {
  
  //private options: FileLockUserOptions
  /**
   * Constructor.
   * @param options User options.
   */
  constructor(options: FileLockUserOptions, defaultOptions?: FileLockUserOptions ) {
    super(options, defaultOptions);
    /*this.options = {
      ...this.options,
      ...options,
      resolved: false,
    };*/

    (options as any)._resolvedOpts = this.options;
  };

  public static getDefaultOptions(): FileLockUserOptions {
    return {
      ...super.getDefaultOptions(),
      pollIntervalMs: 100,
      heartbeatIntervalMs: 1000,
      heartbeatTimeoutMs: 10000,
      retriesOnIOErr: 1,
      retryIntervalMs: 100,
    }
  }
  override getDefaultOptions(): FileLockUserOptions {
    return FileLockUserOptionsResolver.getDefaultOptions();
    /*
    return {
      ...super.getDefaultOptions(),
      pollIntervalMs: 100,
      heartbeatIntervalMs: 1000,
      heartbeatTimeoutMs: 10000,
      retriesOnIOErr: 1,
      retryIntervalMs: 100,
    }
      */
  }

  override getCheckTypePairs(): KeyTypeMap<FileLockUserOptions> {
    const basics = super.getCheckTypePairs();
    return {
      ...basics,
      pollIntervalSec:       "number",
      pollIntervalMs:        "number",
      heartbeatIntervalSec:  "number",
      heartbeatIntervalMs:   "number",
      heartbeatTimeoutSec:   "number",
      heartbeatTimeoutMs:    "number",
      //expiredCheckBy:        "string",
      retriesOnIOErr:        "number",
      retryIntervalSec:      "number",
      retryIntervalMs:       "number"
    };

  

  }
  
  override getTimeKeys(): TimeBasedKey<FileLockUserOptions>[] {
    const bases = super.getTimeKeys();
    bases.push('pollInterval', 'heartbeatInterval', 'heartbeatTimeout', 'retryInterval');
    return bases;
  }

/**
   * ユーザーオプションの値の型をチェックする
   */
  /*
  checkTypes() {
    super.checkTypes();
    const pairs = {
       timeoutSec:   `number`,
       timeoutMs:    `number`,
       ttlSec:       `number`,
       ttlMs:        `number`,
       allowReentry: `boolean`,
       logger:       `LogProvider`,
    } as const satisfies KeyTypeMap;

    typedKeys(pairs).forEach(key => {
      const type = pairs[key];
      const v = this.options[key];
      REQUIRE(!v || typeof v === type, 
        `オプションの${key}が${type}型ではありません`, LockError, {code: 'EINVAL', key});
    })
  }
*/

}