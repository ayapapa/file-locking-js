[**@ayapapa-npm/file-locking-js**](../README.md)

***

[@ayapapa-npm/file-locking-js](../README.md) / Monitor

# Interface: Monitor

Defined in: [src/lib/LockBaseInternalState.ts:2](https://github.com/ayapapa/file-lock-js/blob/7a94f6696ecbacf1dfde4833438efb44ea7678e6/src/lib/LockBaseInternalState.ts#L2)

Monitoring object passed to the callback function executed after acquiring the lock.

## Properties

### cancelled

> **cancelled**: `boolean`

Defined in: [src/lib/LockBaseInternalState.ts:4](https://github.com/ayapapa/file-lock-js/blob/7a94f6696ecbacf1dfde4833438efb44ea7678e6/src/lib/LockBaseInternalState.ts#L4)

Whether the operation was cancelled.

***

### cause?

> `optional` **cause?**: `unknown`

Defined in: [src/lib/LockBaseInternalState.ts:10](https://github.com/ayapapa/file-lock-js/blob/7a94f6696ecbacf1dfde4833438efb44ea7678e6/src/lib/LockBaseInternalState.ts#L10)

The object actually caught by the try-catch block.

***

### id?

> `optional` **id?**: `string`

Defined in: [src/lib/LockBaseInternalState.ts:16](https://github.com/ayapapa/file-lock-js/blob/7a94f6696ecbacf1dfde4833438efb44ea7678e6/src/lib/LockBaseInternalState.ts#L16)

Monitor ID.

***

### operation?

> `optional` **operation?**: `string`

Defined in: [src/lib/LockBaseInternalState.ts:13](https://github.com/ayapapa/file-lock-js/blob/7a94f6696ecbacf1dfde4833438efb44ea7678e6/src/lib/LockBaseInternalState.ts#L13)

Operation cancelled.

***

### reason?

> `optional` **reason?**: `string`

Defined in: [src/lib/LockBaseInternalState.ts:7](https://github.com/ayapapa/file-lock-js/blob/7a94f6696ecbacf1dfde4833438efb44ea7678e6/src/lib/LockBaseInternalState.ts#L7)

The reason for cancellation determined by FileLock.
