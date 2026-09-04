	import { type LogProvider } from './lib/LockBaseConfig.ts';
	import { type Monitor } from './lib/LockBase.ts';
	import { FileLock, type Config } from './lib/FileLock.ts';
	import { AlreadyLocked, DeadlockDetected, FileLockError, InvalidOptions, LockCompromised, LockDirectoryCreationFailed, LockDirectoryStatFailed, LockError, TTLExceeded } from './lib/FileLockErrors.ts';
	import { type FileLockUserOptions } from './lib/FileLockUserOptions.ts';
	import { FileLockUserOptionsResolver } from './lib/FileLockUserOptionsResolver.ts';
	export { 
		AlreadyLocked, 
		DeadlockDetected, 
		FileLock, 
		FileLockError, 
		FileLockUserOptionsResolver,
		InvalidOptions,
		LockCompromised, 
		LockDirectoryCreationFailed, 
		LockDirectoryStatFailed, 
		LockError,
		TTLExceeded, 
		type Config, 
		type FileLockUserOptions, 
		type LogProvider, 
		type Monitor
	};
	export default FileLock;
