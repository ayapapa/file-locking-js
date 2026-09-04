[**@ayapapa-npm/file-locking-js**](../README.md)

***

[@ayapapa-npm/file-locking-js](../README.md) / Config

# Interface: Config

Defined in: src/lib/FileLockConfig.ts:7

FileLock cofiguration.

## Extends

- `BaseConfig`

## Properties

### \_debug?

> `optional` **\_debug?**: `boolean`

Defined in: src/lib/FileLockConfig.ts:66

**`Internal`**

Indicates whether to execute in debug mode.
If `true`, process-related information is added to the lock information file, 
and history tracking is enabled.
This is a debug flag for this class and is intended for use only during development.
However, if an external logger is injected, it cannot be controlled; 
please adjust the log level yourself as necessary.

***

### cache?

> `optional` **cache?**: `boolean`

Defined in: src/lib/FileLockConfig.ts:22

Whether to enable caching for FileLock instances associated with a key.
Default is `true`.

***

### cacheMaxNum?

> `optional` **cacheMaxNum?**: `number`

Defined in: src/lib/FileLockConfig.ts:29

Maximum number that can be cached. 
`0` means `cache` is disabled, even if `cache` is true.
Default is `100`.

***

### cacheTtlMs?

> `optional` **cacheTtlMs?**: `number`

Defined in: src/lib/FileLockConfig.ts:35

Cache expiration time (milliseconds). 
Default is `50000`.

***

### history?

> `optional` **history?**: `boolean`

Defined in: src/lib/FileLockConfig.ts:48

Whether to keep a history of lock information.
If set to `true`, a history of lock information will be saved in a file named `history.json` in the lock directory.
Default is `false`.

***

### lockDirectory?

> `optional` **lockDirectory?**: `string` \| `null`

Defined in: src/lib/FileLockConfig.ts:16

Specifies the directory path to stored locking imformations.
If it has been specified, use this as the top priority.
The directory is determined based on the following order of priority:<br>
 1. Specified via an `Config` (user's explicit intent)
 2. `process.cwd()` (current working directory at runtime)
Note: In cases where the directory is explicitly specified (1 or 2 above), an error occurs if the specified directory does not exist and its creation fails.

***

### logger?

> `optional` **logger?**: [`LogProvider`](../type-aliases/LogProvider.md)

Defined in: src/lib/LockBaseConfig.ts:10

External logger. 
Default is `console`.

#### Inherited from

`BaseConfig.logger`

***

### maxHistoryEntries?

> `optional` **maxHistoryEntries?**: `number`

Defined in: src/lib/FileLockConfig.ts:55

Maximum number of history entries to keep.
If the number of entries exceeds this value, the oldest entries will be deleted in order.
Default is `100`.

***

### userDefaultOptions?

> `optional` **userDefaultOptions?**: [`FileLockUserOptions`](FileLockUserOptions.md)

Defined in: src/lib/FileLockConfig.ts:41

User default options used with `withLock()`.
Default is the return value of `FileLock.getDefaultOptions()`..
