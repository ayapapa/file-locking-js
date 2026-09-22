import { defaultFileLockOptions, type FileLockOptions, } from './FileLockOptions.ts';
import { defaultLockBaseConfig, type LockBaseConfig } from './LockBaseConfig.ts'

/**
 * FileLock cofiguration. 
 */
export interface FileLockConfig extends LockBaseConfig {
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
   * Minimum is `0`; if a value lower than this is specified, this minimum value is used.
   * Default is `100`.
   */
  cacheMaxNum?: number;

  /**
   * Cache expiration time (milliseconds). 
   * Default and minimum `10000`.
   */
  cacheTtlMs?: number;

  /**
   * Global default options.
   * These are used as the default values ​​for options specified in `withLock()`.
   * Default is the return value of `FileLock.getDefaultOptions()`. 
   */
  defaultOptions?: FileLockOptions;

  /**
   * @internal
   * Whether to keep a history of lock information. 
   * This is for debugging.
   * If `true`, a history of lock information will be appended into a file named `xxxx.json` in the `lock directory`/history/.
   * Default is `false`.
   */
  history?: boolean;

  /**
   * Maximum number of history entries to keep. 
   * This is for debugging.
   * If the number of entries exceeds this value, the oldest entries will be deleted in order.
   * Minimum is `0`; if a value lower than this is specified, this minimum value is used.
   * Default is `100`.
   */
  maxHistoryEntries?: number;

  /**
   * Maximum number of history files to keep. 
   * This is for debugging.
   * If the number of entries exceeds this value, the oldest entries will be deleted in order.
   * Minimum is `0`; if a value lower than this is specified, this minimum value is used.
   * Default is `100`.
   */
  maxHistoryFiles?: number;
}

/**
 * @internal
 * Default values ​​for FileLockConfig. 
 */
export const defaultFileLockConfig: Readonly<Required<FileLockConfig>> = {
  ...defaultLockBaseConfig,
  cache:              true,
  cacheMaxNum:        100,
  cacheTtlMs:         10000,
  defaultOptions:     { ...defaultFileLockOptions },
  history:            false,
  lockDirectory:      null,
  maxHistoryEntries:  100,
  maxHistoryFiles:    100,
};