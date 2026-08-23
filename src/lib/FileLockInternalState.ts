import { type InternalState as BaseInternalState } from './BaseUserOptions.ts';

export interface FileLockInternalState extends BaseInternalState {
  filePath: string;
}

