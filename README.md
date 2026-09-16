[![CI](https://github.com/ayapapa/file-locking-js/actions/workflows/ci.yml/badge.svg)](https://github.com/ayapapa/file-locking-js/actions/workflows/ci.yml)
![Coverage](https://raw.githubusercontent.com/ayapapa/file-locking-js/main/badges/coverage-total.svg)
![Branches](https://raw.githubusercontent.com/ayapapa/file-locking-js/main/badges/coverage-branches.svg)
![Functions](https://raw.githubusercontent.com/ayapapa/file-locking-js/main/badges/coverage-functions.svg)
![Lines](https://raw.githubusercontent.com/ayapapa/file-locking-js/main/badges/coverage-lines.svg)
![Statements](https://raw.githubusercontent.com/ayapapa/file-locking-js/main/badges/coverage-statements.svg)

## Table of contents
[Overview](#overview) | [API Reference](#api-reference) | [Installation](#installation) | [Usage](#usage)

# file-locking-js

## Overview
A file-based locking utility designed to coordinate exclusive access across processes, threads, and asynchronous tasks within a thread. <br>

Inspired by existing Node.js file-locking implementations and developed to explore a different API and locking model.<br>

It enables the exclusive execution of operations—such as "resource access"—that require serialization across multiple processes.<br>
Examples include limiting access to a specific service to a single process or thread at a time, or updating a document without interference from other processes.

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
* **Prevents deadlocks within the same process.**<br>
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
  console.log(ret); // "The operation is completed.";
  ```
  Note1: It is not mandatory to interrupt the process when monitor.cancelled is true.<br>
  Note2: If `options.allowReentry` is true and a reentrant lock is acquired, the `monitor` passed to the initial lock operation (callback) is shared with the subsequent one.

## Usage
  ```js
  // Global default options (if necessary)
  const defaultOptions = FileLock.getDefaultOptions();
  defaultOptions.timeoutMs  = 2000;
  defaultOptions.ttlMs      = 2000;
  heartbeatIntervalMs       = 500;
  heartbeatTimeoutMs        = 5000;
  
  FileLock.setConfig({ 
    lockDirectory: "Specify the directory path where the file containing lock information is stored.",
    defaultOptions // Global default options, if necessary.
  }};

  const options = { ttlMs: 5000 };

  const ret = await FileLock.withLock(
    "Specify the lock key.", 
    () => { // Callback function to execute while locked
      "Describes the operations to be performed while the lock is held.";
      return "Specify the results if any.";
    },
    options // Overrides the global default options set via FileLock.SetConfig().
  );
  console.log(ret); // "Specify the results if any.";
  ```

## Examples
(under construction)


## エラー
| エラークラス名 | エラー内容  | エラーメッセージ | その他プロパティ | 対処方法など |
| --------------- | ------------ | ----------------- | ---------------- | ------------- |
| LockFileBroken | ロックファイル内容の破損 | ロックファイルの内容が破損しており、ロック状態を判定できません。対象プロセスが存在しないことを確認したうえで、必要ならロックファイルを手動で削除してください。 | { code: 'EBROKEN', file: '(ロックファイルパス)' } | ロックファイル(pathは、`file`)の確認と削除。削除する場合は、そのファイルをつかんでいるプロセスが無いことを確認すること。[^1]

[^1]: FileLockは通常の利用において一貫したロックファイルを維持するよう設計しているが、プロセスの強制終了等により破損したロックファイルが残る可能性があるため、他のロックプロセスが生きていないことを確認してから削除することを推奨する。




というわけで、話を戻して、FileLockだけど、まずは、壊れたファイルは、リトライしまくって、ロックできなかったという実装までを目指すよ。そして、テストもそのように書く。そして、次の段階で、オプションでそのようなファイルの対処法指定しるために、「invalidLockFileTimeoutMs」なるものを導入した実装にすすもうと思う。


破損したロックファイルの自動削除は、実行中のロック所有者が存在しないことを保証するものではありません。設定する場合は、ユーザーの責任において適切な値を指定してください。

invalidLockFileTimeoutMs は、heartbeatTimeoutMs を主な参考値として、利用環境に応じて設定してください　⇒　最小値は、heartbeatTimeoutMsだろうなぁ。

