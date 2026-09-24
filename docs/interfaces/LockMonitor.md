[**@ayapapa-npm/file-locking-js**](../README.md)

***

[@ayapapa-npm/file-locking-js](../README.md) / LockMonitor

# Interface: LockMonitor

Defined in: src/lib/LockMonitor.ts:2

Monitoring object passed to the callback function executed after acquiring the lock.

## Properties

### cancelled

> **cancelled**: `boolean`

Defined in: src/lib/LockMonitor.ts:4

Whether the operation was cancelled.

***

### cause?

> `optional` **cause?**: `unknown`

Defined in: src/lib/LockMonitor.ts:13

The object actually caught by the try-catch block. <br>
In many cases, it is an instance of an error class (or a subclass thereof).

***

### id?

> `optional` **id?**: `string`

Defined in: src/lib/LockMonitor.ts:19

Monitor ID.

***

### operation?

> `optional` **operation?**: `string`

Defined in: src/lib/LockMonitor.ts:16

Operation cancelled.

***

### reason?

> `optional` **reason?**: `string`

Defined in: src/lib/LockMonitor.ts:7

The reason for cancellation determined by FileLock.
