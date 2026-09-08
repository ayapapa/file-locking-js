import { defaultLockBaseOptions, type LockBaseRequiredOptions, type LockBaseOptions } from './LockBaseOptions.ts';

// User options for FileLock (inherits from LockBaseOptions)
export interface FileLockOptions extends LockBaseOptions {
  /**
   * Polling interval (checking if locked) in seconds until timeout. 
   * Internally converted to pollIntervalMs. Cannot be used with pollIntervalMs. 
   * Defaults to the default value of pollIntervalMs.
   */
  pollIntervalSec?: number;

  /**
   * Polling interval (checking if locked) in milliseconds until timeout. 
   * Cannot be used with pollIntervalSec. <br>
   * Default is 100. Specifying `0` also results in the default value.
   */
  pollIntervalMs?: number;

  /**
   * Heartbeat interval in seconds while the locked process is running. 
   * The lock file is updated at this interval until the process completes. Internally converted to heartbeatIntervalMs. 
   * Cannot be used with heartbeatIntervalMs. <br>
   * Defaults to the default value of heartbeatIntervalMs. 
   */
  heartbeatIntervalSec?: number;

  /**
   * Heartbeat interval in milliseconds while the locked process is running. 
   * The lock file is updated at this interval until the process completes. Cannot be used with heartbeatIntervalSec.<br>
   * Default is 1000. Specifying `0` also results in the default value.
   */
  heartbeatIntervalMs?: number;

  /**
   * Validity period in seconds for the last heartbeat update. 
   * If this amount of time has not elapsed since the last update, the process is considered to be still running (heartbeat valid). 
   * Internally converted to heartbeatTimeoutMs. Cannot be used with heartbeatTimeoutMs. 
   * Defaults to the default value of heartbeatTimeoutMs.
   */
  heartbeatTimeoutSec?: number;

  /**
   * Validity period in milliseconds for the last heartbeat update. 
   * If this amount of time has not elapsed since the last update, the process is considered to be still running. This cannot be used in conjunction with `heartbeatTimeoutSec`.
   * The minimum value is 2000; if a value lower than this is specified, this minimum value is used.
   * The default value is 10000.
   */
  heartbeatTimeoutMs?: number;

  /**
   * Number of retries for lock file operations in the event of an I/O error.
   * Default is 1.
   */
  retriesOnIOErr?: number;

  /**
   * Interval between lock file operation retries [seconds]. 
   *  Internally converted to retryIntervalMs. Cannot be used together with retryIntervalMs. Defaults to the default value of retryIntervalMs.
   */
  retryIntervalSec?: number;

  /**
   * Interval between lock file operation retries [milliseconds]. 
   *  Cannot be used together with retryIntervalSec. Default and minimum is 100.
   */
  retryIntervalMs?: number;

}

// ★★★デフォルトや、ミニマムを定義すること、、minは、定義されたものだけ！

export type FileLockRequiredOptions = Required<Pick<FileLockOptions, 'pollIntervalMs' | 'heartbeatIntervalMs' | 'heartbeatTimeoutMs' | 'retriesOnIOErr' | 'retryIntervalMs'>> & LockBaseRequiredOptions;
/*
export const _fileLockRequiredOptions = [
  ..._lockBaseRequiredOptions,
  'pollIntervalMs',
  'heartbeatIntervalMs',
  'heartbeatTimeoutMs',
  'retriesOnIOErr',
  'retryIntervalMs'
]  as const satisfies readonly (keyof FileLockOptions)[];
*/

/**
 * @internal
 */
export const defaultFileLockOptions : Readonly<FileLockRequiredOptions> = {
  ...defaultLockBaseOptions,
  pollIntervalMs:       100,
  heartbeatIntervalMs:  1000,
  heartbeatTimeoutMs:   10000,
  retriesOnIOErr:       1,
  retryIntervalMs:      100,
};

export const requiredFileLockOptionsKeys = Object.keys(defaultFileLockOptions) as readonly (keyof FileLockRequiredOptions)[];

