import { defaultLockBaseOptions, minimumLockBaseOptions, type LockBaseRequiredNumericOptions, type LockBaseRequiredOptions, type LockBaseOptions } from './LockBaseOptions.ts';

/**
 * User options for FileLock (inherits from LockBaseOptions)
 */
export interface FileLockOptions extends LockBaseOptions {
  /**
   * Polling interval (checking if locked) in seconds until timeout.  <br>
   * Internally converted to `pollIntervalMs`. Cannot be used with `pollIntervalMs`. 
   * Defaults to the default value of `pollIntervalMs`.
   */
  pollIntervalSec?: number;

  /**
   * Polling interval (checking if locked) in milliseconds until timeout.  <br>
   * Cannot be used with `pollIntervalSec`. <br>
   * Minimum is `100`; if a value lower than this is specified, this minimum value is used.
   * Default is `100`. Specifying `0` also results in the default value.
   */
  pollIntervalMs?: number;

  /**
   * Heartbeat interval in seconds while the locked process is running.  <br>
   * The lock file is updated at this interval until the process completes. Internally converted to `heartbeatIntervalMs`. 
   * Cannot be used with `heartbeatIntervalMs`. <br>
   * Defaults to the default value of `heartbeatIntervalMs`. 
   */
  heartbeatIntervalSec?: number;

  /**
   * Heartbeat interval in milliseconds while the locked process is running.  <br>
   * The lock file is updated at this interval until the process completes. Cannot be used with `heartbeatIntervalSec`.<br>
   * Minimum is `1000`; if a value lower than this is specified, this minimum value is used.
   * Default is `1000`.
   */
  heartbeatIntervalMs?: number;

  /**
   * Validity period in seconds for the last heartbeat update.  <br>
   * If this amount of time has not elapsed since the last update, the process is considered to be still running (heartbeat valid). 
   * Internally converted to `heartbeatTtlMs`. Cannot be used with `heartbeatTtlMs`. 
   * Defaults to the default value of `heartbeatTtlMs`.
   */
  heartbeatTtlSec?: number;

  /**
   * Validity period in milliseconds for the last heartbeat update.  <br>
   * If this amount of time has not elapsed since the last update, the process is considered to be still running. This cannot be used in conjunction with `heartbeatTtlSec`.
   * Minimum is `2000`; if a value lower than this is specified, this minimum value is used.
   * Default is `2000`.
   */
  heartbeatTtlMs?: number;

  /**
   * Number of retries for lock file operations in the event of an I/O error. <br>
   * Minimum is `0`; if a value lower than this is specified, this minimum value is used.
   * Default is `1`.
   */
  retriesOnIOErr?: number;

  /**
   * Interval in seconds between lock file operation retries.  <br>
   * Internally converted to `retryIntervalMs`. Cannot be used together with `retryIntervalMs`. 
   * Defaults to the default value of `retryIntervalMs`.
   */
  retryIntervalSec?: number;

  /**
   * Interval in milliseconds between lock file operation retries.  <br>
   * Cannot be used together with `retryIntervalSec`. 
   * Minimum is `100`; if a value lower than this is specified, this minimum value is used.
   * Default is `100`.
   */
  retryIntervalMs?: number;

  /**
   * Validity period in seconds for the modification time of invalid lock files and related items. <br>
   * If the specified amount of time has elapsed since the modification time of an invalid lock file or related item, it is deemed invalid and forcibly deleted. 
   * Internally converted to `invalidTtlMs`. Cannot be used with `invalidTtlMs`. 
   * Defaults to the default value of `invalidTtlMs`.
   */
  invalidTtlSec?: number,

  /**
   * Validity period in milliseconds for the modification time of invalid lock files and related items. <br>
   * If the specified amount of time has elapsed since the modification time of an invalid lock file or related item, it is deemed invalid and forcibly deleted. 
   * If not specified, forced deletion of malicious files will not be performed. 
   * Cannot be used together with `invalidTtlSec`. 
   * Minimum is `heartbeatTtlMs`; if a value lower than this is specified, this minimum value is used.
   * Default is unspecified.
   */
  invalidTtlMs?: number,
}

/**
 * @internal
 * Definition of required properties for the FileLockOtions.
 */
export type FileLockRequiredOptions = Required<Pick<FileLockOptions, 'pollIntervalMs' | 'heartbeatIntervalMs' | 'heartbeatTtlMs' | 'retriesOnIOErr' | 'retryIntervalMs'>> & LockBaseRequiredOptions;

/**
 * @internal
 * Definition of default values ​​for FileLockOtions.
 */
export const defaultFileLockOptions : Readonly<FileLockRequiredOptions> = {
  ...defaultLockBaseOptions,
  pollIntervalMs:       100,
  heartbeatIntervalMs:  1000,
  heartbeatTtlMs:       5000,
  retriesOnIOErr:       1,
  retryIntervalMs:      100,
};

/**
 * @internal
 * Definition of required numeric properties of the FileLockOtions.
 */
export type FileLockRequiredNumericOptions = Pick<FileLockRequiredOptions, 'pollIntervalMs' | 'heartbeatIntervalMs' | 'heartbeatTtlMs' | 'retriesOnIOErr' | 'retryIntervalMs'> & LockBaseRequiredNumericOptions;

/**
 * @internal
 * Definition of the minimum value for required numeric properties of the FileLockOtions.
 */
export const minimumFileLockOptions: Readonly<FileLockRequiredNumericOptions> = {
  ...minimumLockBaseOptions,
  pollIntervalMs:       100,
  heartbeatIntervalMs:  1000,
  heartbeatTtlMs:       2000,
  retriesOnIOErr:       0,
  retryIntervalMs:      100,
}
