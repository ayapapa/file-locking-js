[**@ayapapa-npm/file-locking-js**](../README.md)

***

[@ayapapa-npm/file-locking-js](../README.md) / LockMonitor

# Interface: LockMonitor

Defined in: [src/lib/LockMonitor.ts:2](https://github.com/ayapapa/file-lock-js/blob/42e35253b400a14f446438f41dc625eff9f85261/src/lib/LockMonitor.ts#L2)

Monitoring object passed to the callback function executed after acquiring the lock.

## Properties

### cancelled

> **cancelled**: `boolean`

Defined in: [src/lib/LockMonitor.ts:4](https://github.com/ayapapa/file-lock-js/blob/42e35253b400a14f446438f41dc625eff9f85261/src/lib/LockMonitor.ts#L4)

Whether the operation was cancelled.

***

### cause?

> `optional` **cause?**: `unknown`

Defined in: [src/lib/LockMonitor.ts:13](https://github.com/ayapapa/file-lock-js/blob/42e35253b400a14f446438f41dc625eff9f85261/src/lib/LockMonitor.ts#L13)

The object actually caught by the try-catch block. <br>
In many cases, it is an instance of an error class (or a subclass thereof).

***

### id?

> `optional` **id?**: `string`

Defined in: [src/lib/LockMonitor.ts:19](https://github.com/ayapapa/file-lock-js/blob/42e35253b400a14f446438f41dc625eff9f85261/src/lib/LockMonitor.ts#L19)

Monitor ID.

***

### operation?

> `optional` **operation?**: `string`

Defined in: [src/lib/LockMonitor.ts:16](https://github.com/ayapapa/file-lock-js/blob/42e35253b400a14f446438f41dc625eff9f85261/src/lib/LockMonitor.ts#L16)

Operation cancelled.

***

### reason?

> `optional` **reason?**: `string`

Defined in: [src/lib/LockMonitor.ts:7](https://github.com/ayapapa/file-lock-js/blob/42e35253b400a14f446438f41dc625eff9f85261/src/lib/LockMonitor.ts#L7)

The reason for cancellation determined by FileLock.
