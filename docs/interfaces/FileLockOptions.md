[**@ayapapa-npm/file-locking-js**](../README.md)

***

[@ayapapa-npm/file-locking-js](../README.md) / FileLockOptions

# Interface: FileLockOptions

Defined in: [src/lib/FileLockOptions.ts:6](https://github.com/ayapapa/file-lock-js/blob/42e35253b400a14f446438f41dc625eff9f85261/src/lib/FileLockOptions.ts#L6)

User options for FileLock (inherits from LockBaseOptions)

## Extends

- `LockBaseOptions`

## Properties

### allowReentry?

> `optional` **allowReentry?**: `boolean`

Defined in: [src/lib/LockBaseOptions.ts:67](https://github.com/ayapapa/file-lock-js/blob/42e35253b400a14f446438f41dc625eff9f85261/src/lib/LockBaseOptions.ts#L67)

Controls the behavior when attempting to acquire a lock using the same key while already holding a lock for that key. <br>
 The default is `false` (re-entrant locking is prohibited; a DeadlockDetected error is thrown upon detection). <br>
 <br>
 If true:<br>
   You can proceed to acquire the lock (via withLock) using the same key,
   even if you already hold a lock for that key. 
   Use this setting when you need to allow recursive calls or wrapper functions
   that re-acquire the lock using the same key from within the locked block. 
   Internally, the system increments a lock counter instead of re-acquiring the lock. 
 <br>
 If false:<br>
   If you attempt to acquire a lock using the same key while already holding it,
   a DeadlockDetected error is thrown immediately. 
 <br>
 <br>
   Setting allowReentry to true creates the possibility of
   "processes protected by the same key" executing in an overlapping manner. 
   If the process already running under the lock (the initial phase)
   and the re-entering process (the subsequent phase) read or write to the same shared resource
   (such as in-memory data structures, files, or caches),
   the execution order or state transitions may yield unexpected results. 
 <br>
 <br>
   For example, while a shared object is being updated within the locked block,
   a re-entering process using the same key might overwrite that object with a different value,
   leading to interference between the initial and subsequent processes. 
 <br>
 <br>
   When enabling allowReentry,
   limit its use to processes where re-entry is known to be safe
   (such as read-only operations or operations where repeating the same action causes no inconsistencies).

#### Inherited from

`LockBaseOptions.allowReentry`

***

### heartbeatIntervalMs?

> `optional` **heartbeatIntervalMs?**: `number`

Defined in: [src/lib/FileLockOptions.ts:36](https://github.com/ayapapa/file-lock-js/blob/42e35253b400a14f446438f41dc625eff9f85261/src/lib/FileLockOptions.ts#L36)

Heartbeat interval in milliseconds while the locked process is running.  <br>
The lock file is updated at this interval until the process completes. Cannot be used with `heartbeatIntervalSec`.<br>
Minimum is `1000`; if a value lower than this is specified, this minimum value is used.
Default is `1000`.

***

### heartbeatIntervalSec?

> `optional` **heartbeatIntervalSec?**: `number`

Defined in: [src/lib/FileLockOptions.ts:28](https://github.com/ayapapa/file-lock-js/blob/42e35253b400a14f446438f41dc625eff9f85261/src/lib/FileLockOptions.ts#L28)

Heartbeat interval in seconds while the locked process is running.  <br>
The lock file is updated at this interval until the process completes. Internally converted to `heartbeatIntervalMs`. 
Cannot be used with `heartbeatIntervalMs`. <br>
Defaults to the default value of `heartbeatIntervalMs`.

***

### heartbeatTtlMs?

> `optional` **heartbeatTtlMs?**: `number`

Defined in: [src/lib/FileLockOptions.ts:52](https://github.com/ayapapa/file-lock-js/blob/42e35253b400a14f446438f41dc625eff9f85261/src/lib/FileLockOptions.ts#L52)

Validity period in milliseconds for the last heartbeat update.  <br>
If this amount of time has not elapsed since the last update, the process is considered to be still running. This cannot be used in conjunction with `heartbeatTtlSec`.
Minimum is `2000`; if a value lower than this is specified, this minimum value is used.
Default is `2000`.

***

### heartbeatTtlSec?

> `optional` **heartbeatTtlSec?**: `number`

Defined in: [src/lib/FileLockOptions.ts:44](https://github.com/ayapapa/file-lock-js/blob/42e35253b400a14f446438f41dc625eff9f85261/src/lib/FileLockOptions.ts#L44)

Validity period in seconds for the last heartbeat update.  <br>
If this amount of time has not elapsed since the last update, the process is considered to be still running (heartbeat valid). 
Internally converted to `heartbeatTtlMs`. Cannot be used with `heartbeatTtlMs`. 
Defaults to the default value of `heartbeatTtlMs`.

***

### invalidTtlMs?

> `optional` **invalidTtlMs?**: `number`

Defined in: [src/lib/FileLockOptions.ts:92](https://github.com/ayapapa/file-lock-js/blob/42e35253b400a14f446438f41dc625eff9f85261/src/lib/FileLockOptions.ts#L92)

Validity period in milliseconds for the modification time of invalid lock files and related items. <br>
If the specified amount of time has elapsed since the modification time of an invalid lock file or related item, it is deemed invalid and forcibly deleted. 
If not specified, forced deletion of malicious files will not be performed. 
Cannot be used together with `invalidTtlSec`. 
Minimum is `heartbeatTtlMs`; if a value lower than this is specified, this minimum value is used.
Default is unspecified.

***

### invalidTtlSec?

> `optional` **invalidTtlSec?**: `number`

Defined in: [src/lib/FileLockOptions.ts:82](https://github.com/ayapapa/file-lock-js/blob/42e35253b400a14f446438f41dc625eff9f85261/src/lib/FileLockOptions.ts#L82)

Validity period in seconds for the modification time of invalid lock files and related items. <br>
If the specified amount of time has elapsed since the modification time of an invalid lock file or related item, it is deemed invalid and forcibly deleted. 
Internally converted to `invalidTtlMs`. Cannot be used with `invalidTtlMs`. 
Defaults to the default value of `invalidTtlMs`.

***

### pollIntervalMs?

> `optional` **pollIntervalMs?**: `number`

Defined in: [src/lib/FileLockOptions.ts:20](https://github.com/ayapapa/file-lock-js/blob/42e35253b400a14f446438f41dc625eff9f85261/src/lib/FileLockOptions.ts#L20)

Polling interval (checking if locked) in milliseconds until timeout.  <br>
Cannot be used with `pollIntervalSec`. <br>
Minimum is `100`; if a value lower than this is specified, this minimum value is used.
Default is `100`. Specifying `0` also results in the default value.

***

### pollIntervalSec?

> `optional` **pollIntervalSec?**: `number`

Defined in: [src/lib/FileLockOptions.ts:12](https://github.com/ayapapa/file-lock-js/blob/42e35253b400a14f446438f41dc625eff9f85261/src/lib/FileLockOptions.ts#L12)

Polling interval (checking if locked) in seconds until timeout.  <br>
Internally converted to `pollIntervalMs`. Cannot be used with `pollIntervalMs`. 
Defaults to the default value of `pollIntervalMs`.

***

### retriesOnIOErr?

> `optional` **retriesOnIOErr?**: `number`

Defined in: [src/lib/FileLockOptions.ts:59](https://github.com/ayapapa/file-lock-js/blob/42e35253b400a14f446438f41dc625eff9f85261/src/lib/FileLockOptions.ts#L59)

Number of retries for lock file operations in the event of an I/O error. <br>
Minimum is `0`; if a value lower than this is specified, this minimum value is used.
Default is `1`.

***

### retryIntervalMs?

> `optional` **retryIntervalMs?**: `number`

Defined in: [src/lib/FileLockOptions.ts:74](https://github.com/ayapapa/file-lock-js/blob/42e35253b400a14f446438f41dc625eff9f85261/src/lib/FileLockOptions.ts#L74)

Interval in milliseconds between lock file operation retries.  <br>
Cannot be used together with `retryIntervalSec`. 
Minimum is `100`; if a value lower than this is specified, this minimum value is used.
Default is `100`.

***

### retryIntervalSec?

> `optional` **retryIntervalSec?**: `number`

Defined in: [src/lib/FileLockOptions.ts:66](https://github.com/ayapapa/file-lock-js/blob/42e35253b400a14f446438f41dc625eff9f85261/src/lib/FileLockOptions.ts#L66)

Interval in seconds between lock file operation retries.  <br>
Internally converted to `retryIntervalMs`. Cannot be used together with `retryIntervalMs`. 
Defaults to the default value of `retryIntervalMs`.

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

Defined in: [src/lib/LockBaseOptions.ts:16](https://github.com/ayapapa/file-lock-js/blob/42e35253b400a14f446438f41dc625eff9f85261/src/lib/LockBaseOptions.ts#L16)

Maximum wait time to acquire the lock [milliseconds]. <br>
Cannot be used in conjunction with timeoutSec. <br>
`0` does not wait for the preceding unlock. 
The minimum value is `0`; if a value lower than this is specified, this minimum value is used.
Default is `5000`.

#### Inherited from

`LockBaseOptions.timeoutMs`

***

### timeoutSec?

> `optional` **timeoutSec?**: `number`

Defined in: [src/lib/LockBaseOptions.ts:7](https://github.com/ayapapa/file-lock-js/blob/42e35253b400a14f446438f41dc625eff9f85261/src/lib/LockBaseOptions.ts#L7)

Maximum wait time (in seconds) to acquire the lock. <br>
 Cannot be used in conjunction with `timeoutMs`; it is internally converted to `timeoutMs`. The default value is the same as the default for `timeoutMs`.

#### Inherited from

`LockBaseOptions.timeoutSec`

***

### ttlMs?

> `optional` **ttlMs?**: `number`

Defined in: [src/lib/LockBaseOptions.ts:32](https://github.com/ayapapa/file-lock-js/blob/42e35253b400a14f446438f41dc625eff9f85261/src/lib/LockBaseOptions.ts#L32)

Lock validity period (time to live): the maximum time [milliseconds] from lock acquisition 
until the callback function completes execution. An error (TTLExceeded) occurs if this 
period is exceeded. Cannot be used in conjunction with ttlSec.<br>
The minimum value is `1000`; if a value lower than this is specified, this minimum value is used.
Default is `5000`.

#### Inherited from

`LockBaseOptions.ttlMs`

***

### ttlSec?

> `optional` **ttlSec?**: `number`

Defined in: [src/lib/LockBaseOptions.ts:23](https://github.com/ayapapa/file-lock-js/blob/42e35253b400a14f446438f41dc625eff9f85261/src/lib/LockBaseOptions.ts#L23)

Lock validity period (time to live)—i.e., the maximum time [seconds] from lock acquisition 
until the callback function completes execution. An error (TTLExceeded) occurs if this period is exceeded.<br>
Cannot be used in conjunction with ttlMs; it is internally converted to ttlMs. Defaults to the default value for ttlMs.

#### Inherited from

`LockBaseOptions.ttlSec`
