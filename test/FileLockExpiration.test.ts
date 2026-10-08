import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger, sleepAsync,  removeLockFiles, TestLock, setLockMeta  } from './FileLockTestCommon.ts';
import { AlreadyLocked, type FileLockConfig, FileLock, } from '../src/index.ts';
import { randomUUID } from 'node:crypto';

let orgConfig: FileLockConfig;
beforeEach(() => {
  vi.restoreAllMocks();
  orgConfig = FileLock.getConfig();
});

afterEach(() => {
  vi.restoreAllMocks();
  FileLock.setConfig(orgConfig);
});


describe('FileLock', () => {

  it("If `expirationTime` is a past value and heartbeat is enabled, the lock cannot be acquired.", async () => {
    const key = String(randomUUID());
    const meta = {ownerId: "hoge", counter: 1, expirationTime: Date.now() - 1000, heartbeatTtlMs:5000, lastHeartbeatAt: Date.now()};
    setLockMeta(key, meta);

    expect.assertions(2);
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
      expect(err).instanceOf(AlreadyLocked);
    }
    finally {
      try { removeLockFiles(key); } catch (_e) {;};
    }
    expect(TestLock.isReleasedState(key)).toBeTruthy();
  });

  it("If `expirationTime` is valid but heartbeat is disabled, the lock cannot be acquired.", async () => {
    const key = String(randomUUID());
    const meta = {ownerId: "hoge", counter: 1, expirationTime: Date.now() + 5000, heartbeatTtlMs:1000, lastHeartbeatAt: Date.now() - 2000};
    setLockMeta(key, meta);

    expect.assertions(2);
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
      try { removeLockFiles(key); } catch (_e) {;};
    }
    expect(TestLock.isReleasedState(key)).toBeTruthy();
  });

  it("If both `expirationTime` and the heartbeat are disabled, the lock can be acquired.", async () => {
    const key = String(randomUUID());
    const meta = {ownerId: "hoge", counter: 1, expirationTime: Date.now() - 2000, heartbeatTtlMs:1000, lastHeartbeatAt: Date.now() - 2000};
    setLockMeta(key, meta);

    expect.assertions(2);
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
      try { removeLockFiles(key); } catch (_e) {;};
    }
    expect(TestLock.isReleasedState(key)).toBeTruthy();
  });

  it("不正なロックファイルを故意に作成し、`invalidTtlMs`時間後にロック成功することを確認する", async () => {
    const key = "invald_loclfile_error";
    const meta = {};
    setLockMeta(key, meta);
    expect.assertions(2);
    try {
      expect(await FileLock.withLock(key, () => "completed", { heartbeatTtlMs: 2000, timeoutMs: 2500, invalidTtlMs: 2100 })).toBe("completed")
    }
    finally {
      try { removeLockFiles(key); } catch (_e) {;};
    }
    expect(TestLock.isReleasedState(key)).toBeTruthy();
  });

});
