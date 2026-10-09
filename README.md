[![CI](https://github.com/ayapapa/file-locking-js/actions/workflows/ci.yml/badge.svg)](https://github.com/ayapapa/file-locking-js/actions/workflows/ci.yml)
![Coverage](https://raw.githubusercontent.com/ayapapa/file-locking-js/main/badges/coverage-total.svg)
![Branches](https://raw.githubusercontent.com/ayapapa/file-locking-js/main/badges/coverage-branches.svg)
![Functions](https://raw.githubusercontent.com/ayapapa/file-locking-js/main/badges/coverage-functions.svg)
![Lines](https://raw.githubusercontent.com/ayapapa/file-locking-js/main/badges/coverage-lines.svg)
![Statements](https://raw.githubusercontent.com/ayapapa/file-locking-js/main/badges/coverage-statements.svg)

## Table of contents
[Overview](#overview) | [API Reference](#api-reference) | [Installation](#installation) | [Usage](#usage) | [Configurations](#configurations) | [Options](#options) | [Errors](#errors) | [Examples](#examples)

# file-locking-js

## Overview
A file-based locking utility designed to coordinate exclusive access across processes, threads, and asynchronous tasks within a thread. <br>

Inspired by existing Node.js file-locking implementations and developed to explore a different API and locking model.<br>

It enables the exclusive execution of operations—such as "resource access"—that require serialization across multiple processes.<br>
Examples include limiting access to a specific service to a single process or thread at a time, or updating a document without interference from other processes.

## Definitions of Terms
|        Term     |  Explanation  |  See also  |
| --------------- | ------------- | -------------|
| `lock key`        | A key used to apply a lock. When multiple operations use the same key, they are executed sequentially.　| `lock file`, `temporary lock file`, `lock sharers` | 
| `lock directory`  | The directory where `lock file`s are stored. | `lock file`, [Configurations](#configurations) |
| `lock file`       | It is associated with the specified `lock key` and stores information related to the lock owner, the actual expiration time, and so forth. <br>For example, if the `lock key` is "key001", a file named "key001.json" is created under the `lock directory` and deleted when the lock is released. <br>As long as this file exists, the key is considered to be locked. | `lock key`, `lock directory` |
| `temporary lock file` | A file created temporarily during the initial write and subsequent updates of the `lock file`. <br>For example, if the `lock key` is "key001", a file named "key001.json.tmp" is created under the `lock directory`.  <br>After this file is created, the `lock file` is updated atomically using `fs.renameSync` (renaming the `temporary lock file` to the `lock file`). | `lock file` |
| `lock sharers` | A directory that records the IDs assigned to each `FileLock.withLock(key, ...)` invocation. <br>It stores the  and the IDs of reentrant invocations that are allowed to share the lock. <br>In this library, reentrant locking is implemented by adding IDs to this directory instead of incrementing a lock counter. <br>For example, if the `lock key` is "key001", this directory is created under the `lock directory` with the name "key001.sharer". | `lock key`, `lock file` |
| `re-entrant lock` | A lock that allows the same owner to acquire it multiple times without blocking itself. Enable this behavior with `{ allowReentry: true }`. <br>It prevents `self-deadlock` when the same owner acquires the same lock again. <br>It does not prevent `circular deadlocks` between different owners. | `deadlock`, `allowReentry` in [Options](#options) |
| `deadlock` | It is a state where operations cannot proceed because they keep waiting. <br>A `self-deadlock` is caused by reacquiring the same lock, while `circular deadlock` is caused by different owners waiting on each other.<br>Due to the timeout setting, it will not wait indefinitely; however, this results in a lock acquisition error. | `re-entrant lock`, `timeourMs` or `timeoutSec` in [Options](#options) |

### `lock directory` structure 
```
`lock directory`
  ├── `lock key`.json
  ├── `lock key`.json.tmp
  └── `lock key`.sharer
        ├── `(ID of the initial lock-owning invocation)`
        ├── `(ID of allowed to share the first lock)`
        ├── `(ID of allowed to share the second lock)`
        :
        :
```

## API Reference
[API document](https://github.com/ayapapa/file-locking-js/blob/main/docs/api.md)

## Installation
```bash
npm install @ayapapa-npm/file-locking-js
```

## Features
* **`Key`-based locking system.** <br>
  Internally, it creates a `lock file`, that is a file associated with the specified `lock key`,  within `lock directory`, that is a directory defined in the  [configrations](#configurations); once the `callback` associated with that `lock key` completes execution, the file is deleted. If a request is made for a lock using the same `lock key` while that file still exists—indicating the lock is active—the system waits for the lock to be released (i.e., for the file to be deleted) before proceeding with the operation.
* **Features a simple and safe user interface.** <br>
  Users simply call it like this:
  ```js
  const ret = await FileLock.withLock('lock key', () => { 'process to run while locked'; return result; }, options);
  // ret === result
  ```
  This eliminates the risk of forgetting to release the lock—a design choice that prioritizes user convenience.
* **Prevents self-deadlocks within the same process.**<br>
  It uses `AsyncLocalStorage` to detect re-entrant locks on the same key. Consequently, the default configuration (`{allowReentry: false}`) triggers an error upon deadlock detection.<br>
  Naturally, re-entrant locking can be enabled via options (`{allowReentry: true}`). In this mode, the operation proceeds without acquiring a new lock for the re-entrant call; however, the user is responsible for ensuring there is no interference with the ongoing operation protected by the initial lock.
* **Stricter lock validity check** <br>
  By storing information about the expiration dates of locks and heartbeats in the `lock file` itself, it is possible to verify the lock's validity based on the parameters defined when the lock was acquired.
* **Supports caching of created lock instances to reduce both temporal and spatial overhead.**<br>
  The lock instance is managed by associating it with the `lock key`.
  Additionally, users can specify a maximum number of cache entries, allowing for a balanced trade-off regarding memory usage.
* **Callback functions is able to have a parameter to monitor the locking status**, like this:
  ```js
  const ret = await FileLock.withLock(
    'lock key',
    (monitor) => {
      let completed = false;
      while(completed === false) {
        if (monitor.cancelled) return 'The operation is cancelled.'
        const result = (some processing);
        if (`result means completed.`) completed = true;
      };
      return 'The operation is completed.';
    }, 
    options
  );
  console.log(ret); // "The operation is completed."
  ```
  Note1: It is not mandatory to interrupt the process when monitor.cancelled is true.<br>
  Note2: If `options.allowReentry` is true and a reentrant lock is acquired, the `monitor` passed to the initial lock operation (callback) is shared with the subsequent one.

## Usage
  ```js
  // Specify `lock directory`.
  // If not specified, `${process.cwd()}/.lock` is used as the `lock directory`. 
  FileLock.setConfig({ 
    lockDirectory: "Specify the directory path where the file containing lock information is stored.",
  });

  const ret = await FileLock.withLock(
    "Specify the lock key.", 
    () => { // Callback function to execute while locked
      "Describes the operations to be performed while the lock is held.";
      return "Specify the results if any.";
    },
  );
  console.log(ret); // "Specify the results if any."
  ```

## Configurations
| Name | Type | Default and Min | Description | Notes |
|---|---|---:|---|---|
| `cache` | `boolean` | `true` N/A | Enables caching of `FileLock` instances by key. | Set to `false` to disable caching. |
| `cacheMaxNum` | `number` | `100` `0` | Maximum number of cached instances. | If set to `0`, caching is effectively disabled even when `cache` is `true`. Values below `0` are treated as `0`. |
| `cacheTtlMs` | `number` | `10000` `10000` | Cache expiration time in milliseconds. | Values below `10000` use `10000`. |
| `defaultOptions` | `FileLockOptions` | `default options` [^defaultOptions] N/A | Global default options used by `withLock()`. | Applied when options are not explicitly specified in `withLock()`. |
| `lockDirectory` | `string \| null` | `process.cwd()` N/A | Directory used to store lock information. | If specified, this value takes highest priority. If the directory does not exist and cannot be created, an error is thrown. |
| `logger` | `LogProvider` | `console` N/A | External logger instance. | Must provide `log`, `trace`, `debug`, `info`, `warn`, and `error`. `fatal` is optional. |
| `_debug` | `boolean` | `false` N/A | Enables debug mode for this class. | Internal use. When `true`, process-related information is added to the lock info file and history tracking is enabled. |
| `history` | `boolean` | `false` N/A | Enables lock information history. | Internal debug option. When `true`, history is appended to `xxxx.json` files under `lockDirectory/history/`. |
| `maxHistoryEntries` | `number` | `100` `0` | Maximum number of history entries to retain. | If exceeded, the oldest entries are removed first. Values below `0` are treated as `0`. |
| `maxHistoryFiles` | `number` | `100` `0` | Maximum number of history files to retain. | If exceeded, the oldest files are removed first. Values below `0` are treated as `0`. |

> Note:
> `_debug` and `history` are internal debugging options and are not intended for normal production use.

[^defaultOptions]: You can obtain it using FileLock.getDefaultConfig().

## Options
| Name | Type | Default and Min | Description | Notes |
|---|---|---:|---|---|
| `allowReentry` | `boolean` | `false` N/A | Allows re-entering the same lock key within the same process. | Use with care.[^allowReentry] |
| `heartbeatIntervalMs` | `number` | `1000` `1000` | Heartbeat update interval in milliseconds while the lock is held. | Cannot be used with `heartbeatIntervalSec`. Values below `1000` are treated as `1000`. |
| `heartbeatIntervalSec` | `number` | Same as `heartbeatIntervalMs` | Heartbeat update interval in seconds while the lock is held. | Cannot be used with `heartbeatIntervalMs`. Internally converted to `heartbeatIntervalMs`. |
| `heartbeatTtlMs` | `number` | `5000` `2000` | Heartbeat validity period in milliseconds. | If the last update is within this period, the process is considered alive. Cannot be used with `heartbeatTtlSec`. Values below `2000` are treated as `2000`. |
| `heartbeatTtlSec` | `number` | Same as `heartbeatTtlMs` | Heartbeat validity period in seconds. | Cannot be used with `heartbeatTtlMs`. Internally converted to `heartbeatTtlMs`. |
| `invalidTtlSec` | `number` | Same as `invalidTtlMs` | Expiration period in seconds for invalid lock files and related items. | Cannot be used with `invalidTtlMs`. Internally converted to `invalidTtlMs`. |
| `invalidTtlMs` | `number` | `Unspecified` `heartbeatTtlMs` | Expiration period in milliseconds for invalid lock files and related items. | If not specified, forced deletion is disabled. Cannot be used with `invalidTtlSec`. Values below `heartbeatTtlMs` are treated as `heartbeatTtlMs`.[^invalidLockFile] |
| `pollIntervalMs` | `number` | `100` `100` | Polling interval in milliseconds while waiting for the lock. | Cannot be used with `pollIntervalSec`. `0` also falls back to the default value. Values below `100` are treated as `100`. |
| `pollIntervalSec` | `number` | Same as `pollIntervalMs` | Polling interval in seconds while waiting for the lock. | Cannot be used with `pollIntervalMs`. Internally converted to `pollIntervalMs`. |
| `retriesOnIOErr` | `number` | `1` `0` | Number of retries for lock file operations after I/O errors. | Values below `0` are treated as `0`. |
| `retryIntervalMs` | `number` | `100` `100` | Retry interval in milliseconds after I/O errors. | Cannot be used with `retryIntervalSec`. Values below `100` are treated as `100`. |
| `retryIntervalSec` | `number` | Same as `retryIntervalMs` | Retry interval in seconds after I/O errors. | Cannot be used with `retryIntervalMs`. Internally converted to `retryIntervalMs`. |
| `timeoutMs` | `number` | `5000` `0` | Maximum time to wait for acquiring the lock, in milliseconds. | Cannot be used with `timeoutSec`. `0` means no waiting. Values below `0` are treated as `0`. |
| `timeoutSec` | `number` | Same as `timeoutMs` | Maximum time to wait for acquiring the lock, in seconds. | Cannot be used with `timeoutMs`. Internally converted to `timeoutMs`. |
| `ttlMs` | `number` | `5000` `1000` | Lock time to live in milliseconds. | If execution exceeds this period, `TTLExceeded` is thrown. Cannot be used with `ttlSec`. Values below `1000` are treated as `1000`. |
| `ttlSec` | `number` | Same as `ttlMs` | Lock time to live in seconds. | Cannot be used with `ttlMs`. Internally converted to `ttlMs`. |

[^allowReentry]:
    Controls behavior when the current process attempts to acquire a lock using a key that it already holds. <br>
    The default is `false`. In that case, re-entrant locking is prohibited, and a `DeadlockDetected` error is thrown immediately when such a case is detected. <br>
    If set to `true`, the same process can call `withLock()` again with the same key. In that case, the lock is not acquired again at the file level. Instead, an internal counter is incremented. <br>
    This is useful for recursive calls or wrapper functions that may re-enter the same locked section. <br>
    However, enabling this option can allow operations protected by the same key to overlap logically within the same process. If those operations read from or write to the same shared resource, such as memory, files, or caches, the resulting state may become inconsistent. <br>
    Use this option only when re-entry is known to be safe, such as for read-only processing or idempotent operations.

[^invalidLockFile]: The automatic deletion of invalid lock files—triggered by specifying `invalidTtlMs` or `invalidTtlSec`—does not guarantee that there is no active lock owner. It is the user's responsibility to specify appropriate values ​​when configuring these settings. Please determine the values ​​for `invalidTtlMs` or `invalidTtlSec` by taking into account `ttlMs` and `heartbeatTtlMs` as primary reference points (including any adjustments to those values ​​themselves) and considering your specific operating environment.

## Errors

| Class name | Overview  | Message | Other key properties | How to handle the situation, etc.|
| --------------- | ------------ | ----------------- | ---------------- | ------------- |
| AlreadyLocked | Found a `lock file` | Lock file already exists. | { code: 'EALREADYLOCKED', key: '(`lock key`), reason: 'ExistingLock' }  | 同じ`lock key`のロック処理が未完了であるため、[Options](#options)の`timeoutMs`を調整することを推奨する。 |
| AlreadyLocked | Found a `lock file` ongoing update | Lock file already exists and may still be updating. | { code: 'EALREADYLOCKED', key: '(`lock key`), reason: 'Updating' }  | 同じ`lock key`のロック処理が未完了であるため、[Options](#options)の`timeoutMs`を調整することを推奨する。 |
| AlreadyLocked | Found a `lock file` ongoing initialization | Lock file already exists and may still be initializing. | { code: 'EALREADYLOCKED', key: '(`lock key`), reason: 'Initializing' }  | 何度もこのエラーが継続する場合は、[Options](#options)の`invalidTtlMs`を使用するか、手動で`lock file`の削除を行う。[^handleWithCare2] |
| AlreadyLocked | Found an invalid `lock file` | Lock file already exists, but its metadata is invalid. | { code: 'EALREADYLOCKED', key: '(`lock key`), reason: 'InvalidMetadata' }  | 何度もこのエラーが継続する場合は、[Options](#options)の`invalidTtlMs`を使用するか、手動で`lock file`の削除を行う。[^handleWithCare2] |
| AlreadyLocked | Found an `lock file`, but couldn't read it. | The lock file already exists, but its validity could not be determined due to an I/O error. | { code: 'EALREADYLOCKED', key: '(`lock key`), reason: 'MetadataReadError' }  | 何度もこのエラーが継続する場合は、[Options](#options)の`invalidTtlMs`を使用するか、手動で`lock file`の削除を行う。[^handleWithCare2] |
| DeadlockDetected | Detected a `self-deadlock` | A deadlock was detected. | { code: 'EDEADLK', key: '(`lock key`) } | [Options](#options)の`allowReentry`を使用する([^allowReentry])か、ロジックの変更によりデッドロックを解消する。 |
| InvalidOptions | Found invalid option | The value of the specified options('option name') is invalid. | { code: 'EINVAL', name: '(option name)' } | Modification it to valid value. |
| TTLExceeded | Lock processing time limit exceeded | The maximum processing time('ttlMs' milliseconds) while locked has been exceeded. | { code: 'ETTLEXCEEDED', key: '(`lock key`)', ttlMs: '(`Options.ttlMs`)' } | [Options](#options)の`ttlMs`を調整する。 |
| LockCompromised | Corruption of lock file contents | The lock was compromised during the locking process. | { code: 'ECOMPROMISED', key: '(`lock key`) } | Check for and delete the lock file (specified by `path`). Before deletion, ensure that no process is holding the file.[^handleWithCare1]
| ReleaseFailed | Failure to release the lock or decrement the lock counter | Processing is interrupted because the lock release or lock counter decrement failed. | { code: 'ERELEASE', key: '(`lock key`)' } | Possible causes include intentional modification of the lock file by another process, file system corruption, or insufficient disk space. In the former case, take the same action as for `LockFileBroken`. In the latter case, check the system status. Additionally, manually delete the `path` and `sharer` entries associated with the error after confirming that no owning process exists for them.[^handleWithCare1] Alternatively, you may simply wait for them to be automatically deleted once specific time intervals (such as `ttlMs`, `heartbeatTtlMs`, or `invalidTtlMs`) have elapsed. |

[^handleWithCare1]: Although FileLock is designed to maintain a consistent `lock file` during normal operation, it cannot prevent other processes that do not use FileLock from accessing the lock file. If the execution of such processes is anticipated, it is recommended to avoid conflicts by changing the `lock directory`.(see also [Configurations](#configurations))

[^handleWithCare2]: Events such as the forced termination of a process may leave behind corrupted lock files. In such cases, after verifying that no other locking operations are in progress, please delete files and directories such as `lock file`, `temporary lock file`, and `lock sharers`.

## Stress test
Test results confirmed that when 100 processes were executed simultaneously—whether using the same key across all processes or unique keys for each—the operations either completed successfully or terminated with the expected errors, leaving no `lock file` or other intermediate files behind. However, this does not guarantee identical behavior in all environments. The environment used for the stress test is as follows:


### Stress test execution environment: 

#### Operating system
```
Edition	Windows 11 Home
Version	25H2
Installation date	2024/12/16
OS build	26200.9457
Experience	Windows Feature Experience Pack 1000.26100.360.0
```

#### Device Information

```
Processor	Intel(R) Core(TM) i5-8500 CPU @ 3.00GHz (3.00 GHz)
Installed RAM	16.0 GB
Graphics Card	NVIDIA GeForce GTX 1080 (8 GB)
Storage	Used space 1.15 TB / 2.34 TB
System Type	64-bit operating system, x64-based processor
```

## Examples
(under construction)

