import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sleepAsync, getLockMeta, setLockMeta, removeLockFiles, getLockMetaPath, TestLock  } from './FileLockTestCommon.ts';
import { AlreadyLocked, FileLock, type FileLockConfig, } from '../src/index.ts';

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

  async function testInvalidLockInformationFile(target: string, v?: unknown ) {
    const key = "testKey";
    const meta = {ownerId: "hoge", counter: 1, expirationTime: Date.now() + 10*1000, heartbeatTtlMs:5000, lastHeartbeatAt: Date.now()};
    const mt = {...meta} as Record<string, unknown>;
    if (v) {
      mt[target] = v;
    } else {
      delete mt[target];
    }
    setLockMeta(key, mt);
    try {
      await FileLock.withLock(
        key,
        async () => await sleepAsync(100),
        { timeoutMs: 0 }// ttlMs: 1000 }
      );
    } catch (err) {
      expect(err).instanceOf(AlreadyLocked);
      const invalidProps = {} as Record<string, unknown>;
      invalidProps[target] = mt[target];

      const matchObj = {
        code: "EALREADYLOCKED",
        key,
        reason: "InvalidMetadata",
        message: "Lock file already exists, but its metadata is invalid.",
        causes: [{
          code: "ECOMPROMISED",
          key,
          invalidProps,
          path: getLockMetaPath(key),
          reason: "The lock information format is invalid.",
          message: "The lock was compromised during the locking process.",
        }],
      }
      expect(err).toMatchObject(matchObj);
    }
    finally {
      removeLockFiles(key);
    }
    expect(TestLock.isReleasedState(key)).toBeTruthy();

  }

  it("Spoof the invalid lock information storage file and verify that an error occurs.(No ownerId)", async () => {
    await testInvalidLockInformationFile("ownerId");
  });

  /*
  it("Spoof the invalid lock information storage file and verify that an error occurs.(No counter)", async () => {
    await testInvalidLockInformationFile("counter");
  });
*/
  it("Spoof the invalid lock information storage file and verify that an error occurs.(No expirationTime)", async () => {
    await testInvalidLockInformationFile("expirationTime");
  });

  it("Spoof the invalid lock information storage file and verify that an error occurs.(No heartbeatTtlMs)", async () => {
    await testInvalidLockInformationFile("heartbeatTtlMs");
  });

  it("Spoof the invalid lock information storage file and verify that an error occurs.(Invalid ownerId)", async () => {
    await testInvalidLockInformationFile("ownerId", 12345);
  });
/*
  it("Spoof the invalid lock information storage file and verify that an error occurs.(Invalid counter)", async () => {
    await testInvalidLockInformationFile("counter", 'hogehogehoge');
  });
*/
  it("Spoof the invalid lock information storage file and verify that an error occurs.(No expirationTime)", async () => {
    await testInvalidLockInformationFile("expirationTime", "nyannnyann");
  });

  it("Spoof the invalid lock information storage file and verify that an error occurs.(No heartbeatTtlMs)", async () => {
    await testInvalidLockInformationFile("heartbeatTtlMs", "miimii");
  });

  it("Verify that the heartbeat is functioning correctly.", async () => {
    const key = "testKey", retVal = key;
    expect(await FileLock.withLock(
      key,
      async () => {
        const meta1 = getLockMeta(key);
        await sleepAsync(1200);
        const meta2 = getLockMeta(key);
        expect(meta2.lastHeartbeatAt).toBeGreaterThan(meta1.lastHeartbeatAt);
        return retVal;
      },
      {ttlMs: 2000}
    )).toBe(retVal);
    expect(TestLock.isReleasedState(key)).toBeTruthy();
  });
});
