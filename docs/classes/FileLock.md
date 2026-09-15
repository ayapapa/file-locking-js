[**@ayapapa-npm/file-locking-js**](../README.md)

***

[@ayapapa-npm/file-locking-js](../README.md) / FileLock

# Class: FileLock

Defined in: [src/lib/FileLock.ts:34](https://github.com/ayapapa/file-lock-js/blob/12d39f106c64c811d3cd9a952cabc5d50e7d7d93/src/lib/FileLock.ts#L34)

File locking. 
Acquires a lock by creating a file derived from the specified key, executes the provided callback, and then releases the lock (by deleting the created file). 
While the file exists, no other lock can be acquired for the same key. 
Settings such as `timeoutMs` allow for waiting until an unreleased lock is freed.

## Extends

- `LockBase`\<`FileLockRequiredOptions`, `FileLockInternalState`\>

## Properties

### \_key

> `protected` **\_key**: `string`

Defined in: [src/lib/LockBase.ts:86](https://github.com/ayapapa/file-lock-js/blob/12d39f106c64c811d3cd9a952cabc5d50e7d7d93/src/lib/LockBase.ts#L86)

**`Internal`**

Lock key

#### Inherited from

`LockBase._key`

***

### \_logger

> `protected` **\_logger**: `Required`\<[`LogProvider`](../type-aliases/LogProvider.md)\>

Defined in: [src/lib/LockBase.ts:80](https://github.com/ayapapa/file-lock-js/blob/12d39f106c64c811d3cd9a952cabc5d50e7d7d93/src/lib/LockBase.ts#L80)

**`Internal`**

Logger.

#### Inherited from

`LockBase._logger`

***

### \_lastOptions

> `protected` `static` **\_lastOptions**: `FileLockRequiredOptions` \| `null` = `null`

Defined in: [src/lib/FileLock.ts:45](https://github.com/ayapapa/file-lock-js/blob/12d39f106c64c811d3cd9a952cabc5d50e7d7d93/src/lib/FileLock.ts#L45)

**`Internal`**

最近使ったオプション(static `withLock()`内で解決されたオプション）を保存する。
本来は、`withLock()`の呼び出しごとに新しいオプションが解決されるため、staticに保存する必要はないが、テストのために保存する。

## Methods

### \_acquire()

> `protected` **\_acquire**(`options`): `Promise`\<`void`\>

Defined in: [src/lib/FileLock.ts:458](https://github.com/ayapapa/file-lock-js/blob/12d39f106c64c811d3cd9a952cabc5d50e7d7d93/src/lib/FileLock.ts#L458)

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

Defined in: [src/lib/FileLock.ts:382](https://github.com/ayapapa/file-lock-js/blob/12d39f106c64c811d3cd9a952cabc5d50e7d7d93/src/lib/FileLock.ts#L382)

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

Defined in: [src/lib/FileLock.ts:368](https://github.com/ayapapa/file-lock-js/blob/12d39f106c64c811d3cd9a952cabc5d50e7d7d93/src/lib/FileLock.ts#L368)

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

Defined in: [src/lib/LockBase.ts:340](https://github.com/ayapapa/file-lock-js/blob/12d39f106c64c811d3cd9a952cabc5d50e7d7d93/src/lib/LockBase.ts#L340)

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

Defined in: [src/lib/LockBase.ts:164](https://github.com/ayapapa/file-lock-js/blob/12d39f106c64c811d3cd9a952cabc5d50e7d7d93/src/lib/LockBase.ts#L164)

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

Defined in: [src/lib/FileLock.ts:407](https://github.com/ayapapa/file-lock-js/blob/12d39f106c64c811d3cd9a952cabc5d50e7d7d93/src/lib/FileLock.ts#L407)

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

Defined in: [src/lib/FileLock.ts:477](https://github.com/ayapapa/file-lock-js/blob/12d39f106c64c811d3cd9a952cabc5d50e7d7d93/src/lib/FileLock.ts#L477)

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

Defined in: [src/lib/LockBase.ts:118](https://github.com/ayapapa/file-lock-js/blob/12d39f106c64c811d3cd9a952cabc5d50e7d7d93/src/lib/LockBase.ts#L118)

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

### \_resolveLogger()

> `protected` `static` **\_resolveLogger**(`config?`): `Required`\<[`LogProvider`](../type-aliases/LogProvider.md)\>

Defined in: [src/lib/LockBase.ts:60](https://github.com/ayapapa/file-lock-js/blob/12d39f106c64c811d3cd9a952cabc5d50e7d7d93/src/lib/LockBase.ts#L60)

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

Defined in: [src/lib/FileLock.ts:179](https://github.com/ayapapa/file-lock-js/blob/12d39f106c64c811d3cd9a952cabc5d50e7d7d93/src/lib/FileLock.ts#L179)

Clear `lock` instance cache.

#### Returns

`void`

***

### getConfig()

> `static` **getConfig**(): `Required`\<[`FileLockConfig`](../interfaces/FileLockConfig.md)\>

Defined in: [src/lib/FileLock.ts:136](https://github.com/ayapapa/file-lock-js/blob/12d39f106c64c811d3cd9a952cabc5d50e7d7d93/src/lib/FileLock.ts#L136)

Get current configurations.

#### Returns

`Required`\<[`FileLockConfig`](../interfaces/FileLockConfig.md)\>

***

### getDefaultConfig()

> `static` **getDefaultConfig**(): `Required`\<[`FileLockConfig`](../interfaces/FileLockConfig.md)\>

Defined in: [src/lib/FileLock.ts:141](https://github.com/ayapapa/file-lock-js/blob/12d39f106c64c811d3cd9a952cabc5d50e7d7d93/src/lib/FileLock.ts#L141)

Get default `Config`.

#### Returns

`Required`\<[`FileLockConfig`](../interfaces/FileLockConfig.md)\>

***

### getDefaultOptions()

> `static` **getDefaultOptions**(): `FileLockRequiredOptions`

Defined in: [src/lib/FileLock.ts:174](https://github.com/ayapapa/file-lock-js/blob/12d39f106c64c811d3cd9a952cabc5d50e7d7d93/src/lib/FileLock.ts#L174)

Get default options(`FileLockOptions`).

#### Returns

`FileLockRequiredOptions`

Deault options.

***

### initialize()

> `static` **initialize**(): `void`

Defined in: [src/lib/FileLock.ts:79](https://github.com/ayapapa/file-lock-js/blob/12d39f106c64c811d3cd9a952cabc5d50e7d7d93/src/lib/FileLock.ts#L79)

Initialize.

#### Returns

`void`

***

### onExit()

> `static` **onExit**(`code`, `signal`): `void`

Defined in: [src/lib/FileLock.ts:191](https://github.com/ayapapa/file-lock-js/blob/12d39f106c64c811d3cd9a952cabc5d50e7d7d93/src/lib/FileLock.ts#L191)

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

Defined in: [src/lib/FileLock.ts:131](https://github.com/ayapapa/file-lock-js/blob/12d39f106c64c811d3cd9a952cabc5d50e7d7d93/src/lib/FileLock.ts#L131)

Reset current configurations.

#### Returns

`void`

***

### setConfig()

> `static` **setConfig**(`config`): `void`

Defined in: [src/lib/FileLock.ts:93](https://github.com/ayapapa/file-lock-js/blob/12d39f106c64c811d3cd9a952cabc5d50e7d7d93/src/lib/FileLock.ts#L93)

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

Defined in: [src/lib/FileLock.ts:155](https://github.com/ayapapa/file-lock-js/blob/12d39f106c64c811d3cd9a952cabc5d50e7d7d93/src/lib/FileLock.ts#L155)

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
