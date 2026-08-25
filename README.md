# file-locking-js
A file-based locking utility designed to coordinate exclusive access across processes, threads, and asynchronous tasks within a thread. <br>

Inspired by existing Node.js file-locking implementations and developed to explore a different API and locking model.<br>

It enables the exclusive execution of operations—such as "resource access"—that require serialization across multiple processes.<br>
Examples include limiting access to a specific service to a single process or thread at a time, or updating a document without interference from other processes.

# Installation
```bash
npm install @ayapapa-npm/file-locking-js
```

# Features
* **From a user interface perspective, this is a `Key`-based locking system.** <br>
Internally, it creates a `File` associated with the specified `Key` within a directory defined in the `Config`; once the `Callback` associated with that `Key` completes execution, the file is deleted. If a request is made for a lock using the same `Key` while that file still exists—indicating the lock is active—the system waits for the lock to be released (i.e., for the file to be deleted) before proceeding with the operation.
* **A highly reliable and user-friendly mechanism for inter-process mutual exclusion.**<br>
This implementation leverages the robust and widely used `proper-filelock` library as the foundation for its locking mechanism. <br>
Specifically, it uses the library to lock a file that stores lock information, releasing the lock once the callback function—intended to run while the lock is held—has completed. The introduction of this lock-information file enables several key features, resulting in a highly reliable and user-friendly mechanism for inter-process mutual exclusion.
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
  **Note: It is not mandatory to interrupt the process when monitor.cancelled is true.**


# Configuration


# Options


# Usage
  ```js
  const defaultOptions = FileLock.getDefaultOptions();
  defaultOptions.timeoutMs  = 2000;
  defaultOptions.ttlMs      = 2000;
  heartbeatIntervalMs       = 500;
  heartbeatTimeoutMs        = 5000;
  
  FileLock.setConfig({ 
    lockDirectory: "Specify the directory path where the file containing lock information is stored.",
    defaultOptions
  }};

  const ret = await FileLock.withLock(
    "Specify the lock key.", 
    () => { // Callback function to execute while locked
      "Describes the operations to be performed while the lock is held.";
      return "Specify the results if any.";
    },
    { ttlMs: 5000 } // Overrides the default options set via FileLock.SetConfig().
  );
  console.log(ret); // "Specify the results if any.";
  ```

