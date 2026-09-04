[**@ayapapa-npm/file-locking-js**](../README.md)

***

[@ayapapa-npm/file-locking-js](../README.md) / FileLockUserOptions

# Interface: FileLockUserOptions

Defined in: [src/lib/FileLockUserOptions.ts:4](https://github.com/ayapapa/file-lock-js/blob/d5f018497cf77f372cc0e16dc32cbaec314894d5/src/lib/FileLockUserOptions.ts#L4)

## Extends

- `LockBaseUserOptions`

## Properties

### allowReentry?

> `optional` **allowReentry?**: `boolean`

Defined in: [src/lib/LockBaseUserOptions.ts:59](https://github.com/ayapapa/file-lock-js/blob/d5f018497cf77f372cc0e16dc32cbaec314894d5/src/lib/LockBaseUserOptions.ts#L59)

Controls the behavior when attempting to acquire a lock using the same key while already holding a lock for that key. 
 The default is false (re-entrant locking is prohibited; a DeadlockDetected error is thrown upon detection). 

 If true:
   You can proceed to acquire the lock (via withLock) using the same key,
   even if you already hold a lock for that key. 
   Use this setting when you need to allow recursive calls or wrapper functions
   that re-acquire the lock using the same key from within the locked block. 
   Internally, the system increments a lock counter instead of re-acquiring the lock. 

 If false:
   If you attempt to acquire a lock using the same key while already holding it,
   a DeadlockDetected error is thrown immediately. 

   Setting allowReentry to true creates the possibility of
   "processes protected by the same key" executing in an overlapping manner. 
   If the process already running under the lock (the initial phase)
   and the re-entering process (the subsequent phase) read or write to the same shared resource
   (such as in-memory data structures, files, or caches),
   the execution order or state transitions may yield unexpected results. 

   For example, while a shared object is being updated within the locked block,
   a re-entering process using the same key might overwrite that object with a different value,
   leading to interference between the initial and subsequent processes. 

   When enabling allowReentry,
   limit its use to processes where re-entry is known to be safe
   (such as read-only operations or operations where repeating the same action causes no inconsistencies).

#### Inherited from

`LockBaseUserOptions.allowReentry`

***

### heartbeatIntervalMs?

> `optional` **heartbeatIntervalMs?**: `number`

Defined in: [src/lib/FileLockUserOptions.ts:29](https://github.com/ayapapa/file-lock-js/blob/d5f018497cf77f372cc0e16dc32cbaec314894d5/src/lib/FileLockUserOptions.ts#L29)

Heartbeat interval in milliseconds while the locked process is running. 
The lock file is updated at this interval until the process completes. Cannot be used with heartbeatIntervalSec. Default is 1000.

***

### heartbeatIntervalSec?

> `optional` **heartbeatIntervalSec?**: `number`

Defined in: [src/lib/FileLockUserOptions.ts:23](https://github.com/ayapapa/file-lock-js/blob/d5f018497cf77f372cc0e16dc32cbaec314894d5/src/lib/FileLockUserOptions.ts#L23)

Heartbeat interval in seconds while the locked process is running. 
The lock file is updated at this interval until the process completes. Internally converted to heartbeatIntervalMs. 
Cannot be used with heartbeatIntervalMs. Defaults to the default value of heartbeatIntervalMs.

***

### heartbeatTimeoutMs?

> `optional` **heartbeatTimeoutMs?**: `number`

Defined in: [src/lib/FileLockUserOptions.ts:45](https://github.com/ayapapa/file-lock-js/blob/d5f018497cf77f372cc0e16dc32cbaec314894d5/src/lib/FileLockUserOptions.ts#L45)

Validity period in milliseconds for the last heartbeat update. 
If this amount of time has not elapsed since the last update, the process is considered to be still running. This cannot be used in conjunction with `heartbeatTimeoutSec`.
The minimum value is 2000; if a value lower than this is specified, this minimum value is used.
The default value is 10000.

***

### heartbeatTimeoutSec?

> `optional` **heartbeatTimeoutSec?**: `number`

Defined in: [src/lib/FileLockUserOptions.ts:37](https://github.com/ayapapa/file-lock-js/blob/d5f018497cf77f372cc0e16dc32cbaec314894d5/src/lib/FileLockUserOptions.ts#L37)

Validity period in seconds for the last heartbeat update. 
If this amount of time has not elapsed since the last update, the process is considered to be still running (heartbeat valid). 
Internally converted to heartbeatTimeoutMs. Cannot be used with heartbeatTimeoutMs. 
Defaults to the default value of heartbeatTimeoutMs.

***

### pollIntervalMs?

> `optional` **pollIntervalMs?**: `number`

Defined in: [src/lib/FileLockUserOptions.ts:16](https://github.com/ayapapa/file-lock-js/blob/d5f018497cf77f372cc0e16dc32cbaec314894d5/src/lib/FileLockUserOptions.ts#L16)

Polling interval (checking if locked) in milliseconds until timeout. 
Cannot be used with pollIntervalSec. Default is 100.

***

### pollIntervalSec?

> `optional` **pollIntervalSec?**: `number`

Defined in: [src/lib/FileLockUserOptions.ts:10](https://github.com/ayapapa/file-lock-js/blob/d5f018497cf77f372cc0e16dc32cbaec314894d5/src/lib/FileLockUserOptions.ts#L10)

Polling interval (checking if locked) in seconds until timeout. 
Internally converted to pollIntervalMs. Cannot be used with pollIntervalMs. 
Defaults to the default value of pollIntervalMs.

***

### retriesOnIOErr?

> `optional` **retriesOnIOErr?**: `number`

Defined in: [src/lib/FileLockUserOptions.ts:51](https://github.com/ayapapa/file-lock-js/blob/d5f018497cf77f372cc0e16dc32cbaec314894d5/src/lib/FileLockUserOptions.ts#L51)

Number of retries for lock file operations in the event of an I/O error.
Default is 1.

***

### retryIntervalMs?

> `optional` **retryIntervalMs?**: `number`

Defined in: [src/lib/FileLockUserOptions.ts:63](https://github.com/ayapapa/file-lock-js/blob/d5f018497cf77f372cc0e16dc32cbaec314894d5/src/lib/FileLockUserOptions.ts#L63)

Interval between lock file operation retries [milliseconds]. 
 Cannot be used together with retryIntervalSec. Default is 100.

***

### retryIntervalSec?

> `optional` **retryIntervalSec?**: `number`

Defined in: [src/lib/FileLockUserOptions.ts:57](https://github.com/ayapapa/file-lock-js/blob/d5f018497cf77f372cc0e16dc32cbaec314894d5/src/lib/FileLockUserOptions.ts#L57)

Interval between lock file operation retries [seconds]. 
 Internally converted to retryIntervalMs. Cannot be used together with retryIntervalMs. Defaults to the default value of retryIntervalMs.

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

Defined in: [src/lib/LockBaseUserOptions.ts:13](https://github.com/ayapapa/file-lock-js/blob/d5f018497cf77f372cc0e16dc32cbaec314894d5/src/lib/LockBaseUserOptions.ts#L13)

Maximum wait time to acquire the lock [milliseconds]. 
 Cannot be used in conjunction with timeoutSec. Default is 5000.

#### Inherited from

`LockBaseUserOptions.timeoutMs`

***

### timeoutSec?

> `optional` **timeoutSec?**: `number`

Defined in: [src/lib/LockBaseUserOptions.ts:7](https://github.com/ayapapa/file-lock-js/blob/d5f018497cf77f372cc0e16dc32cbaec314894d5/src/lib/LockBaseUserOptions.ts#L7)

Maximum wait time (in seconds) to acquire the lock. 
 Cannot be used in conjunction with `timeoutMs`; it is internally converted to `timeoutMs`. The default value is the same as the default for `timeoutMs`.

#### Inherited from

`LockBaseUserOptions.timeoutSec`

***

### ttlMs?

> `optional` **ttlMs?**: `number`

Defined in: [src/lib/LockBaseUserOptions.ts:27](https://github.com/ayapapa/file-lock-js/blob/d5f018497cf77f372cc0e16dc32cbaec314894d5/src/lib/LockBaseUserOptions.ts#L27)

Lock validity period (time to live): the maximum time [milliseconds] from lock acquisition
 until the callback function completes execution. An error (TTLExceeded) occurs if this
 period is exceeded. Cannot be used in conjunction with ttlSec. Default is 10000.

#### Inherited from

`LockBaseUserOptions.ttlMs`

***

### ttlSec?

> `optional` **ttlSec?**: `number`

Defined in: [src/lib/LockBaseUserOptions.ts:20](https://github.com/ayapapa/file-lock-js/blob/d5f018497cf77f372cc0e16dc32cbaec314894d5/src/lib/LockBaseUserOptions.ts#L20)

Lock validity period (time to live)—i.e., the maximum time [seconds] from lock acquisition
until the callback function completes execution. An error (TTLExceeded) occurs if this period is exceeded.
Cannot be used in conjunction with ttlMs; it is internally converted to ttlMs. Defaults to the default value for ttlMs.

#### Inherited from

`LockBaseUserOptions.ttlSec`
