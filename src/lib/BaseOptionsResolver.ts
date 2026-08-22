// 利用モジュールの読み込み
import { Contracts } from '@ayapapa-npm/contracts-js';
import { 
  typedKeys, 
  type BaseUserOptions, 
  type KeyTypeMap, 
  type AllOptions, 
  type AllOptionsKey, 
  type TimeBasedKey, 
  type MsKey, 
  type SecKey 
} from './BaseUserOptions.ts';
import { LockError } from './LockErrors.ts';

const {REQUIRE} = Contracts;

// The general type for Options (accepting a generic T)
//export type AllOptions<T extends BaseUserOptions = BaseUserOptions> = T & InternalState;
//export type AllOptionsKey<T extends BaseUserOptions = BaseUserOptions> = keyof AllOptions<T>;

/**
 * A class that resolves options.
 * Base class: Accepts a generic type T
 * T must inherit from BaseUserOptions (constraint) 
 */
export class BaseOptionsResolver <T extends BaseUserOptions = BaseUserOptions> {
  
  protected options: AllOptions<T>;

  private static defaultOptions: BaseUserOptions = {
      timeoutMs:      5000,   // ロック解除待ち最大時間のデフォルトは5秒
      ttlMs:          10000,  // ロック有効期間(time to live)のデフォルトは10秒
      allowReentry:   false,  // 再入ロック禁止をデフォルトとする
      //resolved:       false,
      //logger:         console
  }

  public static getDefaultOptions(): BaseUserOptions {
    return BaseOptionsResolver.defaultOptions;
  }

  public getDefaultOptions(): BaseUserOptions {
    return BaseOptionsResolver.defaultOptions;
  }

  /**
   * コンストラクタ
   * @param opts
   */
  constructor(opts: T, defaultOpts?: T) {
     this.options = {
      ...opts,
      resolved: false,
    } as AllOptions<T>;

    this.resolveOptions(defaultOpts);
  }

  public getOptions(): AllOptions<T> {
    return this.options;
  }

  /**
   * ユーザーオプションを検証後、内部用に一部変更・補完した結果を取得する。
   * @param {ojbect} defaultOpts  デフォルトオプション
   */
  resolveOptions(defaultOpts?: T) {
    this.validateOptions();
    this.normalizeOptions(defaultOpts);
    this.options.resolved = true;
  }

  /*
  type KeyTypePair = {

  }
*/
  /**
   * オプションの妥当性をチェックする。
   */
  validateOptions() {
    // 型チェック
    this.checkTypes();
    // 併用チェック
    this.checkCompeting();
  }

  /**
   * オプションを内部用に一部変更・補完（デフォルト埋め、別名サポート、値の変換など）
   * @param defaultOpts  デフォルトオプション
   */
  normalizeOptions(defaultOpts?: T): void {
    this.convSecToMs();

    Object.assign(this.options, { ...defaultOpts,  ...this.options});
    typedKeys(this.options).forEach(key => {
      if (this.options[key] == null) delete this.options[key];
    });
    Object.assign(this.options, { ...this.getDefaultOptions(), ...this.options });
  }

  protected getCheckTypePairs(): KeyTypeMap<BaseUserOptions> {
    return {
      timeoutSec:   `number`,
      timeoutMs:    `number`,
      ttlSec:       `number`,
      ttlMs:        `number`,
      allowReentry: `boolean`,
      /*
      logger:       (value: any) =>  {
        return typeof value === 'object' &&
          typeof (value as any).log   === 'function' &&
          typeof (value as any).trace === 'function' &&
          typeof (value as any).debug === 'function' &&
          typeof (value as any).info  === 'function' &&
          typeof (value as any).warn  === 'function' &&
          typeof (value as any).error === 'function';
      },
      */
    };
    
  }

  /**
   * ユーザーオプションの値の型をチェックする
   */
  checkTypes() {
    const pairs = this.getCheckTypePairs();

    typedKeys(pairs).forEach(key => {
      const t = pairs[key];
      const v = this.options[key];
      REQUIRE(!v || typeof t === 'function' && t(v) || typeof v === t, 
        `オプション${key}の型が正しくありません`, LockError, {code: 'EINVAL', key});
      });
  }

  /*
  protected getCompetingKeys(): CompetingKeysType<T, TimeBasedKey<T>>[] {
    return ['timeout', 'ttl'] as CompetingKeysType<T, TimeBasedKey<T>>[];
  }
  */
 
  /**
   * Get the array of time-related keys that require unit conversion (seconds to milliseconds). 
   * If a subclass handles extended options that include similar keys, override this function and add the relevant keys to the array. 
   * @returns Array of time-related keys requiring unit conversion (seconds to milliseconds).
   */
  protected getTimeKeys(): TimeBasedKey<T>[] {
    return ['timeout', 'ttl'] as TimeBasedKey<T>[];
  }

  private getSecKeyMap(keys: TimeBasedKey<T>[]) {
    return Object.fromEntries(
      keys.map(key => [key, `${key}Sec}`])
    );
  }

  private getMsKeyMap(keys: TimeBasedKey<T>[]) {
    return Object.fromEntries(
      keys.map(key => [key as TimeBasedKey<T>, `${key}Ms}`])
    );
  }

  /**
   * ユーザーオプションの値の競合をチェックする
   * @param keys  チェック対象のキー配列の配列
   */
  private checkCompeting() {
    const keys = this.getTimeKeys();
    const secKeyMap = this.getSecKeyMap(keys);
    const msKeyMap = this.getMsKeyMap(keys);
    keys.forEach(key => {
      const sec = secKeyMap[key] as AllOptionsKey<T>;
      const ms  = msKeyMap[key]  as AllOptionsKey<T>;
      const k1  = this.options[sec], k2 = this.options[ms];
      REQUIRE(!k1 || !k2, `オプション${String(sec)}と${String(ms)}は同時に指定できません`, 
        LockError, {code: 'EINVAL', props: {keys: [sec, ms]} });
    });
  }

  /**
   * Optionsで指定された秒単位値をミリ秒単位に変換する
   */
  convSecToMs() {
    const keys = this.getTimeKeys();
    // this.options を、時間キーのみを含む型として扱う（型アサーション）
    // ここでは 'as unknown as ...' を使って、一度 unknown を経由させて安全にキャストする
    const optionsAsNumbers = this.options as unknown as Partial<Record<SecKey<T> | MsKey<T>, number>>
    
    keys.forEach(key => {
      const fromKey = `${key}Sec` as SecKey<T>;
      const toKey = `${key}Ms` as MsKey<T>;

      const value = optionsAsNumbers[fromKey];

      if (value != null) {
        optionsAsNumbers[toKey] = Math.floor(value * 1000);
        delete optionsAsNumbers[fromKey];
      }
    });
  }
  
/*
    const setToMsMap = Object.fromEntries(
      keys.map(key => [`${key}Sec`, `${key}Ms}`])
    );

    for (const from of Object.keys(setToMsMap)) {
      const value = this.options[from as AllOptionsKey<T>] as number;
      if (value != null) {
        const to = setToMsMap[from];
        this.options[to as AllOptionsKey<T>] = Math.floor(value * 1000);
        delete this.options[from as AllOptionsKey<T>];
      }
    }
  }
*/
}
