import { BaseUserOptions, typedKeys, type AllOptions as AllOptionsT } from './BaseUserOptions.ts';

export type AllOptions = AllOptionsT<FileLockUserOptions>;

// User options for FileLock (inherits from BaseUserOptions)
export interface FileLockUserOptions extends BaseUserOptions {
  /**
   * Polling interval (checking if locked) in seconds until timeout. 
   * Internally converted to pollIntervalMs. Cannot be used with pollIntervalMs. 
   * Defaults to the default value of pollIntervalMs.
   */
  pollIntervalSec?: number;

  /**
   * Polling interval (checking if locked) in milliseconds until timeout. 
   * Cannot be used with pollIntervalSec. Default is 100.
   */
  pollIntervalMs?: number;

  /**
   * Heartbeat interval in seconds while the locked process is running. 
   * The lock file is updated at this interval until the process completes. Internally converted to heartbeatIntervalMs. 
   * Cannot be used with heartbeatIntervalMs. Defaults to the default value of heartbeatIntervalMs.
   */
  heartbeatIntervalSec?: number;

  /**
   * Heartbeat interval in milliseconds while the locked process is running. 
   * The lock file is updated at this interval until the process completes. Cannot be used with heartbeatIntervalSec. Default is 1000.
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
   * If this amount of time has not elapsed since the last update, the process is considered to be still running. Cannot be used with heartbeatTimeoutSec. 
   * Default is 10000.
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
   *  Cannot be used together with retryIntervalSec. Default is 100.
   */
  retryIntervalMs?: number;

}

export { typedKeys };