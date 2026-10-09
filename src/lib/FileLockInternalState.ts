import { type LockBaseInternalState } from './LockBaseInternalState.ts';

/**
 * @internal 
 * FileLock status information. 
 */
export interface FileLockInternalState extends LockBaseInternalState {
  /** Path to the lock file. */
  _filePath: string;

  /** Path to the directory to store sharer's info. */
  _sharerDir: string;

  /** 
   * Lock retry interval (milliseconds) during `shared directory` I/O execution. 
   * Default is `100`.
   * Minimum is `100`
   */
  _sharerLockIntervalMs: number;

  /** 
   * Lock timeout duration (milliseconds) for I/O operations on the `sharer directory`. 
   * Default is `5000`.
   * Minimum is `0`.
   */
  _sharerLocktimeoutMs: number;
}
