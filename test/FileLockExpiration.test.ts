import { describe, expect, it } from 'vitest';
import { logger, sleepAsync, getLockMeta, getLockMetaPath, setLockMeta, removeLockFiles  } from './FileLockTestCommon.ts';
import { AlreadyLocked, FileLock } from '../src/index';
import { randomUUID } from 'node:crypto';

describe('FileLock', () => {

  it("If `expirationTime` is a past value and heartbeat is enabled, the lock cannot be acquired.", async () => {
    const key = String(randomUUID());
    const meta = {ownerId: "hoge", counter: 1, expirationTime: Date.now() - 1000, heartbeatTimeoutMs:5000, lastHeartbeatAt: Date.now()};
    setLockMeta(key, meta);

    expect.assertions(1);
    try {
      await FileLock.withLock(
        key,
        async () => {
          await sleepAsync(1000);
        },
        {timeoutMs: 1000}
      );
    }
    catch (err: any) {
      expect(err instanceof AlreadyLocked).toBe(true);
    }
    finally {
      removeLockFiles(key);
    }
  });

  it("If `expirationTime` is valid but heartbeat is disabled, the lock cannot be acquired.", async () => {
    const key = String(randomUUID());
    const meta = {ownerId: "hoge", counter: 1, expirationTime: Date.now() + 5000, heartbeatTimeoutMs:1000, lastHeartbeatAt: Date.now() - 2000};
    setLockMeta(key, meta);

    expect.assertions(1);
    try {
      await FileLock.withLock(
        key,
        async () => {
          await sleepAsync(1000);
        },
        {timeoutMs: 1000}
      );
    }
    catch (err) {
      expect(err instanceof AlreadyLocked).toBe(true);
    }
    finally {
      removeLockFiles(key);
    }
  });

  it("If both `expirationTime` and the heartbeat are disabled, the lock can be acquired.", async () => {
    const key = String(randomUUID());
    const meta = {ownerId: "hoge", counter: 1, expirationTime: Date.now() - 2000, heartbeatTimeoutMs:1000, lastHeartbeatAt: Date.now() - 2000};
    setLockMeta(key, meta);

    expect.assertions(1);
    try {
      const ret = await FileLock.withLock(
        key,
        async () => {
          await sleepAsync(1000);
          return key;
        },
        {timeoutMs: 1000}
      );
      expect(ret).toBe(key);
    }
    catch (err) {
      logger.error(err);
    }
    finally {
      removeLockFiles(key);
    }
  });
});
