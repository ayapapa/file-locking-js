	import { FileLock, type Config, type LogProvider } from './lib/FileLock.ts';
	import { FileLockError, LockDirectoryCreationFailed, LockDirectoryStatFailed } from './lib/FileLockErrors.ts';
	import { type FileLockUserOptions } from './lib/FileLockUserOptions.ts';
	export { FileLock, FileLockError, LockDirectoryCreationFailed, LockDirectoryStatFailed, type Config, type FileLockUserOptions, type LogProvider };
	export default FileLock;
