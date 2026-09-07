[**@ayapapa-npm/file-locking-js**](../README.md)

***

[@ayapapa-npm/file-locking-js](../README.md) / FileLock

# Class: FileLock

Defined in: [src/lib/FileLock.ts:66](https://github.com/ayapapa/file-lock-js/blob/280ed101887cb488a682db8709ac88743dfafc1a/src/lib/FileLock.ts#L66)

File locking. 
Acquires a lock by creating a file derived from the specified key, executes the provided callback, and then releases the lock (by deleting the created file). 
While the file exists, no other lock can be acquired for the same key. 
Settings such as `timeoutMs` allow for waiting until an unreleased lock is freed.

## Extends

- `LockBase`\<[`FileLockUserOptions`](../interfaces/FileLockUserOptions.md), `FileLockInternalState`\>

## Properties

### \_key

> `protected` **\_key**: `string`

Defined in: [src/lib/LockBase.ts:99](https://github.com/ayapapa/file-lock-js/blob/280ed101887cb488a682db8709ac88743dfafc1a/src/lib/LockBase.ts#L99)

**`Internal`**

Lock key

#### Inherited from

`LockBase._key`

***

### \_logger

> `protected` **\_logger**: `Required`\<[`LogProvider`](../type-aliases/LogProvider.md)\>

Defined in: [src/lib/LockBase.ts:93](https://github.com/ayapapa/file-lock-js/blob/280ed101887cb488a682db8709ac88743dfafc1a/src/lib/LockBase.ts#L93)

**`Internal`**

Logger.

#### Inherited from

`LockBase._logger`

***

### \_defaultAllowReentry

> `protected` `readonly` `static` **\_defaultAllowReentry**: `false` = `false`

Defined in: [src/lib/LockBase.ts:46](https://github.com/ayapapa/file-lock-js/blob/280ed101887cb488a682db8709ac88743dfafc1a/src/lib/LockBase.ts#L46)

**`Internal`**

#### Inherited from

`LockBase._defaultAllowReentry`

***

### \_defaultTimeoutMs

> `protected` `readonly` `static` **\_defaultTimeoutMs**: `5000` = `5000`

Defined in: [src/lib/LockBase.ts:52](https://github.com/ayapapa/file-lock-js/blob/280ed101887cb488a682db8709ac88743dfafc1a/src/lib/LockBase.ts#L52)

**`Internal`**

#### Inherited from

`LockBase._defaultTimeoutMs`

***

### \_defaultTtlMs

> `protected` `readonly` `static` **\_defaultTtlMs**: `10000` = `10000`

Defined in: [src/lib/LockBase.ts:58](https://github.com/ayapapa/file-lock-js/blob/280ed101887cb488a682db8709ac88743dfafc1a/src/lib/LockBase.ts#L58)

**`Internal`**

#### Inherited from

`LockBase._defaultTtlMs`

***

### \_lastOptions

> `static` **\_lastOptions**: `AllOptions` \| `null` = `null`

Defined in: [src/lib/FileLock.ts:77](https://github.com/ayapapa/file-lock-js/blob/280ed101887cb488a682db8709ac88743dfafc1a/src/lib/FileLock.ts#L77)

**`Internal`**

最近使ったオプション(static `withLock()`内で解決されたオプション）を保存する。
本来は、`withLock()`の呼び出しごとに新しいオプションが解決されるため、staticに保存する必要はないが、テストのために保存する。

## Methods

### \_decReantryCount()

> `protected` **\_decReantryCount**(`options`): `void`

Defined in: [src/lib/FileLock.ts:477](https://github.com/ayapapa/file-lock-js/blob/280ed101887cb488a682db8709ac88743dfafc1a/src/lib/FileLock.ts#L477)

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

Defined in: [src/lib/FileLock.ts:463](https://github.com/ayapapa/file-lock-js/blob/280ed101887cb488a682db8709ac88743dfafc1a/src/lib/FileLock.ts#L463)

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

Defined in: [src/lib/LockBase.ts:213](https://github.com/ayapapa/file-lock-js/blob/280ed101887cb488a682db8709ac88743dfafc1a/src/lib/LockBase.ts#L213)

**`Internal`**

Handle errors that occur while locked.

#### Parameters

##### err

`unknown`

##### operation

`string`

##### options

`AllOptions`\<[`FileLockUserOptions`](../interfaces/FileLockUserOptions.md), `FileLockInternalState`\>

##### codeIfNon?

`string` = `'ELOCK'`

#### Returns

`void`

#### Inherited from

`LockBase._onError`

***

### \_prepare()

> `protected` **\_prepare**(`options`): `void`

Defined in: [src/lib/FileLock.ts:500](https://github.com/ayapapa/file-lock-js/blob/280ed101887cb488a682db8709ac88743dfafc1a/src/lib/FileLock.ts#L500)

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

### \_withLock()

> `abstract` `protected` **\_withLock**(`onLockFn`, `execWithLock`, `options`): `Promise`\<`any`\>

Defined in: [src/lib/LockBase.ts:136](https://github.com/ayapapa/file-lock-js/blob/280ed101887cb488a682db8709ac88743dfafc1a/src/lib/LockBase.ts#L136)

**`Internal`**

Acquires a lock for the specified key,
executes the function `onLockFn` under exclusive control, and returns a Promise that resolves with the return value of `onLockFn` after the lock is released.

#### Parameters

##### onLockFn

[`CallbackOnLock`](../type-aliases/CallbackOnLock.md)

A user-specified callback function to be executed after acquiring the lock.

##### execWithLock

(`cb`, `opt`) => `any`

The callback function that actually executes `withLock`.

##### options

`AllOptions`\<[`FileLockUserOptions`](../interfaces/FileLockUserOptions.md), `FileLockInternalState`\>

Options.

#### Returns

`Promise`\<`any`\>

A `Promise` that resolves with the return value of `onLockFn`.

#### Inherited from

`LockBase._withLock`

***

### clearCache()

> `static` **clearCache**(): `void`

Defined in: [src/lib/FileLock.ts:289](https://github.com/ayapapa/file-lock-js/blob/280ed101887cb488a682db8709ac88743dfafc1a/src/lib/FileLock.ts#L289)

Clear `lock` instance cache.

#### Returns

`void`

***

### getConfig()

> `static` **getConfig**(): `Required`\<[`Config`](../interfaces/Config.md)\>

Defined in: [src/lib/FileLock.ts:234](https://github.com/ayapapa/file-lock-js/blob/280ed101887cb488a682db8709ac88743dfafc1a/src/lib/FileLock.ts#L234)

Get current `Config`.

#### Returns

`Required`\<[`Config`](../interfaces/Config.md)\>

***

### getDefaultConfig()

> `static` **getDefaultConfig**(): `Required`\<[`Config`](../interfaces/Config.md)\>

Defined in: [src/lib/FileLock.ts:239](https://github.com/ayapapa/file-lock-js/blob/280ed101887cb488a682db8709ac88743dfafc1a/src/lib/FileLock.ts#L239)

Get default `Config`.

#### Returns

`Required`\<[`Config`](../interfaces/Config.md)\>

***

### getDefaultOptions()

> `static` **getDefaultOptions**(): [`FileLockUserOptions`](../interfaces/FileLockUserOptions.md)

Defined in: [src/lib/FileLock.ts:276](https://github.com/ayapapa/file-lock-js/blob/280ed101887cb488a682db8709ac88743dfafc1a/src/lib/FileLock.ts#L276)

Get default options(`FileLockUserOptions`).

#### Returns

[`FileLockUserOptions`](../interfaces/FileLockUserOptions.md)

Deault options.

#### Overrides

`LockBase.getDefaultOptions`

***

### initialize()

> `static` **initialize**(): `void`

Defined in: [src/lib/FileLock.ts:184](https://github.com/ayapapa/file-lock-js/blob/280ed101887cb488a682db8709ac88743dfafc1a/src/lib/FileLock.ts#L184)

Initialize.

#### Returns

`void`

***

### resetConfig()

> `static` **resetConfig**(): `void`

Defined in: [src/lib/FileLock.ts:229](https://github.com/ayapapa/file-lock-js/blob/280ed101887cb488a682db8709ac88743dfafc1a/src/lib/FileLock.ts#L229)

Reset `Config`.

#### Returns

`void`

***

### setConfig()

> `static` **setConfig**(`config`): `void`

Defined in: [src/lib/FileLock.ts:197](https://github.com/ayapapa/file-lock-js/blob/280ed101887cb488a682db8709ac88743dfafc1a/src/lib/FileLock.ts#L197)

Set `Config`.  現在設定の一部を書き換えると説明せよ！ see PrettyCOndole.
At the same time, the cache is cleared.

#### Parameters

##### config

[`Config`](../interfaces/Config.md)

#### Returns

`void`

***

### withLock()

> `static` **withLock**(`key`, `onLockFn`, `options?`): `Promise`\<`any`\>

Defined in: [src/lib/FileLock.ts:263](https://github.com/ayapapa/file-lock-js/blob/280ed101887cb488a682db8709ac88743dfafc1a/src/lib/FileLock.ts#L263)

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

[`FileLockUserOptions`](../interfaces/FileLockUserOptions.md) = `{}`

Options

#### Returns

`Promise`\<`any`\>

A Promise that resolves with the return value of onLockFn.
