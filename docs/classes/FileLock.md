[**@ayapapa-npm/file-locking-js**](../README.md)

***

[@ayapapa-npm/file-locking-js](../README.md) / FileLock

# Class: FileLock

Defined in: [src/lib/FileLock.ts:32](https://github.com/ayapapa/file-lock-js/blob/48bad3c4c8ac737b1d5141ea161a41ea5d8b6432/src/lib/FileLock.ts#L32)

File locking. 
Acquires a lock by creating a file derived from the specified key, executes the provided callback, and then releases the lock (by deleting the created file). 
While the file exists, no other lock can be acquired for the same key. 
Settings such as `timeoutMs` allow for waiting until an unreleased lock is freed.

## Extends

- `LockBase`\<`FileLockRequiredOptions`, `FileLockInternalState`\>

## Properties

### \_key

> `protected` **\_key**: `string`

Defined in: [src/lib/LockBase.ts:128](https://github.com/ayapapa/file-lock-js/blob/48bad3c4c8ac737b1d5141ea161a41ea5d8b6432/src/lib/LockBase.ts#L128)

**`Internal`**

Lock key

#### Inherited from

`LockBase._key`

***

### \_logger

> `protected` **\_logger**: `Required`\<[`LogProvider`](../type-aliases/LogProvider.md)\>

Defined in: [src/lib/LockBase.ts:122](https://github.com/ayapapa/file-lock-js/blob/48bad3c4c8ac737b1d5141ea161a41ea5d8b6432/src/lib/LockBase.ts#L122)

**`Internal`**

Logger.

#### Inherited from

`LockBase._logger`

***

### \_config

> `protected` `static` **\_config**: `Required`\<`LockBaseConfig`\>

Defined in: [src/lib/LockBase.ts:70](https://github.com/ayapapa/file-lock-js/blob/48bad3c4c8ac737b1d5141ea161a41ea5d8b6432/src/lib/LockBase.ts#L70)

#### Inherited from

`LockBase._config`

***

### \_lastOptions

> `protected` `static` **\_lastOptions**: `FileLockRequiredOptions` \| `null` = `null`

Defined in: [src/lib/FileLock.ts:43](https://github.com/ayapapa/file-lock-js/blob/48bad3c4c8ac737b1d5141ea161a41ea5d8b6432/src/lib/FileLock.ts#L43)

**`Internal`**

Store the recently used options (options resolved within the static `withLock()` method). 
Normally, there is no need to store them statically because new options are resolved with each call to `withLock()`, but they are stored here for testing purposes.

***

### \_logger

> `protected` `static` **\_logger**: `Required`\<[`LogProvider`](../type-aliases/LogProvider.md)\>

Defined in: [src/lib/LockBase.ts:72](https://github.com/ayapapa/file-lock-js/blob/48bad3c4c8ac737b1d5141ea161a41ea5d8b6432/src/lib/LockBase.ts#L72)

#### Inherited from

`LockBase._logger`

## Methods

### \_acquire()

> `protected` **\_acquire**(`options`): `Promise`\<`void`\>

Defined in: [src/lib/FileLock.ts:426](https://github.com/ayapapa/file-lock-js/blob/48bad3c4c8ac737b1d5141ea161a41ea5d8b6432/src/lib/FileLock.ts#L426)

**`Internal`**

Acquire the lock. 
In practice, if a lock is already held, wait for it to be released before acquiring the lock. 
Throw an error (exception) if the specified timeout is exceeded.

#### Parameters

##### options

`AllOptions`

Options

#### Returns

`Promise`\<`void`\>

#### Overrides

`LockBase._acquire`

***

### \_decReantryCount()

> `protected` **\_decReantryCount**(`options`): `Promise`\<`void`\>

Defined in: [src/lib/FileLock.ts:361](https://github.com/ayapapa/file-lock-js/blob/48bad3c4c8ac737b1d5141ea161a41ea5d8b6432/src/lib/FileLock.ts#L361)

**`Internal`**

Decrement lock counter.
And, when the counter becomes '0', release lock.

#### Parameters

##### options

`AllOptions`

#### Returns

`Promise`\<`void`\>

#### Overrides

`LockBase._decReantryCount`

***

### \_incReantryCount()

> `protected` **\_incReantryCount**(`options`): `Promise`\<`void`\>

Defined in: [src/lib/FileLock.ts:347](https://github.com/ayapapa/file-lock-js/blob/48bad3c4c8ac737b1d5141ea161a41ea5d8b6432/src/lib/FileLock.ts#L347)

**`Internal`**

Increment lock counter.

#### Parameters

##### options

`AllOptions`

#### Returns

`Promise`\<`void`\>

#### Overrides

`LockBase._incReantryCount`

***

### \_onError()

> `abstract` `protected` **\_onError**(`err`, `operation`, `options`, `codeIfNon?`): `void`

Defined in: [src/lib/LockBase.ts:382](https://github.com/ayapapa/file-lock-js/blob/48bad3c4c8ac737b1d5141ea161a41ea5d8b6432/src/lib/LockBase.ts#L382)

**`Internal`**

Handle errors that occur while locked.

#### Parameters

##### err

`unknown`

##### operation

`string`

##### options

`AllOptions`\<`FileLockRequiredOptions`, `FileLockInternalState`\>

##### codeIfNon?

`string` = `'ELOCK'`

#### Returns

`void`

#### Inherited from

`LockBase._onError`

***

### \_onExit()

> `protected` **\_onExit**(`code`, `signal`): `void`

Defined in: [src/lib/LockBase.ts:206](https://github.com/ayapapa/file-lock-js/blob/48bad3c4c8ac737b1d5141ea161a41ea5d8b6432/src/lib/LockBase.ts#L206)

終了時処理。
Windows版では、強制終了(process.kill())からは呼び出されることは無いが、本実装は残しておく。

#### Parameters

##### code

`number` \| `null` \| `undefined`

##### signal

`Signals` \| `null`

#### Returns

`void`

#### Inherited from

`LockBase._onExit`

***

### \_prepare()

> `protected` **\_prepare**(`options`): `void`

Defined in: [src/lib/FileLock.ts:386](https://github.com/ayapapa/file-lock-js/blob/48bad3c4c8ac737b1d5141ea161a41ea5d8b6432/src/lib/FileLock.ts#L386)

**`Internal`**

Make advance preparations.

#### Parameters

##### options

`AllOptions`

Options

#### Returns

`void`

#### Overrides

`LockBase._prepare`

***

### \_release()

> `protected` **\_release**(`options`): `Promise`\<`void`\>

Defined in: [src/lib/FileLock.ts:455](https://github.com/ayapapa/file-lock-js/blob/48bad3c4c8ac737b1d5141ea161a41ea5d8b6432/src/lib/FileLock.ts#L455)

**`Internal`**

Release lock. <br>
In practice, the counter is decremented, and the lock is released when it reaches zero.

#### Parameters

##### options

`AllOptions`

Options.

#### Returns

`Promise`\<`void`\>

#### Overrides

`LockBase._release`

***

### \_withLock()

> `abstract` `protected` **\_withLock**(`onLockFn`, `options`): `Promise`\<`any`\>

Defined in: [src/lib/LockBase.ts:160](https://github.com/ayapapa/file-lock-js/blob/48bad3c4c8ac737b1d5141ea161a41ea5d8b6432/src/lib/LockBase.ts#L160)

**`Internal`**

Acquires a lock for the specified key,
executes the function `onLockFn` under exclusive control, and returns a Promise that resolves with the return value of `onLockFn` after the lock is released.

#### Parameters

##### onLockFn

[`CallbackOnLock`](../type-aliases/CallbackOnLock.md)

A user-specified callback function to be executed after acquiring the lock.

##### options

`AllOptions`\<`FileLockRequiredOptions`, `FileLockInternalState`\>

Options.

#### Returns

`Promise`\<`any`\>

A `Promise` that resolves with the return value of `onLockFn`.

#### Inherited from

`LockBase._withLock`

***

### \_copyConfig()

> `protected` `static` **\_copyConfig**\<`T`\>(`config`): `T`

Defined in: [src/lib/FileLock.ts:305](https://github.com/ayapapa/file-lock-js/blob/48bad3c4c8ac737b1d5141ea161a41ea5d8b6432/src/lib/FileLock.ts#L305)

**`Internal`**

Copy config.

#### Type Parameters

##### T

`T` *extends* [`FileLockConfig`](../interfaces/FileLockConfig.md)

#### Parameters

##### config

`T`

#### Returns

`T`

#### Overrides

`LockBase._copyConfig`

***

### \_resolveLogger()

> `protected` `static` **\_resolveLogger**(`config?`): `Required`\<[`LogProvider`](../type-aliases/LogProvider.md)\>

Defined in: [src/lib/LockBase.ts:102](https://github.com/ayapapa/file-lock-js/blob/48bad3c4c8ac737b1d5141ea161a41ea5d8b6432/src/lib/LockBase.ts#L102)

**`Internal`**

#### Parameters

##### config?

`LockBaseConfig`

#### Returns

`Required`\<[`LogProvider`](../type-aliases/LogProvider.md)\>

全てのメソッドが必須のロガー

#### Inherited from

`LockBase._resolveLogger`

***

### clearCache()

> `static` **clearCache**(): `void`

Defined in: [src/lib/FileLock.ts:162](https://github.com/ayapapa/file-lock-js/blob/48bad3c4c8ac737b1d5141ea161a41ea5d8b6432/src/lib/FileLock.ts#L162)

Clear `lock` instance cache.

#### Returns

`void`

***

### getConfig()

> `static` **getConfig**(): `Required`\<[`FileLockConfig`](../interfaces/FileLockConfig.md)\>

Defined in: [src/lib/FileLock.ts:119](https://github.com/ayapapa/file-lock-js/blob/48bad3c4c8ac737b1d5141ea161a41ea5d8b6432/src/lib/FileLock.ts#L119)

Get current configurations.

#### Returns

`Required`\<[`FileLockConfig`](../interfaces/FileLockConfig.md)\>

***

### getDefaultConfig()

> `static` **getDefaultConfig**(): `Required`\<[`FileLockConfig`](../interfaces/FileLockConfig.md)\>

Defined in: [src/lib/FileLock.ts:124](https://github.com/ayapapa/file-lock-js/blob/48bad3c4c8ac737b1d5141ea161a41ea5d8b6432/src/lib/FileLock.ts#L124)

Get default `Config`.

#### Returns

`Required`\<[`FileLockConfig`](../interfaces/FileLockConfig.md)\>

***

### getDefaultOptions()

> `static` **getDefaultOptions**(): `FileLockRequiredOptions`

Defined in: [src/lib/FileLock.ts:157](https://github.com/ayapapa/file-lock-js/blob/48bad3c4c8ac737b1d5141ea161a41ea5d8b6432/src/lib/FileLock.ts#L157)

Get default options(`FileLockOptions`).

#### Returns

`FileLockRequiredOptions`

Deault options.

***

### initialize()

> `static` **initialize**(): `void`

Defined in: [src/lib/FileLock.ts:63](https://github.com/ayapapa/file-lock-js/blob/48bad3c4c8ac737b1d5141ea161a41ea5d8b6432/src/lib/FileLock.ts#L63)

Initialize.

#### Returns

`void`

***

### onExit()

> `static` **onExit**(`code`, `signal`): `void`

Defined in: [src/lib/FileLock.ts:174](https://github.com/ayapapa/file-lock-js/blob/48bad3c4c8ac737b1d5141ea161a41ea5d8b6432/src/lib/FileLock.ts#L174)

**`Internal`**

Termination processing. 
On Windows, this is not called upon forced termination (process.kill()), but the implementation is retained.

#### Parameters

##### code

`number` \| `null` \| `undefined`

##### signal

`Signals` \| `null`

#### Returns

`void`

***

### resetConfig()

> `static` **resetConfig**(): `void`

Defined in: [src/lib/FileLock.ts:114](https://github.com/ayapapa/file-lock-js/blob/48bad3c4c8ac737b1d5141ea161a41ea5d8b6432/src/lib/FileLock.ts#L114)

Reset current configurations.

#### Returns

`void`

***

### setConfig()

> `static` **setConfig**(`config`): `void`

Defined in: [src/lib/FileLock.ts:77](https://github.com/ayapapa/file-lock-js/blob/48bad3c4c8ac737b1d5141ea161a41ea5d8b6432/src/lib/FileLock.ts#L77)

Set configurations.<br>
Overwrite part of the current settings. 
At the same time, the cache is cleared.

#### Parameters

##### config

[`FileLockConfig`](../interfaces/FileLockConfig.md)

#### Returns

`void`

#### Overrides

`LockBase.setConfig`

***

### withLock()

> `static` **withLock**(`key`, `onLockFn`, `options?`): `Promise`\<`any`\>

Defined in: [src/lib/FileLock.ts:138](https://github.com/ayapapa/file-lock-js/blob/48bad3c4c8ac737b1d5141ea161a41ea5d8b6432/src/lib/FileLock.ts#L138)

Acquires a lock for the specified key, executes the function `onLockFn` under exclusive control, 
and returns a Promise that resolves with the return value of `onLockFn` after the lock is released.

#### Parameters

##### key

`string`

Lock key.

##### onLockFn

[`CallbackOnLock`](../type-aliases/CallbackOnLock.md)

Callback function to execute while the lock is held.
                 Both synchronous and asynchronous functions can be specified.

##### options?

[`FileLockOptions`](../interfaces/FileLockOptions.md) = `{}`

Options

#### Returns

`Promise`\<`any`\>

A Promise that resolves with the return value of onLockFn.
