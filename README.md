# file-locking-js
A file-based lock for coordinating exclusive access between processes.
Inspired by existing Node.js file-locking implementations and developed to explore a different API and locking model.


# Interface
  ```js
  const ret = await FileLock.withLock('lock key', () => { 'process to run while locked'; return result; }, options);
  // Of course, you can retrieve return values ​​from the callback function.
  ```

# Installation


# Features
* Enables exclusive execution of "resource access operations" that require serialization across multiple processes.<br>
Examples include "limiting access to a specific service to one instance at a time" or "updating a document without interference from other processes."
* Features a simple and safe user interface. <br>
Users simply call it like this:
  ```js
  const ret = await FileLock.withLock('lock key', () => { 'process to run while locked'; return result; }, options);
  // Of course, you can retrieve return values ​​from the callback function.
  ```
  This eliminates the risk of forgetting to release the lock—a design choice that prioritizes user convenience.
* Prevents deadlocks within the same process.<br>
It uses `AsyncLocalStorage` to detect re-entrant locks on the same key. Consequently, the default configuration (`{allowReentry: false}`) triggers an error upon deadlock detection.<br>
Naturally, re-entrant locking can be enabled via options (`{allowReentry: true}`). In this mode, the operation proceeds without acquiring a new lock for the re-entrant call; however, the user is responsible for ensuring there is no interference with the ongoing operation protected by the initial lock.
* Leverages the robust and well-known `proper-filelock` library to handle the underlying file access synchronization, ensuring reliable inter-process mutual exclusion.
* By storing the lock's `TTL` (time-to-live) and `heartbeat timeout` (the timeout period following operation completion) within the lock file itself, it is possible to verify the lock's validity based on the parameters defined when the lock was acquired.
* Supports caching of created lock instances to reduce performance overhead. Additionally, users can specify a maximum number of cache entries, allowing for a balanced trade-off regarding memory usage.
* Callback function's is able to have a parameter to monitor the lockking statusm like this:
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
  console.log(ret);
  ```


# Configuration

# Options
