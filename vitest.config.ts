/**
 * Serializes the execution order of test files. 
 * Reason: Includes tests that could interfere with each other.
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    fileParallelism: false,
  },
})
