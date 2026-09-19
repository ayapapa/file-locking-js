import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sleepAsync, getLockMeta, setLockMeta, removeLockFiles, getLockMetaPath  } from './FileLockTestCommon.ts';
import { FileLock, FileLockConfig, FileLockError, } from '../src/index';

let orgConfig: FileLockConfig;
beforeEach(() => {
  orgConfig = FileLock.getConfig();
});

afterEach(() => {
  FileLock.setConfig(orgConfig);
  vi.restoreAllMocks();
});

describe('FileLock', () => {

  async function testInvalidLockInformationFile(target: string, v?: any ) {
    const key = "testKey";
    const meta = {ownerId: "hoge", counter: 1, expirationTime: Date.now() + 10*1000, heartbeatTimeoutMs:5000, lastHeartbeatAt: Date.now()};
    const mt = {...meta} as any;
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
        { timeoutMs: 200 }// ttlMs: 1000 }
      );
    } catch (err: any) {
      expect(err instanceof FileLockError).toBeTruthy();
      expect(err).toMatchObject({
        code: "EBROKEN",
        path: getLockMetaPath(key),
        message: `The contents of the lock file are corrupted, making it impossible to determine the lock status. ` +
                 `Please verify that the target process does not exist and, if necessary, manually delete the lock file.`,
        cause: {
          code: "ECOMPROMISED",
          invalidProps: [{ key: target, value: v }],
          path: getLockMetaPath(key),
          key: key,
          message: `The lock(key: ${key}) has been compromised(The lock information format is invalid).`
        },
      });
    }
    finally {
      removeLockFiles(key);
    }
  }

  it("Spoof the invalid lock information storage file and verify that an error occurs.(No ownerId)", async () => {
    await testInvalidLockInformationFile("ownerId");
  });

  it("Spoof the invalid lock information storage file and verify that an error occurs.(No counter)", async () => {
    await testInvalidLockInformationFile("counter");
  });

  it("Spoof the invalid lock information storage file and verify that an error occurs.(No expirationTime)", async () => {
    await testInvalidLockInformationFile("expirationTime");
  });

  it("Spoof the invalid lock information storage file and verify that an error occurs.(No heartbeatTimeoutMs)", async () => {
    await testInvalidLockInformationFile("heartbeatTimeoutMs");
  });

  it("Spoof the invalid lock information storage file and verify that an error occurs.(Invalid ownerId)", async () => {
    await testInvalidLockInformationFile("ownerId", 12345);
  });

  it("Spoof the invalid lock information storage file and verify that an error occurs.(No counter)", async () => {
    await testInvalidLockInformationFile("counter", 'hogehogehoge');
  });

  it("Spoof the invalid lock information storage file and verify that an error occurs.(No expirationTime)", async () => {
    await testInvalidLockInformationFile("expirationTime", "nyannnyann");
  });

  it("Spoof the invalid lock information storage file and verify that an error occurs.(No heartbeatTimeoutMs)", async () => {
    await testInvalidLockInformationFile("heartbeatTimeoutMs", "miimii");
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
  });
});
