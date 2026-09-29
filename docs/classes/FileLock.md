[**@ayapapa-npm/file-locking-js**](../README.md)

***

[@ayapapa-npm/file-locking-js](../README.md) / FileLock

# Class: FileLock

Defined in: [src/lib/FileLock.ts:38](https://github.com/ayapapa/file-lock-js/blob/f9a40a1b2ec3ab0e592341c32a88ba338912db56/src/lib/FileLock.ts#L38)

File locking. 
Acquires a lock by creating a file derived from the specified key, executes the provided callback, and then releases the lock (by deleting the created file). 
While the file exists, no other lock can be acquired for the same key. 
Settings such as `timeoutMs` allow for waiting until an unreleased lock is freed.

## Extends

- `LockBase`\<`FileLockAllOptions`, `FileLockInternalState`\>

## Properties

### \_acquired

> `protected` **\_acquired**: `boolean` = `false`

Defined in: [src/lib/LockBase.ts:178](https://github.com/ayapapa/file-lock-js/blob/f9a40a1b2ec3ab0e592341c32a88ba338912db56/src/lib/LockBase.ts#L178)

**`Internal`**

Whether or not a lock is acquired.

#### Inherited from

`LockBase._acquired`

***

### \_key

> `protected` **\_key**: `string`

Defined in: [src/lib/LockBase.ts:172](https://github.com/ayapapa/file-lock-js/blob/f9a40a1b2ec3ab0e592341c32a88ba338912db56/src/lib/LockBase.ts#L172)

**`Internal`**

Lock key

#### Inherited from

`LockBase._key`

***

### \_logger

> `protected` **\_logger**: `Required`\<[`LogProvider`](../type-aliases/LogProvider.md)\>

Defined in: [src/lib/LockBase.ts:166](https://github.com/ayapapa/file-lock-js/blob/f9a40a1b2ec3ab0e592341c32a88ba338912db56/src/lib/LockBase.ts#L166)

**`Internal`**

Logger.

#### Inherited from

`LockBase._logger`

***

### \_ownerId

> `protected` **\_ownerId**: `string`

Defined in: [src/lib/LockBase.ts:184](https://github.com/ayapapa/file-lock-js/blob/f9a40a1b2ec3ab0e592341c32a88ba338912db56/src/lib/LockBase.ts#L184)

**`Internal`**

Lock owner ID to be stored in the lock file.

#### Inherited from

`LockBase._ownerId`

***

### \_config

> `protected` `static` **\_config**: `Required`\<`LockBaseConfig`\>

Defined in: [src/lib/LockBase.ts:50](https://github.com/ayapapa/file-lock-js/blob/f9a40a1b2ec3ab0e592341c32a88ba338912db56/src/lib/LockBase.ts#L50)

**`Internal`**

Current basic configurations.

#### Inherited from

`LockBase._config`

***

### \_lastOptions

> `protected` `static` **\_lastOptions**: `FileLockRequiredOptions` \| `null` = `null`

Defined in: [src/lib/FileLock.ts:49](https://github.com/ayapapa/file-lock-js/blob/f9a40a1b2ec3ab0e592341c32a88ba338912db56/src/lib/FileLock.ts#L49)

**`Internal`**

Store the recently used options (options resolved within the static `withLock()` method). 
Normally, there is no need to store them statically because new options are resolved with each call to `withLock()`, but they are stored here for testing purposes.

***

### \_logger

> `protected` `static` **\_logger**: `Required`\<[`LogProvider`](../type-aliases/LogProvider.md)\>

Defined in: [src/lib/LockBase.ts:56](https://github.com/ayapapa/file-lock-js/blob/f9a40a1b2ec3ab0e592341c32a88ba338912db56/src/lib/LockBase.ts#L56)

**`Internal`**

Logger.

#### Inherited from

`LockBase._logger`

## Methods

### \_acquire()

> `protected` **\_acquire**(`options`): `Promise`\<`void`\>

Defined in: [src/lib/FileLock.ts:590](https://github.com/ayapapa/file-lock-js/blob/f9a40a1b2ec3ab0e592341c32a88ba338912db56/src/lib/FileLock.ts#L590)

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

Defined in: [src/lib/FileLock.ts:496](https://github.com/ayapapa/file-lock-js/blob/f9a40a1b2ec3ab0e592341c32a88ba338912db56/src/lib/FileLock.ts#L496)

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

Defined in: [src/lib/FileLock.ts:445](https://github.com/ayapapa/file-lock-js/blob/f9a40a1b2ec3ab0e592341c32a88ba338912db56/src/lib/FileLock.ts#L445)

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

Defined in: [src/lib/LockBase.ts:356](https://github.com/ayapapa/file-lock-js/blob/f9a40a1b2ec3ab0e592341c32a88ba338912db56/src/lib/LockBase.ts#L356)

**`Internal`**

Handle errors that occur while locked.

#### Parameters

##### err

`unknown`

Error instance.

##### operation

`string`

Operation description

##### options

`AllOptions`\<`FileLockAllOptions`, `FileLockInternalState`\>

Lock options.

##### codeIfNon?

`string` = `'ELOCK'`

Error code.

#### Returns

`void`

#### Inherited from

`LockBase._onError`

***

### \_onExit()

> `abstract` `protected` **\_onExit**(`code`, `signal`): `void`

Defined in: [src/lib/LockBase.ts:291](https://github.com/ayapapa/file-lock-js/blob/f9a40a1b2ec3ab0e592341c32a88ba338912db56/src/lib/LockBase.ts#L291)

**`Internal`**

Execute termination processing.<br>
In the Windows version, this is not called upon forced termination (process.kill()), but the implementation is being retained.

#### Parameters

##### code

`number` \| `null` \| `undefined`

Exit code.

##### signal

`Signals` \| `null`

Recieved signal.

#### Returns

`void`

#### Inherited from

`LockBase._onExit`

***

### \_prepare()

> `protected` **\_prepare**(`options`): `void`

Defined in: [src/lib/FileLock.ts:550](https://github.com/ayapapa/file-lock-js/blob/f9a40a1b2ec3ab0e592341c32a88ba338912db56/src/lib/FileLock.ts#L550)

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

Defined in: [src/lib/FileLock.ts:632](https://github.com/ayapapa/file-lock-js/blob/f9a40a1b2ec3ab0e592341c32a88ba338912db56/src/lib/FileLock.ts#L632)

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

> `abstract` `protected` **\_withLock**(`onLockFn`, `options`): `Promise`\<`unknown`\>

Defined in: [src/lib/LockBase.ts:227](https://github.com/ayapapa/file-lock-js/blob/f9a40a1b2ec3ab0e592341c32a88ba338912db56/src/lib/LockBase.ts#L227)

**`Internal`**

Acquires a lock for the specified key,
executes the function `onLockFn` under exclusive control, 
and returns a Promise that resolves with the return value of `onLockFn` after the lock is released.

#### Parameters

##### onLockFn

[`CallbackOnLock`](../type-aliases/CallbackOnLock.md)

A user-specified callback function to be executed after acquiring the lock.

##### options

`AllOptions`\<`FileLockAllOptions`, `FileLockInternalState`\>

Lock options.

#### Returns

`Promise`\<`unknown`\>

A `Promise` that resolves with the return value of `onLockFn`.

#### Inherited from

`LockBase._withLock`

***

### \_addOnExit()

> `protected` `static` **\_addOnExit**(`fn`): `void`

Defined in: [src/lib/LockBase.ts:135](https://github.com/ayapapa/file-lock-js/blob/f9a40a1b2ec3ab0e592341c32a88ba338912db56/src/lib/LockBase.ts#L135)

**`Internal`**

Register an additional handler for the termination event.

#### Parameters

##### fn

(`code`, `signal`) => `void`

The termination callback function to register.

#### Returns

`void`

#### Inherited from

`LockBase._addOnExit`

***

### \_copyConfig()

> `protected` `static` **\_copyConfig**\<`T`\>(`config`): `T`

Defined in: [src/lib/LockBase.ts:116](https://github.com/ayapapa/file-lock-js/blob/f9a40a1b2ec3ab0e592341c32a88ba338912db56/src/lib/LockBase.ts#L116)

**`Internal`**

Copy config.

#### Type Parameters

##### T

`T` *extends* `LockBaseConfig`

#### Parameters

##### config

`T`

Configurations.

#### Returns

`T`

#### Inherited from

`LockBase._copyConfig`

***

### \_initialize()

> `static` **\_initialize**(): `void`

Defined in: [src/lib/FileLock.ts:102](https://github.com/ayapapa/file-lock-js/blob/f9a40a1b2ec3ab0e592341c32a88ba338912db56/src/lib/FileLock.ts#L102)

**`Internal`**

Initialize.

#### Returns

`void`

***

### \_resolveLogger()

> `protected` `static` **\_resolveLogger**(`config?`): `Required`\<[`LogProvider`](../type-aliases/LogProvider.md)\>

Defined in: [src/lib/LockBase.ts:146](https://github.com/ayapapa/file-lock-js/blob/f9a40a1b2ec3ab0e592341c32a88ba338912db56/src/lib/LockBase.ts#L146)

**`Internal`**

Get a logger where all methods are mandatory.

#### Parameters

##### config?

`LockBaseConfig`

#### Returns

`Required`\<[`LogProvider`](../type-aliases/LogProvider.md)\>

A logger where all methods are mandatory.

#### Inherited from

`LockBase._resolveLogger`

***

### getConfig()

> `static` **getConfig**(): `Required`\<[`FileLockConfig`](../interfaces/FileLockConfig.md)\>

Defined in: [src/lib/FileLock.ts:160](https://github.com/ayapapa/file-lock-js/blob/f9a40a1b2ec3ab0e592341c32a88ba338912db56/src/lib/FileLock.ts#L160)

Get current configurations.

#### Returns

`Required`\<[`FileLockConfig`](../interfaces/FileLockConfig.md)\>

***

### getDefaultConfig()

> `static` **getDefaultConfig**(): `Required`\<[`FileLockConfig`](../interfaces/FileLockConfig.md)\>

Defined in: [src/lib/FileLock.ts:165](https://github.com/ayapapa/file-lock-js/blob/f9a40a1b2ec3ab0e592341c32a88ba338912db56/src/lib/FileLock.ts#L165)

Get default configurations.

#### Returns

`Required`\<[`FileLockConfig`](../interfaces/FileLockConfig.md)\>

***

### getDefaultOptions()

> `static` **getDefaultOptions**(): `FileLockRequiredOptions`

Defined in: [src/lib/FileLock.ts:198](https://github.com/ayapapa/file-lock-js/blob/f9a40a1b2ec3ab0e592341c32a88ba338912db56/src/lib/FileLock.ts#L198)

Get default options(`FileLockOptions`).

#### Returns

`FileLockRequiredOptions`

Deault options.

***

### getHistoryInfo()

> `static` **getHistoryInfo**(): `Readonly`\<\{ `historyEnabled`: `boolean`; `historyId`: `string`; `historyPath`: `string`; `processId`: `number`; \}\>

Defined in: [src/lib/FileLock.ts:206](https://github.com/ayapapa/file-lock-js/blob/f9a40a1b2ec3ab0e592341c32a88ba338912db56/src/lib/FileLock.ts#L206)

Get the history informations.

#### Returns

`Readonly`\<\{ `historyEnabled`: `boolean`; `historyId`: `string`; `historyPath`: `string`; `processId`: `number`; \}\>

***

### onExit()

> `static` **onExit**(`code`, `signal`): `void`

Defined in: [src/lib/LockBase.ts:84](https://github.com/ayapapa/file-lock-js/blob/f9a40a1b2ec3ab0e592341c32a88ba338912db56/src/lib/LockBase.ts#L84)

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

#### Inherited from

`LockBase.onExit`

***

### resetConfig()

> `static` **resetConfig**(): `void`

Defined in: [src/lib/FileLock.ts:155](https://github.com/ayapapa/file-lock-js/blob/f9a40a1b2ec3ab0e592341c32a88ba338912db56/src/lib/FileLock.ts#L155)

Resets the current settings to their default values.

#### Returns

`void`

***

### setConfig()

> `static` **setConfig**(`config`): `void`

Defined in: [src/lib/FileLock.ts:113](https://github.com/ayapapa/file-lock-js/blob/f9a40a1b2ec3ab0e592341c32a88ba338912db56/src/lib/FileLock.ts#L113)

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

> `static` **withLock**(`key`, `onLockFn`, `options?`): `Promise`\<`unknown`\>

Defined in: [src/lib/FileLock.ts:179](https://github.com/ayapapa/file-lock-js/blob/f9a40a1b2ec3ab0e592341c32a88ba338912db56/src/lib/FileLock.ts#L179)

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

`Promise`\<`unknown`\>

A Promise that resolves with the return value of onLockFn.
