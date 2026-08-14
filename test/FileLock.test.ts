import { describe, expect, it, vi, type Mock } from 'vitest';
import { FileLock } from '../src/index';

async function sleepAsync(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('FileLock', () => {

  

  it("The lock is successfully acquired, and the return value of the callback is obtained.", async () => {
    const retVal = "test_001";
    
    expect(await FileLock.withLock("testKey1", 
      async () => {
        await sleepAsync(3000);
        return retVal
      },
      {timeoutSec : 1 }
    )).toBe(retVal);
  });
/*
  it("test_InterProcessLock_success"), () => {
    // 非同期で3秒スリープする関数を、別キーで複数回呼び出してみる
    const a =  FileLock.withLock("testKey1", 
      async () => {
        await sleepAsync(3000);
      },
      {timeoutSec : 1 }
    );
    
    const b =  FileLock.withLock("testKey2", 
      async () => {
        await sleepAsync(3000);
      },
      {timeoutSec : 1 }
    );
    let res;
    expect(res = await Promise.all([a, b])).toHaveLength(2);
    expect(res[0]).toBeUndefined();
    expect(res[1]).toBeUndefined();
  }
*/
});
