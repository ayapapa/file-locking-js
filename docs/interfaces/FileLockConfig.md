[**@ayapapa-npm/file-locking-js**](../api.md)

***

[@ayapapa-npm/file-locking-js](../api.md) / FileLockConfig

# Interface: FileLockConfig

Defined in: [src/lib/FileLockConfig.ts:7](https://github.com/ayapapa/file-lock-js/blob/0bc5a8743c1e3d41d116605b13e69f0885fad553/src/lib/FileLockConfig.ts#L7)

FileLock cofiguration.

## Extends

- `LockBaseConfig`

## Properties

### \_debug?

> `optional` **\_debug?**: `boolean`

Defined in: [src/lib/LockBaseConfig.ts:23](https://github.com/ayapapa/file-lock-js/blob/0bc5a8743c1e3d41d116605b13e69f0885fad553/src/lib/LockBaseConfig.ts#L23)

**`Internal`**

Indicates whether to execute in debug mode.
If `true`, process-related information is added to the lock information file, 
and history tracking is enabled.
This is a debug flag for this class and is intended for use only during development.
However, if an external logger is injected, it cannot be controlled; 
please adjust the log level yourself as necessary.
Default is `false`.

#### Inherited from

`LockBaseConfig._debug`

***

### cache?

> `optional` **cache?**: `boolean`

Defined in: [src/lib/FileLockConfig.ts:22](https://github.com/ayapapa/file-lock-js/blob/0bc5a8743c1e3d41d116605b13e69f0885fad553/src/lib/FileLockConfig.ts#L22)

Whether to enable caching for FileLock instances associated with a key.
Default is `true`.

***

### cacheMaxNum?

> `optional` **cacheMaxNum?**: `number`

Defined in: [src/lib/FileLockConfig.ts:30](https://github.com/ayapapa/file-lock-js/blob/0bc5a8743c1e3d41d116605b13e69f0885fad553/src/lib/FileLockConfig.ts#L30)

Maximum number that can be cached. 
`0` means `cache` is disabled, even if `cache` is true.
Minimum is `0`; if a value lower than this is specified, this minimum value is used.
Default is `100`.

***

### cacheTtlMs?

> `optional` **cacheTtlMs?**: `number`

Defined in: [src/lib/FileLockConfig.ts:36](https://github.com/ayapapa/file-lock-js/blob/0bc5a8743c1e3d41d116605b13e69f0885fad553/src/lib/FileLockConfig.ts#L36)

Cache expiration time (milliseconds). 
Default and minimum `10000`.

***

### defaultOptions?

> `optional` **defaultOptions?**: [`FileLockOptions`](FileLockOptions.md)

Defined in: [src/lib/FileLockConfig.ts:43](https://github.com/ayapapa/file-lock-js/blob/0bc5a8743c1e3d41d116605b13e69f0885fad553/src/lib/FileLockConfig.ts#L43)

Global default options.
These are used as the default values ​​for options specified in `withLock()`.
Default is the return value of `FileLock.getDefaultOptions()`.

***

### history?

> `optional` **history?**: `boolean`

Defined in: [src/lib/FileLockConfig.ts:52](https://github.com/ayapapa/file-lock-js/blob/0bc5a8743c1e3d41d116605b13e69f0885fad553/src/lib/FileLockConfig.ts#L52)

**`Internal`**

Whether to keep a history of lock information. 
This is for debugging.
If `true`, a history of lock information will be appended into a file named `xxxx.json` in the `lock directory`/history/.
Default is `false`.

***

### lockDirectory?

> `optional` **lockDirectory?**: `string` \| `null`

Defined in: [src/lib/FileLockConfig.ts:16](https://github.com/ayapapa/file-lock-js/blob/0bc5a8743c1e3d41d116605b13e69f0885fad553/src/lib/FileLockConfig.ts#L16)

Specifies the directory path to stored locking imformations.
If it has been specified, use this as the top priority.
The directory is determined based on the following order of priority:<br>
 1. Specified via an `Config` (user's explicit intent)
 2. `process.cwd()` (current working directory at runtime)
Note: In cases where the directory is explicitly specified (1 or 2 above), an error occurs if the specified directory does not exist and its creation fails.

***

### logger?

> `optional` **logger?**: [`LogProvider`](../type-aliases/LogProvider.md)

Defined in: [src/lib/LockBaseConfig.ts:11](https://github.com/ayapapa/file-lock-js/blob/0bc5a8743c1e3d41d116605b13e69f0885fad553/src/lib/LockBaseConfig.ts#L11)

External logger. 
Default is `console`.

#### Inherited from

`LockBaseConfig.logger`

***

### maxHistoryEntries?

> `optional` **maxHistoryEntries?**: `number`

Defined in: [src/lib/FileLockConfig.ts:61](https://github.com/ayapapa/file-lock-js/blob/0bc5a8743c1e3d41d116605b13e69f0885fad553/src/lib/FileLockConfig.ts#L61)

Maximum number of history entries to keep. 
This is for debugging.
If the number of entries exceeds this value, the oldest entries will be deleted in order.
Minimum is `0`; if a value lower than this is specified, this minimum value is used.
Default is `100`.

***

### maxHistoryFiles?

> `optional` **maxHistoryFiles?**: `number`

Defined in: [src/lib/FileLockConfig.ts:70](https://github.com/ayapapa/file-lock-js/blob/0bc5a8743c1e3d41d116605b13e69f0885fad553/src/lib/FileLockConfig.ts#L70)

Maximum number of history files to keep. 
This is for debugging.
If the number of entries exceeds this value, the oldest entries will be deleted in order.
Minimum is `0`; if a value lower than this is specified, this minimum value is used.
Default is `100`.
