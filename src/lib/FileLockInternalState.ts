import { type LockBaseInternalState } from './LockBaseInternalState.ts';

/**
 * @internal 
 * FileLock status information. 
 */
export interface FileLockInternalState extends LockBaseInternalState {
  /** Path to the lock file. */
  _filePath: string;

  /** File descriptor. */
  _fd: number;

  /** Path to the lock information update history file. */
  //_historyFilePath: string;

  // Path to the directory to store sharer's info.
  _sharerDir: string;

}
