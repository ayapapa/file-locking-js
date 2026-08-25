import { type LockBaseInternalState } from './LockBaseInternalState.ts';

/** FileLock status information. */
export interface FileLockInternalState extends LockBaseInternalState {
  /** Path to the lock information storage file. */
  filePath: string;
}
