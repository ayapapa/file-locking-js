[**@ayapapa-npm/file-locking-js**](../README.md)

***

[@ayapapa-npm/file-locking-js](../README.md) / FileLockUserOptionsResolver

# Class: FileLockUserOptionsResolver

Defined in: [src/lib/FileLockUserOptionsResolver.ts:10](https://github.com/ayapapa/file-lock-js/blob/d5f018497cf77f372cc0e16dc32cbaec314894d5/src/lib/FileLockUserOptionsResolver.ts#L10)

**`Internal`**

A class that resolves UserOptions for FileLock.

## Extends

- `LockBaseUserOptionsResolver`\<[`FileLockUserOptions`](../interfaces/FileLockUserOptions.md), `FileLockInternalState`\>

## Constructors

### Constructor

> **new FileLockUserOptionsResolver**(`options`, `defaultOptions?`): `FileLockUserOptionsResolver`

Defined in: [src/lib/FileLockUserOptionsResolver.ts:26](https://github.com/ayapapa/file-lock-js/blob/d5f018497cf77f372cc0e16dc32cbaec314894d5/src/lib/FileLockUserOptionsResolver.ts#L26)

Constructor.

#### Parameters

##### options

[`FileLockUserOptions`](../interfaces/FileLockUserOptions.md)

User options.

##### defaultOptions?

[`FileLockUserOptions`](../interfaces/FileLockUserOptions.md)

#### Returns

`FileLockUserOptionsResolver`

#### Overrides

`LockBaseUserOptionsResolver<FileLockUserOptions, FileLockInternalState>.constructor`

## Properties

### options

> `protected` **options**: `AllOptions`\<[`FileLockUserOptions`](../interfaces/FileLockUserOptions.md), `FileLockInternalState`\>

Defined in: [src/lib/LockBaseUserOptionsResolver.ts:53](https://github.com/ayapapa/file-lock-js/blob/d5f018497cf77f372cc0e16dc32cbaec314894d5/src/lib/LockBaseUserOptionsResolver.ts#L53)

Current options.

#### Inherited from

`LockBaseUserOptionsResolver.options`

***

### minHeartBeatTImeoutMs

> `readonly` `static` **minHeartBeatTImeoutMs**: `number` = `2000`

Defined in: [src/lib/FileLockUserOptionsResolver.ts:16](https://github.com/ayapapa/file-lock-js/blob/d5f018497cf77f372cc0e16dc32cbaec314894d5/src/lib/FileLockUserOptionsResolver.ts#L16)

Static fields.

## Methods

### \_getCheckTypePairs()

> `protected` **\_getCheckTypePairs**(): `KeyTypeMap`\<[`FileLockUserOptions`](../interfaces/FileLockUserOptions.md)\>

Defined in: [src/lib/FileLockUserOptionsResolver.ts:31](https://github.com/ayapapa/file-lock-js/blob/d5f018497cf77f372cc0e16dc32cbaec314894d5/src/lib/FileLockUserOptionsResolver.ts#L31)

Get the type-checking pairs `{'property name': 'value type'}` for the optional properties.

#### Returns

`KeyTypeMap`\<[`FileLockUserOptions`](../interfaces/FileLockUserOptions.md)\>

#### Overrides

`LockBaseUserOptionsResolver._getCheckTypePairs`

***

### \_getTimeKeys()

> `protected` **\_getTimeKeys**(): `TimeBasedKey`\<[`FileLockUserOptions`](../interfaces/FileLockUserOptions.md)\>[]

Defined in: [src/lib/FileLockUserOptionsResolver.ts:48](https://github.com/ayapapa/file-lock-js/blob/d5f018497cf77f372cc0e16dc32cbaec314894d5/src/lib/FileLockUserOptionsResolver.ts#L48)

Get an array of time-related base names (keys) from the option properties.

#### Returns

`TimeBasedKey`\<[`FileLockUserOptions`](../interfaces/FileLockUserOptions.md)\>[]

#### Overrides

`LockBaseUserOptionsResolver._getTimeKeys`

***

### \_normalizeOptions()

> `protected` **\_normalizeOptions**(`defaultOpts?`): `void`

Defined in: [src/lib/FileLockUserOptionsResolver.ts:60](https://github.com/ayapapa/file-lock-js/blob/d5f018497cf77f372cc0e16dc32cbaec314894d5/src/lib/FileLockUserOptionsResolver.ts#L60)

**`Internal`**

Transform, and complete options.

#### Parameters

##### defaultOpts?

[`FileLockUserOptions`](../interfaces/FileLockUserOptions.md)

Defalt options

#### Returns

`void`

#### Overrides

`LockBaseUserOptionsResolver._normalizeOptions`

***

### getOptions()

> **getOptions**(): `AllOptions`\<[`FileLockUserOptions`](../interfaces/FileLockUserOptions.md), `FileLockInternalState`\>

Defined in: [src/lib/LockBaseUserOptionsResolver.ts:74](https://github.com/ayapapa/file-lock-js/blob/d5f018497cf77f372cc0e16dc32cbaec314894d5/src/lib/LockBaseUserOptionsResolver.ts#L74)

Get current options.

#### Returns

`AllOptions`\<[`FileLockUserOptions`](../interfaces/FileLockUserOptions.md), `FileLockInternalState`\>

#### Inherited from

`LockBaseUserOptionsResolver.getOptions`
