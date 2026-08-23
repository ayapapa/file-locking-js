import { type BaseInternalState } from './BaseInternalState.ts';

/** FileLock status information. */
export interface FileLockInternalState extends BaseInternalState {
  /** Path to the lock information storage file. */
  filePath: string;
}
