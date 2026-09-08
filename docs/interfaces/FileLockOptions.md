[**@ayapapa-npm/file-locking-js**](../README.md)

***

[@ayapapa-npm/file-locking-js](../README.md) / FileLockOptions

# Interface: FileLockOptions

Defined in: [src/lib/FileLockOptions.ts:4](https://github.com/ayapapa/file-lock-js/blob/17de2828088c860064e647e72109816942d47edf/src/lib/FileLockOptions.ts#L4)

## Extends

- `LockBaseOptions`

## Properties

### allowReentry?

> `optional` **allowReentry?**: `boolean`

Defined in: [src/lib/LockBaseOptions.ts:65](https://github.com/ayapapa/file-lock-js/blob/17de2828088c860064e647e72109816942d47edf/src/lib/LockBaseOptions.ts#L65)

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

Defined in: [src/lib/FileLockOptions.ts:32](https://github.com/ayapapa/file-lock-js/blob/17de2828088c860064e647e72109816942d47edf/src/lib/FileLockOptions.ts#L32)

Heartbeat interval in milliseconds while the locked process is running. 
The lock file is updated at this interval until the process completes. Cannot be used with heartbeatIntervalSec.<br>
Default is 1000. Specifying `0` also results in the default value.

***

### heartbeatIntervalSec?

> `optional` **heartbeatIntervalSec?**: `number`

Defined in: [src/lib/FileLockOptions.ts:25](https://github.com/ayapapa/file-lock-js/blob/17de2828088c860064e647e72109816942d47edf/src/lib/FileLockOptions.ts#L25)

Heartbeat interval in seconds while the locked process is running. 
The lock file is updated at this interval until the process completes. Internally converted to heartbeatIntervalMs. 
Cannot be used with heartbeatIntervalMs. <br>
Defaults to the default value of heartbeatIntervalMs.

***

### heartbeatTimeoutMs?

> `optional` **heartbeatTimeoutMs?**: `number`

Defined in: [src/lib/FileLockOptions.ts:48](https://github.com/ayapapa/file-lock-js/blob/17de2828088c860064e647e72109816942d47edf/src/lib/FileLockOptions.ts#L48)

Validity period in milliseconds for the last heartbeat update. 
If this amount of time has not elapsed since the last update, the process is considered to be still running. This cannot be used in conjunction with `heartbeatTimeoutSec`.
The minimum value is 2000; if a value lower than this is specified, this minimum value is used.
The default value is 10000.

***

### heartbeatTimeoutSec?

> `optional` **heartbeatTimeoutSec?**: `number`

Defined in: [src/lib/FileLockOptions.ts:40](https://github.com/ayapapa/file-lock-js/blob/17de2828088c860064e647e72109816942d47edf/src/lib/FileLockOptions.ts#L40)

Validity period in seconds for the last heartbeat update. 
If this amount of time has not elapsed since the last update, the process is considered to be still running (heartbeat valid). 
Internally converted to heartbeatTimeoutMs. Cannot be used with heartbeatTimeoutMs. 
Defaults to the default value of heartbeatTimeoutMs.

***

### pollIntervalMs?

> `optional` **pollIntervalMs?**: `number`

Defined in: [src/lib/FileLockOptions.ts:17](https://github.com/ayapapa/file-lock-js/blob/17de2828088c860064e647e72109816942d47edf/src/lib/FileLockOptions.ts#L17)

Polling interval (checking if locked) in milliseconds until timeout. 
Cannot be used with pollIntervalSec. <br>
Default is 100. Specifying `0` also results in the default value.

***

### pollIntervalSec?

> `optional` **pollIntervalSec?**: `number`

Defined in: [src/lib/FileLockOptions.ts:10](https://github.com/ayapapa/file-lock-js/blob/17de2828088c860064e647e72109816942d47edf/src/lib/FileLockOptions.ts#L10)

Polling interval (checking if locked) in seconds until timeout. 
Internally converted to pollIntervalMs. Cannot be used with pollIntervalMs. 
Defaults to the default value of pollIntervalMs.

***

### retriesOnIOErr?

> `optional` **retriesOnIOErr?**: `number`

Defined in: [src/lib/FileLockOptions.ts:54](https://github.com/ayapapa/file-lock-js/blob/17de2828088c860064e647e72109816942d47edf/src/lib/FileLockOptions.ts#L54)

Number of retries for lock file operations in the event of an I/O error.
Default is 1.

***

### retryIntervalMs?

> `optional` **retryIntervalMs?**: `number`

Defined in: [src/lib/FileLockOptions.ts:66](https://github.com/ayapapa/file-lock-js/blob/17de2828088c860064e647e72109816942d47edf/src/lib/FileLockOptions.ts#L66)

Interval between lock file operation retries [milliseconds]. 
 Cannot be used together with retryIntervalSec. Default and minimum is 100.

***

### retryIntervalSec?

> `optional` **retryIntervalSec?**: `number`

Defined in: [src/lib/FileLockOptions.ts:60](https://github.com/ayapapa/file-lock-js/blob/17de2828088c860064e647e72109816942d47edf/src/lib/FileLockOptions.ts#L60)

Interval between lock file operation retries [seconds]. 
 Internally converted to retryIntervalMs. Cannot be used together with retryIntervalMs. Defaults to the default value of retryIntervalMs.

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

Defined in: [src/lib/LockBaseOptions.ts:15](https://github.com/ayapapa/file-lock-js/blob/17de2828088c860064e647e72109816942d47edf/src/lib/LockBaseOptions.ts#L15)

Maximum wait time to acquire the lock [milliseconds]. <br>
Cannot be used in conjunction with timeoutSec. <br>
`0` does not wait for the preceding unlock. 
Default is `5000`.

#### Inherited from

`LockBaseOptions.timeoutMs`

***

### timeoutSec?

> `optional` **timeoutSec?**: `number`

Defined in: [src/lib/LockBaseOptions.ts:7](https://github.com/ayapapa/file-lock-js/blob/17de2828088c860064e647e72109816942d47edf/src/lib/LockBaseOptions.ts#L7)

Maximum wait time (in seconds) to acquire the lock. <br>
 Cannot be used in conjunction with `timeoutMs`; it is internally converted to `timeoutMs`. The default value is the same as the default for `timeoutMs`.

#### Inherited from

`LockBaseOptions.timeoutSec`

***

### ttlMs?

> `optional` **ttlMs?**: `number`

Defined in: [src/lib/LockBaseOptions.ts:30](https://github.com/ayapapa/file-lock-js/blob/17de2828088c860064e647e72109816942d47edf/src/lib/LockBaseOptions.ts#L30)

Lock validity period (time to live): the maximum time [milliseconds] from lock acquisition 
until the callback function completes execution. An error (TTLExceeded) occurs if this 
period is exceeded. Cannot be used in conjunction with ttlSec.<br>
Default is `5000`. Specifying `0` also results in the default value.

#### Inherited from

`LockBaseOptions.ttlMs`

***

### ttlSec?

> `optional` **ttlSec?**: `number`

Defined in: [src/lib/LockBaseOptions.ts:22](https://github.com/ayapapa/file-lock-js/blob/17de2828088c860064e647e72109816942d47edf/src/lib/LockBaseOptions.ts#L22)

Lock validity period (time to live)—i.e., the maximum time [seconds] from lock acquisition 
until the callback function completes execution. An error (TTLExceeded) occurs if this period is exceeded.<br>
Cannot be used in conjunction with ttlMs; it is internally converted to ttlMs. Defaults to the default value for ttlMs.

#### Inherited from

`LockBaseOptions.ttlSec`
