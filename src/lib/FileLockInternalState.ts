import { type InternalStateBase } from './InternalStateBase.ts';

/** FileLock status information. */
export interface FileLockInternalState extends InternalStateBase {
  /** Path to the lock information storage file. */
  filePath: string;
}
