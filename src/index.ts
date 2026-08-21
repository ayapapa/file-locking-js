	import { FileLock, type Config, type LogProvider } from './lib/FileLock.ts';
	import { FileLockError, LockDirectoryCreationFailed, LockCompromised, LockDirectoryStatFailed, AlreadyLocked, DeadlockDetected, TTLExceeded } from './lib/FileLockErrors.ts';
	import { type FileLockUserOptions, type Monitor } from './lib/FileLockUserOptions.ts';
	export { 
		AlreadyLocked, 
		DeadlockDetected, 
		FileLock, 
		FileLockError, 
		LockCompromised, 
		LockDirectoryCreationFailed, 
		LockDirectoryStatFailed, 
		TTLExceeded, 
		type Config, 
		type FileLockUserOptions, 
		type LogProvider, 
		type Monitor };
	export default FileLock;
