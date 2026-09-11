[**@ayapapa-npm/file-locking-js**](../README.md)

***

[@ayapapa-npm/file-locking-js](../README.md) / FileLock

# Class: FileLock

Defined in: [src/lib/FileLock.ts:33](https://github.com/ayapapa/file-lock-js/blob/1d136e4eb21053ab0d72e2ff353008400511d532/src/lib/FileLock.ts#L33)

File locking. 
Acquires a lock by creating a file derived from the specified key, executes the provided callback, and then releases the lock (by deleting the created file). 
While the file exists, no other lock can be acquired for the same key. 
Settings such as `timeoutMs` allow for waiting until an unreleased lock is freed.

## Extends

- `LockBase`\<`FileLockRequiredOptions`, `FileLockInternalState`\>

## Properties

### \_key

> `protected` **\_key**: `string`

Defined in: [src/lib/LockBase.ts:78](https://github.com/ayapapa/file-lock-js/blob/1d136e4eb21053ab0d72e2ff353008400511d532/src/lib/LockBase.ts#L78)

**`Internal`**

Lock key

#### Inherited from

`LockBase._key`

***

### \_logger

> `protected` **\_logger**: `Required`\<[`LogProvider`](../type-aliases/LogProvider.md)\>

Defined in: [src/lib/LockBase.ts:72](https://github.com/ayapapa/file-lock-js/blob/1d136e4eb21053ab0d72e2ff353008400511d532/src/lib/LockBase.ts#L72)

**`Internal`**

Logger.

#### Inherited from

`LockBase._logger`

***

### \_lastOptions

> `protected` `static` **\_lastOptions**: `FileLockRequiredOptions` \| `null` = `null`

Defined in: [src/lib/FileLock.ts:44](https://github.com/ayapapa/file-lock-js/blob/1d136e4eb21053ab0d72e2ff353008400511d532/src/lib/FileLock.ts#L44)

**`Internal`**

最近使ったオプション(static `withLock()`内で解決されたオプション）を保存する。
本来は、`withLock()`の呼び出しごとに新しいオプションが解決されるため、staticに保存する必要はないが、テストのために保存する。

## Methods

### \_acquire()

> `protected` **\_acquire**(`options`): `Promise`\<`void`\>

Defined in: [src/lib/FileLock.ts:420](https://github.com/ayapapa/file-lock-js/blob/1d136e4eb21053ab0d72e2ff353008400511d532/src/lib/FileLock.ts#L420)

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

> `protected` **\_decReantryCount**(`options`): `void`

Defined in: [src/lib/FileLock.ts:358](https://github.com/ayapapa/file-lock-js/blob/1d136e4eb21053ab0d72e2ff353008400511d532/src/lib/FileLock.ts#L358)

**`Internal`**

Decrement lock counter.
And, when the counter becomes '0', release lock.

#### Parameters

##### options

`AllOptions`

#### Returns

`void`

#### Overrides

`LockBase._decReantryCount`

***

### \_incReantryCount()

> `protected` **\_incReantryCount**(`options`): `void`

Defined in: [src/lib/FileLock.ts:344](https://github.com/ayapapa/file-lock-js/blob/1d136e4eb21053ab0d72e2ff353008400511d532/src/lib/FileLock.ts#L344)

**`Internal`**

Increment lock counter.

#### Parameters

##### options

`AllOptions`

#### Returns

`void`

#### Overrides

`LockBase._incReantryCount`

***

### \_onError()

> `abstract` `protected` **\_onError**(`err`, `operation`, `options`, `codeIfNon?`): `void`

Defined in: [src/lib/LockBase.ts:275](https://github.com/ayapapa/file-lock-js/blob/1d136e4eb21053ab0d72e2ff353008400511d532/src/lib/LockBase.ts#L275)

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

Defined in: [src/lib/LockBase.ts:89](https://github.com/ayapapa/file-lock-js/blob/1d136e4eb21053ab0d72e2ff353008400511d532/src/lib/LockBase.ts#L89)

強制終了

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

Defined in: [src/lib/FileLock.ts:382](https://github.com/ayapapa/file-lock-js/blob/1d136e4eb21053ab0d72e2ff353008400511d532/src/lib/FileLock.ts#L382)

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

> `protected` **\_release**(`options`): `void`

Defined in: [src/lib/FileLock.ts:452](https://github.com/ayapapa/file-lock-js/blob/1d136e4eb21053ab0d72e2ff353008400511d532/src/lib/FileLock.ts#L452)

**`Internal`**

Release lock. <br>
In practice, the counter is decremented, and the lock is released when it reaches zero.

#### Parameters

##### options

`AllOptions`

Options.

#### Returns

`void`

#### Overrides

`LockBase._release`

***

### \_withLock()

> `abstract` `protected` **\_withLock**(`onLockFn`, `options`): `Promise`\<`any`\>

Defined in: [src/lib/LockBase.ts:125](https://github.com/ayapapa/file-lock-js/blob/1d136e4eb21053ab0d72e2ff353008400511d532/src/lib/LockBase.ts#L125)

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

### clearCache()

> `static` **clearCache**(): `void`

Defined in: [src/lib/FileLock.ts:170](https://github.com/ayapapa/file-lock-js/blob/1d136e4eb21053ab0d72e2ff353008400511d532/src/lib/FileLock.ts#L170)

Clear `lock` instance cache.

#### Returns

`void`

***

### getConfig()

> `static` **getConfig**(): `Required`\<[`FileLockConfig`](../interfaces/FileLockConfig.md)\>

Defined in: [src/lib/FileLock.ts:127](https://github.com/ayapapa/file-lock-js/blob/1d136e4eb21053ab0d72e2ff353008400511d532/src/lib/FileLock.ts#L127)

Get current configurations.

#### Returns

`Required`\<[`FileLockConfig`](../interfaces/FileLockConfig.md)\>

***

### getDefaultConfig()

> `static` **getDefaultConfig**(): `Required`\<[`FileLockConfig`](../interfaces/FileLockConfig.md)\>

Defined in: [src/lib/FileLock.ts:132](https://github.com/ayapapa/file-lock-js/blob/1d136e4eb21053ab0d72e2ff353008400511d532/src/lib/FileLock.ts#L132)

Get default `Config`.

#### Returns

`Required`\<[`FileLockConfig`](../interfaces/FileLockConfig.md)\>

***

### getDefaultOptions()

> `static` **getDefaultOptions**(): `FileLockRequiredOptions`

Defined in: [src/lib/FileLock.ts:165](https://github.com/ayapapa/file-lock-js/blob/1d136e4eb21053ab0d72e2ff353008400511d532/src/lib/FileLock.ts#L165)

Get default options(`FileLockOptions`).

#### Returns

`FileLockRequiredOptions`

Deault options.

***

### initialize()

> `static` **initialize**(): `void`

Defined in: [src/lib/FileLock.ts:73](https://github.com/ayapapa/file-lock-js/blob/1d136e4eb21053ab0d72e2ff353008400511d532/src/lib/FileLock.ts#L73)

Initialize.

#### Returns

`void`

***

### onExit()

> `static` **onExit**(`code`, `signal`): `void`

Defined in: [src/lib/FileLock.ts:865](https://github.com/ayapapa/file-lock-js/blob/1d136e4eb21053ab0d72e2ff353008400511d532/src/lib/FileLock.ts#L865)

**`Internal`**

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

Defined in: [src/lib/FileLock.ts:122](https://github.com/ayapapa/file-lock-js/blob/1d136e4eb21053ab0d72e2ff353008400511d532/src/lib/FileLock.ts#L122)

Reset current configurations.

#### Returns

`void`

***

### setConfig()

> `static` **setConfig**(`config`): `void`

Defined in: [src/lib/FileLock.ts:87](https://github.com/ayapapa/file-lock-js/blob/1d136e4eb21053ab0d72e2ff353008400511d532/src/lib/FileLock.ts#L87)

Set configurations.<br>
現在設定の一部を書き換えると説明せよ！ see PrettyCOndole.
At the same time, the cache is cleared.

#### Parameters

##### config

[`FileLockConfig`](../interfaces/FileLockConfig.md)

#### Returns

`void`

***

### withLock()

> `static` **withLock**(`key`, `onLockFn`, `options?`): `Promise`\<`any`\>

Defined in: [src/lib/FileLock.ts:146](https://github.com/ayapapa/file-lock-js/blob/1d136e4eb21053ab0d72e2ff353008400511d532/src/lib/FileLock.ts#L146)

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
