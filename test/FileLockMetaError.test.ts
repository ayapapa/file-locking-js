import { describe, expect, it } from 'vitest';
import { logger, sleepAsync, getLockMeta, setLockMeta, removeLockFiles  } from './FileLockTestCommon.ts';
import { FileLock, LockCompromised } from '../src/index';


describe('FileLock', () => {

  async function testIinvalidLocknformationFile(target: string, v?: any ) {
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
        async () => await sleepAsync(500),
        {ttlMs: 1000}
      );
    } catch (err: any) {
      expect(err instanceof LockCompromised).toBeTruthy();
      expect(err.code).toBe('ECOMPROMISED');
      expect(err.message.includes('has been compromised')).toBeTruthy();
    }
    finally {
      removeLockFiles(key);
    }
  }

  it("Spoof the invalid lock information storage file and verify that an error occurs.(No ownerId)", async () => {
    await testIinvalidLocknformationFile("ownerId");
  });

  it("Spoof the invalid lock information storage file and verify that an error occurs.(No counter)", async () => {
    await testIinvalidLocknformationFile("counter");
  });

  it("Spoof the invalid lock information storage file and verify that an error occurs.(No expirationTime)", async () => {
    await testIinvalidLocknformationFile("expirationTime");
  });

  it("Spoof the invalid lock information storage file and verify that an error occurs.(No heartbeatTimeoutMs)", async () => {
    await testIinvalidLocknformationFile("heartbeatTimeoutMs");
  });

  it("Spoof the invalid lock information storage file and verify that an error occurs.(Invalid ownerId)", async () => {
    await testIinvalidLocknformationFile("ownerId", 12345);
  });

  it("Spoof the invalid lock information storage file and verify that an error occurs.(No counter)", async () => {
    await testIinvalidLocknformationFile("counter", 'hogehogehoge');
  });

  it("Spoof the invalid lock information storage file and verify that an error occurs.(No expirationTime)", async () => {
    await testIinvalidLocknformationFile("expirationTime", "nyannnyann");
  });

  it("Spoof the invalid lock information storage file and verify that an error occurs.(No heartbeatTimeoutMs)", async () => {
    await testIinvalidLocknformationFile("heartbeatTimeoutMs", "miimii");
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

  it("hogehoge", async () => {
  });
});
