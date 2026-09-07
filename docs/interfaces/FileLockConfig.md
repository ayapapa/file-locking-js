[**@ayapapa-npm/file-locking-js**](../README.md)

***

[@ayapapa-npm/file-locking-js](../README.md) / FileLockConfig

# Interface: FileLockConfig

Defined in: [src/lib/FileLockConfig.ts:7](https://github.com/ayapapa/file-lock-js/blob/c2ca1ec00e048d334906893918b86c1b9217a12a/src/lib/FileLockConfig.ts#L7)

FileLock cofiguration.

## Extends

- `BaseConfig`

## Properties

### \_debug?

> `optional` **\_debug?**: `boolean`

Defined in: [src/lib/FileLockConfig.ts:66](https://github.com/ayapapa/file-lock-js/blob/c2ca1ec00e048d334906893918b86c1b9217a12a/src/lib/FileLockConfig.ts#L66)

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

Defined in: [src/lib/FileLockConfig.ts:22](https://github.com/ayapapa/file-lock-js/blob/c2ca1ec00e048d334906893918b86c1b9217a12a/src/lib/FileLockConfig.ts#L22)

Whether to enable caching for FileLock instances associated with a key.
Default is `true`.

***

### cacheMaxNum?

> `optional` **cacheMaxNum?**: `number`

Defined in: [src/lib/FileLockConfig.ts:29](https://github.com/ayapapa/file-lock-js/blob/c2ca1ec00e048d334906893918b86c1b9217a12a/src/lib/FileLockConfig.ts#L29)

Maximum number that can be cached. 
`0` means `cache` is disabled, even if `cache` is true.
Default is `100`.

***

### cacheTtlMs?

> `optional` **cacheTtlMs?**: `number`

Defined in: [src/lib/FileLockConfig.ts:35](https://github.com/ayapapa/file-lock-js/blob/c2ca1ec00e048d334906893918b86c1b9217a12a/src/lib/FileLockConfig.ts#L35)

Cache expiration time (milliseconds). 
Default is `50000`. Specifying `0` also results in the default value.

***

### history?

> `optional` **history?**: `boolean`

Defined in: [src/lib/FileLockConfig.ts:48](https://github.com/ayapapa/file-lock-js/blob/c2ca1ec00e048d334906893918b86c1b9217a12a/src/lib/FileLockConfig.ts#L48)

Whether to keep a history of lock information.
If `true`, a history of lock information will be appended into a file named `history.json` in the lock directory.
Default is `false`.

***

### lockDirectory?

> `optional` **lockDirectory?**: `string` \| `null`

Defined in: [src/lib/FileLockConfig.ts:16](https://github.com/ayapapa/file-lock-js/blob/c2ca1ec00e048d334906893918b86c1b9217a12a/src/lib/FileLockConfig.ts#L16)

Specifies the directory path to stored locking imformations.
If it has been specified, use this as the top priority.
The directory is determined based on the following order of priority:<br>
 1. Specified via an `Config` (user's explicit intent)
 2. `process.cwd()` (current working directory at runtime)
Note: In cases where the directory is explicitly specified (1 or 2 above), an error occurs if the specified directory does not exist and its creation fails.

***

### logger?

> `optional` **logger?**: [`LogProvider`](../type-aliases/LogProvider.md)

Defined in: [src/lib/LockBaseConfig.ts:10](https://github.com/ayapapa/file-lock-js/blob/c2ca1ec00e048d334906893918b86c1b9217a12a/src/lib/LockBaseConfig.ts#L10)

External logger. 
Default is `console`.

#### Inherited from

`BaseConfig.logger`

***

### maxHistoryEntries?

> `optional` **maxHistoryEntries?**: `number`

Defined in: [src/lib/FileLockConfig.ts:55](https://github.com/ayapapa/file-lock-js/blob/c2ca1ec00e048d334906893918b86c1b9217a12a/src/lib/FileLockConfig.ts#L55)

Maximum number of history entries to keep.
If the number of entries exceeds this value, the oldest entries will be deleted in order.
Default is `100`.

***

### userDefaultOptions?

> `optional` **userDefaultOptions?**: [`FileLockUserOptions`](FileLockUserOptions.md)

Defined in: [src/lib/FileLockConfig.ts:41](https://github.com/ayapapa/file-lock-js/blob/c2ca1ec00e048d334906893918b86c1b9217a12a/src/lib/FileLockConfig.ts#L41)

User default options used with `withLock()`.
Default is the return value of `FileLock.getDefaultOptions()`..
