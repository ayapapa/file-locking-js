/** 
 * @internal
 * Asynchronous sleep. 
 */
export async function sleepAsync(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * @internal
 * Synchronous sleep. 
 */
export function sleepSync(ms: number) {
  const sab = new SharedArrayBuffer(4);
  const int32 = new Int32Array(sab);
  Atomics.wait(int32, 0, 0, ms);
}

/**
 * @internal
 * Get callstack. 
 */
export function getCallStack(): string {
  const obj: { stack?: string } = {};
  Error.captureStackTrace(obj, getCallStack);
  obj.stack = obj.stack ? obj.stack.replace(/^Error\b/, "Call stack") : `Call stack: couldn't get.`;
  return obj.stack;
} 

/**
 * @internal
 * Check same type objects. 
 */
export function isEqualObject(o1: Record<string, unknown>, o2: Record<string, unknown>): boolean {
  if (Object.keys(o1).length !== Object.keys(o2).length) return false;
  for (const key in o1) {
    if (key in o2 === false || typeof o1[key] !== typeof o2[key]) return false;
  }
  return true;
}

