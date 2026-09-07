import { FileLockOptions } from './FileLockOptions.ts';
import { type BaseConfig } from './LockBaseConfig.ts'

/**
 * FileLock cofiguration. 
 */
export interface FileLockConfig extends BaseConfig {
  /**
   * Specifies the directory path to stored locking imformations.
   * If it has been specified, use this as the top priority.
   * The directory is determined based on the following order of priority:<br>
   *  1. Specified via an `Config` (user's explicit intent)
   *  2. `process.cwd()` (current working directory at runtime)
   * Note: In cases where the directory is explicitly specified (1 or 2 above), an error occurs if the specified directory does not exist and its creation fails.
   */
  lockDirectory?: string | null;

  /** 
   * Whether to enable caching for FileLock instances associated with a key.
   * Default is `true`.
   */
  cache?: boolean;

  /**
   * Maximum number that can be cached. 
   * `0` means `cache` is disabled, even if `cache` is true.
   * Default is `100`.
   */
  cacheMaxNum?: number;

  /**
   * Cache expiration time (milliseconds). 
   * Default is `50000`. Specifying `0` also results in the default value.
   */
  cacheTtlMs?: number;

  /**
   * User default options used with `withLock()`.
   * Default is the return value of `FileLock.getDefaultOptions()`.. 
   */
  userDefaultOptions?: FileLockOptions;

  /**
   * Whether to keep a history of lock information.
   * If `true`, a history of lock information will be appended into a file named `history.json` in the lock directory.
   * Default is `false`.
   */
  history?: boolean;

  /**
   * Maximum number of history entries to keep.
   * If the number of entries exceeds this value, the oldest entries will be deleted in order.
   * Default is `100`.
   */
  maxHistoryEntries?: number;

  /**
   * @internal
   * Indicates whether to execute in debug mode.
   * If `true`, process-related information is added to the lock information file, 
   * and history tracking is enabled.
   * This is a debug flag for this class and is intended for use only during development.
   * However, if an external logger is injected, it cannot be controlled; 
   * please adjust the log level yourself as necessary.
   */
  _debug?: boolean;
}

// ★★★デフォルトや、ミニマムを定義すること、、minは、定義されたものだけ！
