/**
 * The execution order of test files is serialized for the following reason:
 *  - As part of the `FileLock.setConfig()` test, the specified lock directory—or 
 *    `.lock` in the runtime directory if no lock directory is specified—is forcibly deleted; 
 *    this can leave the file locking mechanism itself in a compromised state
 *   (i.e., the file expected to store lock information is missing).
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    fileParallelism: false,
  },
})
