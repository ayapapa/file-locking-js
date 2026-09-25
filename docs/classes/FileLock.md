[**@ayapapa-npm/file-locking-js**](../README.md)

***

[@ayapapa-npm/file-locking-js](../README.md) / FileLock

# Class: FileLock

Defined in: [src/lib/FileLock.ts:32](https://github.com/ayapapa/file-lock-js/blob/02385e7ce5caf53483e8416d615060efa4955ce2/src/lib/FileLock.ts#L32)

File locking. 
Acquires a lock by creating a file derived from the specified key, executes the provided callback, and then releases the lock (by deleting the created file). 
While the file exists, no other lock can be acquired for the same key. 
Settings such as `timeoutMs` allow for waiting until an unreleased lock is freed.

## Extends

- `LockBase`\<`FileLockRequiredOptions`, `FileLockInternalState`\>

## Properties

### \_acquired

> `protected` **\_acquired**: `boolean` = `false`

Defined in: [src/lib/LockBase.ts:175](https://github.com/ayapapa/file-lock-js/blob/02385e7ce5caf53483e8416d615060efa4955ce2/src/lib/LockBase.ts#L175)

**`Internal`**

Whether or not a lock is acquired.

#### Inherited from

`LockBase._acquired`

***

### \_key

> `protected` **\_key**: `string`

Defined in: [src/lib/LockBase.ts:169](https://github.com/ayapapa/file-lock-js/blob/02385e7ce5caf53483e8416d615060efa4955ce2/src/lib/LockBase.ts#L169)

**`Internal`**

Lock key

#### Inherited from

`LockBase._key`

***

### \_logger

> `protected` **\_logger**: `Required`\<[`LogProvider`](../type-aliases/LogProvider.md)\>

Defined in: [src/lib/LockBase.ts:163](https://github.com/ayapapa/file-lock-js/blob/02385e7ce5caf53483e8416d615060efa4955ce2/src/lib/LockBase.ts#L163)

**`Internal`**

Logger.

#### Inherited from

`LockBase._logger`

***

### \_ownerId

> `protected` **\_ownerId**: `string`

Defined in: [src/lib/LockBase.ts:181](https://github.com/ayapapa/file-lock-js/blob/02385e7ce5caf53483e8416d615060efa4955ce2/src/lib/LockBase.ts#L181)

**`Internal`**

Lock owner ID to be stored in the lock file.

#### Inherited from

`LockBase._ownerId`

***

### \_config

> `protected` `static` **\_config**: `Required`\<`LockBaseConfig`\>

Defined in: [src/lib/LockBase.ts:50](https://github.com/ayapapa/file-lock-js/blob/02385e7ce5caf53483e8416d615060efa4955ce2/src/lib/LockBase.ts#L50)

**`Internal`**

Current basic configurations.

#### Inherited from

`LockBase._config`

***

### \_lastOptions

> `protected` `static` **\_lastOptions**: `FileLockRequiredOptions` \| `null` = `null`

Defined in: [src/lib/FileLock.ts:43](https://github.com/ayapapa/file-lock-js/blob/02385e7ce5caf53483e8416d615060efa4955ce2/src/lib/FileLock.ts#L43)

**`Internal`**

Store the recently used options (options resolved within the static `withLock()` method). 
Normally, there is no need to store them statically because new options are resolved with each call to `withLock()`, but they are stored here for testing purposes.

***

### \_logger

> `protected` `static` **\_logger**: `Required`\<[`LogProvider`](../type-aliases/LogProvider.md)\>

Defined in: [src/lib/LockBase.ts:56](https://github.com/ayapapa/file-lock-js/blob/02385e7ce5caf53483e8416d615060efa4955ce2/src/lib/LockBase.ts#L56)

**`Internal`**

Logger.

#### Inherited from

`LockBase._logger`

## Methods

### \_acquire()

> `protected` **\_acquire**(`options`): `Promise`\<`void`\>

Defined in: [src/lib/FileLock.ts:581](https://github.com/ayapapa/file-lock-js/blob/02385e7ce5caf53483e8416d615060efa4955ce2/src/lib/FileLock.ts#L581)

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

Defined in: [src/lib/FileLock.ts:487](https://github.com/ayapapa/file-lock-js/blob/02385e7ce5caf53483e8416d615060efa4955ce2/src/lib/FileLock.ts#L487)

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

Defined in: [src/lib/FileLock.ts:436](https://github.com/ayapapa/file-lock-js/blob/02385e7ce5caf53483e8416d615060efa4955ce2/src/lib/FileLock.ts#L436)

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

Defined in: [src/lib/LockBase.ts:446](https://github.com/ayapapa/file-lock-js/blob/02385e7ce5caf53483e8416d615060efa4955ce2/src/lib/LockBase.ts#L446)

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

Defined in: [src/lib/LockBase.ts:279](https://github.com/ayapapa/file-lock-js/blob/02385e7ce5caf53483e8416d615060efa4955ce2/src/lib/LockBase.ts#L279)

**`Internal`**

Execute termination processing.<br>
In the Windows version, this is not called upon forced termination (process.kill()), but the implementation is being retained.

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

Defined in: [src/lib/FileLock.ts:541](https://github.com/ayapapa/file-lock-js/blob/02385e7ce5caf53483e8416d615060efa4955ce2/src/lib/FileLock.ts#L541)

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

Defined in: [src/lib/FileLock.ts:637](https://github.com/ayapapa/file-lock-js/blob/02385e7ce5caf53483e8416d615060efa4955ce2/src/lib/FileLock.ts#L637)

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

Defined in: [src/lib/LockBase.ts:222](https://github.com/ayapapa/file-lock-js/blob/02385e7ce5caf53483e8416d615060efa4955ce2/src/lib/LockBase.ts#L222)

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

### \_addOnExit()

> `protected` `static` **\_addOnExit**(`fn`): `void`

Defined in: [src/lib/LockBase.ts:132](https://github.com/ayapapa/file-lock-js/blob/02385e7ce5caf53483e8416d615060efa4955ce2/src/lib/LockBase.ts#L132)

**`Internal`**

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

Defined in: [src/lib/LockBase.ts:115](https://github.com/ayapapa/file-lock-js/blob/02385e7ce5caf53483e8416d615060efa4955ce2/src/lib/LockBase.ts#L115)

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

Defined in: [src/lib/FileLock.ts:96](https://github.com/ayapapa/file-lock-js/blob/02385e7ce5caf53483e8416d615060efa4955ce2/src/lib/FileLock.ts#L96)

**`Internal`**

Initialize.

#### Returns

`void`

***

### \_resolveLogger()

> `protected` `static` **\_resolveLogger**(`config?`): `Required`\<[`LogProvider`](../type-aliases/LogProvider.md)\>

Defined in: [src/lib/LockBase.ts:143](https://github.com/ayapapa/file-lock-js/blob/02385e7ce5caf53483e8416d615060efa4955ce2/src/lib/LockBase.ts#L143)

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

Defined in: [src/lib/FileLock.ts:156](https://github.com/ayapapa/file-lock-js/blob/02385e7ce5caf53483e8416d615060efa4955ce2/src/lib/FileLock.ts#L156)

Get current configurations.

#### Returns

`Required`\<[`FileLockConfig`](../interfaces/FileLockConfig.md)\>

***

### getDefaultConfig()

> `static` **getDefaultConfig**(): `Required`\<[`FileLockConfig`](../interfaces/FileLockConfig.md)\>

Defined in: [src/lib/FileLock.ts:161](https://github.com/ayapapa/file-lock-js/blob/02385e7ce5caf53483e8416d615060efa4955ce2/src/lib/FileLock.ts#L161)

Get default configurations.

#### Returns

`Required`\<[`FileLockConfig`](../interfaces/FileLockConfig.md)\>

***

### getDefaultOptions()

> `static` **getDefaultOptions**(): `FileLockRequiredOptions`

Defined in: [src/lib/FileLock.ts:194](https://github.com/ayapapa/file-lock-js/blob/02385e7ce5caf53483e8416d615060efa4955ce2/src/lib/FileLock.ts#L194)

Get default options(`FileLockOptions`).

#### Returns

`FileLockRequiredOptions`

Deault options.

***

### getHistoryInfo()

> `static` **getHistoryInfo**(): `Readonly`\<\{ `historyEnabled`: `boolean`; `historyId`: `string`; `historyPath`: `string`; `processId`: `number`; \}\>

Defined in: [src/lib/FileLock.ts:202](https://github.com/ayapapa/file-lock-js/blob/02385e7ce5caf53483e8416d615060efa4955ce2/src/lib/FileLock.ts#L202)

Get the history informations.

#### Returns

`Readonly`\<\{ `historyEnabled`: `boolean`; `historyId`: `string`; `historyPath`: `string`; `processId`: `number`; \}\>

***

### onExit()

> `static` **onExit**(`code`, `signal`): `void`

Defined in: [src/lib/LockBase.ts:84](https://github.com/ayapapa/file-lock-js/blob/02385e7ce5caf53483e8416d615060efa4955ce2/src/lib/LockBase.ts#L84)

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

Defined in: [src/lib/FileLock.ts:151](https://github.com/ayapapa/file-lock-js/blob/02385e7ce5caf53483e8416d615060efa4955ce2/src/lib/FileLock.ts#L151)

Resets the current settings to their default values.

#### Returns

`void`

***

### setConfig()

> `static` **setConfig**(`config`): `void`

Defined in: [src/lib/FileLock.ts:107](https://github.com/ayapapa/file-lock-js/blob/02385e7ce5caf53483e8416d615060efa4955ce2/src/lib/FileLock.ts#L107)

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

Defined in: [src/lib/FileLock.ts:175](https://github.com/ayapapa/file-lock-js/blob/02385e7ce5caf53483e8416d615060efa4955ce2/src/lib/FileLock.ts#L175)

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
