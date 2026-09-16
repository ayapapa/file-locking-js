[**@ayapapa-npm/file-locking-js**](../README.md)

***

[@ayapapa-npm/file-locking-js](../README.md) / FileLock

# Class: FileLock

Defined in: [src/lib/FileLock.ts:33](https://github.com/ayapapa/file-lock-js/blob/20bba882daae6c4bbf5ce396a325ea44f5b5fc8e/src/lib/FileLock.ts#L33)

File locking. 
Acquires a lock by creating a file derived from the specified key, executes the provided callback, and then releases the lock (by deleting the created file). 
While the file exists, no other lock can be acquired for the same key. 
Settings such as `timeoutMs` allow for waiting until an unreleased lock is freed.

## Extends

- `LockBase`\<`FileLockRequiredOptions`, `FileLockInternalState`\>

## Properties

### \_key

> `protected` **\_key**: `string`

Defined in: [src/lib/LockBase.ts:118](https://github.com/ayapapa/file-lock-js/blob/20bba882daae6c4bbf5ce396a325ea44f5b5fc8e/src/lib/LockBase.ts#L118)

**`Internal`**

Lock key

#### Inherited from

`LockBase._key`

***

### \_logger

> `protected` **\_logger**: `Required`\<[`LogProvider`](../type-aliases/LogProvider.md)\>

Defined in: [src/lib/LockBase.ts:112](https://github.com/ayapapa/file-lock-js/blob/20bba882daae6c4bbf5ce396a325ea44f5b5fc8e/src/lib/LockBase.ts#L112)

**`Internal`**

Logger.

#### Inherited from

`LockBase._logger`

***

### \_config

> `protected` `static` **\_config**: `Required`\<`LockBaseConfig`\>

Defined in: [src/lib/LockBase.ts:69](https://github.com/ayapapa/file-lock-js/blob/20bba882daae6c4bbf5ce396a325ea44f5b5fc8e/src/lib/LockBase.ts#L69)

#### Inherited from

`LockBase._config`

***

### \_lastOptions

> `protected` `static` **\_lastOptions**: `FileLockRequiredOptions` \| `null` = `null`

Defined in: [src/lib/FileLock.ts:44](https://github.com/ayapapa/file-lock-js/blob/20bba882daae6c4bbf5ce396a325ea44f5b5fc8e/src/lib/FileLock.ts#L44)

**`Internal`**

最近使ったオプション(static `withLock()`内で解決されたオプション）を保存する。
本来は、`withLock()`の呼び出しごとに新しいオプションが解決されるため、staticに保存する必要はないが、テストのために保存する。

***

### \_logger

> `protected` `static` **\_logger**: `Required`\<[`LogProvider`](../type-aliases/LogProvider.md)\>

Defined in: [src/lib/LockBase.ts:71](https://github.com/ayapapa/file-lock-js/blob/20bba882daae6c4bbf5ce396a325ea44f5b5fc8e/src/lib/LockBase.ts#L71)

#### Inherited from

`LockBase._logger`

## Methods

### \_acquire()

> `protected` **\_acquire**(`options`): `Promise`\<`void`\>

Defined in: [src/lib/FileLock.ts:452](https://github.com/ayapapa/file-lock-js/blob/20bba882daae6c4bbf5ce396a325ea44f5b5fc8e/src/lib/FileLock.ts#L452)

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

Defined in: [src/lib/FileLock.ts:376](https://github.com/ayapapa/file-lock-js/blob/20bba882daae6c4bbf5ce396a325ea44f5b5fc8e/src/lib/FileLock.ts#L376)

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

Defined in: [src/lib/FileLock.ts:362](https://github.com/ayapapa/file-lock-js/blob/20bba882daae6c4bbf5ce396a325ea44f5b5fc8e/src/lib/FileLock.ts#L362)

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

Defined in: [src/lib/LockBase.ts:372](https://github.com/ayapapa/file-lock-js/blob/20bba882daae6c4bbf5ce396a325ea44f5b5fc8e/src/lib/LockBase.ts#L372)

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

Defined in: [src/lib/LockBase.ts:196](https://github.com/ayapapa/file-lock-js/blob/20bba882daae6c4bbf5ce396a325ea44f5b5fc8e/src/lib/LockBase.ts#L196)

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

Defined in: [src/lib/FileLock.ts:401](https://github.com/ayapapa/file-lock-js/blob/20bba882daae6c4bbf5ce396a325ea44f5b5fc8e/src/lib/FileLock.ts#L401)

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

Defined in: [src/lib/FileLock.ts:481](https://github.com/ayapapa/file-lock-js/blob/20bba882daae6c4bbf5ce396a325ea44f5b5fc8e/src/lib/FileLock.ts#L481)

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

Defined in: [src/lib/LockBase.ts:150](https://github.com/ayapapa/file-lock-js/blob/20bba882daae6c4bbf5ce396a325ea44f5b5fc8e/src/lib/LockBase.ts#L150)

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

Defined in: [src/lib/FileLock.ts:320](https://github.com/ayapapa/file-lock-js/blob/20bba882daae6c4bbf5ce396a325ea44f5b5fc8e/src/lib/FileLock.ts#L320)

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

Defined in: [src/lib/LockBase.ts:92](https://github.com/ayapapa/file-lock-js/blob/20bba882daae6c4bbf5ce396a325ea44f5b5fc8e/src/lib/LockBase.ts#L92)

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

Defined in: [src/lib/FileLock.ts:177](https://github.com/ayapapa/file-lock-js/blob/20bba882daae6c4bbf5ce396a325ea44f5b5fc8e/src/lib/FileLock.ts#L177)

Clear `lock` instance cache.

#### Returns

`void`

***

### getConfig()

> `static` **getConfig**(): `Required`\<[`FileLockConfig`](../interfaces/FileLockConfig.md)\>

Defined in: [src/lib/FileLock.ts:134](https://github.com/ayapapa/file-lock-js/blob/20bba882daae6c4bbf5ce396a325ea44f5b5fc8e/src/lib/FileLock.ts#L134)

Get current configurations.

#### Returns

`Required`\<[`FileLockConfig`](../interfaces/FileLockConfig.md)\>

***

### getDefaultConfig()

> `static` **getDefaultConfig**(): `Required`\<[`FileLockConfig`](../interfaces/FileLockConfig.md)\>

Defined in: [src/lib/FileLock.ts:139](https://github.com/ayapapa/file-lock-js/blob/20bba882daae6c4bbf5ce396a325ea44f5b5fc8e/src/lib/FileLock.ts#L139)

Get default `Config`.

#### Returns

`Required`\<[`FileLockConfig`](../interfaces/FileLockConfig.md)\>

***

### getDefaultOptions()

> `static` **getDefaultOptions**(): `FileLockRequiredOptions`

Defined in: [src/lib/FileLock.ts:172](https://github.com/ayapapa/file-lock-js/blob/20bba882daae6c4bbf5ce396a325ea44f5b5fc8e/src/lib/FileLock.ts#L172)

Get default options(`FileLockOptions`).

#### Returns

`FileLockRequiredOptions`

Deault options.

***

### initialize()

> `static` **initialize**(): `void`

Defined in: [src/lib/FileLock.ts:78](https://github.com/ayapapa/file-lock-js/blob/20bba882daae6c4bbf5ce396a325ea44f5b5fc8e/src/lib/FileLock.ts#L78)

Initialize.

#### Returns

`void`

***

### onExit()

> `static` **onExit**(`code`, `signal`): `void`

Defined in: [src/lib/FileLock.ts:189](https://github.com/ayapapa/file-lock-js/blob/20bba882daae6c4bbf5ce396a325ea44f5b5fc8e/src/lib/FileLock.ts#L189)

**`Internal`**

終了時処理。
Windows版では、強制終了(process.kill())からは呼び出されることは無いが、本実装は残しておく。

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

Defined in: [src/lib/FileLock.ts:129](https://github.com/ayapapa/file-lock-js/blob/20bba882daae6c4bbf5ce396a325ea44f5b5fc8e/src/lib/FileLock.ts#L129)

Reset current configurations.

#### Returns

`void`

***

### setConfig()

> `static` **setConfig**(`config`): `void`

Defined in: [src/lib/FileLock.ts:92](https://github.com/ayapapa/file-lock-js/blob/20bba882daae6c4bbf5ce396a325ea44f5b5fc8e/src/lib/FileLock.ts#L92)

Set configurations.<br>
現在設定の一部を書き換えると説明せよ！ see PrettyCOndole.
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

Defined in: [src/lib/FileLock.ts:153](https://github.com/ayapapa/file-lock-js/blob/20bba882daae6c4bbf5ce396a325ea44f5b5fc8e/src/lib/FileLock.ts#L153)

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
