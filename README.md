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
| `lock key`        | A key used to apply a lock. When multiple operations use the same key, they are executed sequentially.　|  | 
| `lock directory`  | The directory where `lock file`s are stored. | `lock file`, [Configurations](#configurations) |
| `lock file`       | It is associated with the specified `lock key` and stores information related to the lock owner, the actual expiration time, and so forth.<br>For example, if the `lock key` is "key001", a file named "key001.json" is created under the `lock directory` and deleted when the lock is released.<br>As long as this file exists, the key is considered to be locked. | `lock key`, `lock directory` |
| `re-entrant lock` | A lock that allows the same owner to acquire it multiple times without blocking itself. Enable this behavior with `{ allowReentry: true }`.<br>It prevents `self-deadlock` when the same owner acquires the same lock again.<br>It does not prevent `circular deadlocks` between different owners. | `deadlock`, `allowReentry` in [Options](#options) |
| `deadlock` | It is a state where operations cannot proceed because they keep waiting.<br>A `self-deadlock` is caused by reacquiring the same lock, while `circular deadlock` is caused by different owners waiting on each other.<br>Due to the timeout setting, it will not wait indefinitely; however, this results in a lock acquisition error. | `re-entrant lock`, `timeourMs` or `timeoutSec` in [Options](#options) |


## API Reference
[API document](https://github.com/ayapapa/file-locking-js/blob/main/docs/api.md)

## Installation
```bash
npm install @ayapapa-npm/file-locking-js
```

## Features
* **`Key`-based locking system.** <br>
Internally, it creates a `File` associated with the specified `Key` within a directory defined in the `Config`; once the `Callback` associated with that `Key` completes execution, the file is deleted. If a request is made for a lock using the same `Key` while that file still exists—indicating the lock is active—the system waits for the lock to be released (i.e., for the file to be deleted) before proceeding with the operation.
* **Features a simple and safe user interface.** <br>
Users simply call it like this:
  ```js
  const ret = await FileLock.withLock('lock key', () => { 'process to run while locked'; return result; }, options);
  // Of course, you can retrieve return values ​​from the callback function.
  ```
  This eliminates the risk of forgetting to release the lock—a design choice that prioritizes user convenience.
* **Prevents self-deadlocks within the same process.**<br>
It uses `AsyncLocalStorage` to detect re-entrant locks on the same key. Consequently, the default configuration (`{allowReentry: false}`) triggers an error upon deadlock detection.<br>
Naturally, re-entrant locking can be enabled via options (`{allowReentry: true}`). In this mode, the operation proceeds without acquiring a new lock for the re-entrant call; however, the user is responsible for ensuring there is no interference with the ongoing operation protected by the initial lock.
* **Stricter lock validity check** <br>
By storing the lock's `TTL` (time-to-live) and `heartbeat timeout` (the timeout period following operation completion) within the lock file itself, it is possible to verify the lock's validity based on the parameters defined when the lock was acquired.
* **Supports caching of created lock instances to reduce performance overhead.**<br>
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

## Options

## Errors
| Class name | Overview  | Message | Other properties | How to handle the situation, etc.|
| --------------- | ------------ | ----------------- | ---------------- | ------------- |
| LockCompromised | Corruption of lock file contents | The lock was compromised during the locking process. | { code: 'ECOMPROMISED', key: '(`lock key`)'path: '(Path to `lock file`)' } | Check for and delete the lock file (specified by `path`). Before deletion, ensure that no process is holding the file.[^1]
| LockFileBroken | Corruption of lock file contents | When checking whether a lock for the same key is already held, the contents of the existing lock file were found to be corrupted, making it impossible to determine the lock status. Please verify that the target process does not exist and delete the lock file if necessary. | { code: 'EBROKEN', path: '(Path to `lock file`)' } | Check for and delete the lock file (specified by `path`). Before deletion, ensure that no process is holding the file.[^2]
| ReleaseFailed | Failure to release the lock or decrement the lock counter | Processing is interrupted because the lock release or lock counter decrement failed. Additionally, please manually delete any remaining files or directories, such as lock files or shared lock information. | { code: 'ERELEASE', key: '(`lock key`)' } | Possible causes include intentional modification of the lock file by another process, file system corruption, or insufficient disk space. In the former case, take the same action as for `LockFileBroken`. In the latter case, check the system status. Additionally, manually delete the `path` and `sharer` entries associated with the error after confirming that no owning process exists for them [^1]. Alternatively, you may simply wait for them to be automatically deleted once specific time intervals (such as `ttlMs`, `heartbeatTtlMs`, or `invalidTtlMs`) have elapsed. |

[^1]: Although FileLock is designed to maintain a consistent `lock file` during normal operation, it cannot prevent other processes that do not use FileLock from accessing the lock file. If the execution of such processes is anticipated, it is recommended to avoid conflicts by changing the `lock directory`.

[^2]: Although FileLock is designed to maintain a consistent lock file during normal operation, a corrupted lock file may remain due to events such as the forced termination of a process; therefore, it is recommended to delete the file only after confirming that no other locking processes are active.




というわけで、話を戻して、FileLockだけど、まずは、壊れたファイルは、リトライしまくって、ロックできなかったという実装までを目指すよ。そして、テストもそのように書く。そして、次の段階で、オプションでそのようなファイルの対処法指定しるために、「invalidTtlMs」なるものを導入した実装にすすもうと思う。[^2]


[^3]: 破損したロックファイルの自動削除は、実行中のロック所有者が存在しないことを保証するものではありません。設定する場合は、ユーザーの責任において適切な値を指定してください。（参考：invalidLockFileTimeoutMs は、heartbeatTtlMs を主な参考値として、利用環境に応じて設定してください）　⇒　最小値は、heartbeatTtlMsだろうなぁ。

## ストレステスト
テストでは、100プロセス同実行（全同キー、全別キー）にて正常、または、想定通りのエラーですべて終了することを確認していますが、これを保証するものではありません。
### ストレステスト実行環境： 
#### オペレーティングシステム
```
エディション	Windows 11 Home
バージョン	25H2
インストール日	2024/12/16
OS ビルド	26200.9457
エクスペリエンス	Windows 機能エクスペリエンス パック 1000.26100.360.0
```
#### デバイス情報
```
プロセッサ	Intel(R) Core(TM) i5-8500 CPU @ 3.00GHz (3.00 GHz)
実装 RAM	16.0 GB
グラフィックス カード	NVIDIA GeForce GTX 1080 (8 GB)
ストレージ	使用領域 1.15 TB / 2.34 TB
システムの種類	64 ビット オペレーティング システム、x64 ベース プロセッサ
```

## Examples
(under construction)

