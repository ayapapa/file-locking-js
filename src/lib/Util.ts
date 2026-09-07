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
