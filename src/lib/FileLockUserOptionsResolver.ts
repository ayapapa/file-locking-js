import { BaseOptionsResolver, type KeyTypeMap, type TimeBasedKey, type CompetingKeysType } from './LockImpl';
import { FileLockUserOptions } from './FileLockUserOptions';

type FileLockTimeBasedKey extends TimeBasedKey = 'pollInterval' | 'heartbeatInterval' | 'heartbeatTimeout' | 'retryInterval';
//type FileLockTimeBasedKey = 'timeout' | 'ttl' | 'pollInterval' | 'heartbeatInterval' | 'heartbeatTimeout' | 'retryInterval';


export class FileLockUserOptionsResolver extends BaseOptionsResolver {
  
  /**
   * Constructor.
   * @param options User options.
   */
  constructor(options: FileLockUserOptions) {
    super(options);
    this.options = {
      ...this.options,
      ...options,
      resolved: false,
    };
  };

  protected getCheckTypePairs(): KeyTypeMap<FileLockUserOptions> {
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
      retryIntervalMs:       "number",
    };

  

  }
  
  override getTimeKeys(): string[] {
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