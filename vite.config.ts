import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts', // Match tsup's src/index.ts
      formats: ['es', 'cjs'], // Match --format esm,cjs
      fileName: (format) => format === 'cjs' ? 'index.cjs' : 'index.js',
    },
    outDir: 'dist', // Match　--out-dir dist 
    // For type definitions (--dts), `vite-plugin-dts` is required,
    // so you need to add the plugin configuration.
  },
  // Write settings to disable only in the test environment here.
  test: {
    // File patterns to exclude
    exclude: [...configDefaults.exclude, 'e2e/*'],
    
    // Coverage measurement settings
    coverage: {
      provider: 'v8', // 'istanbul'
      reporter: ['text', 'text-summary', 'json-summary', 'json', 'html'],
      include: ['src/**/*.{ts,tsx,js,jsx}'],
      exclude: ['test/FileLockTestCommon.ts'],
    },
    
    // Root directory
    root: '.',
  },
})
