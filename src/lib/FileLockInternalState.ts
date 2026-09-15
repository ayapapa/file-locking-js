import { type LockBaseInternalState } from './LockBaseInternalState.ts';

/**
 * @internal 
 * FileLock status information. 
 */
export interface FileLockInternalState extends LockBaseInternalState {
  /** Path to the lock information storage file. */
  _filePath: string;

  /** File descriptor. */
  _fd: number;

  /** Path to the lock information update history file. */
  _historyFile: string;

  /** Mutual exclusion flag for history updates. */
  //_historyInLocked: boolean;

}
