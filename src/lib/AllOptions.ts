import { LockBaseUserOptions } from "./LockBaseUserOptions.ts";
import { LockBaseInternalState } from "./LockBaseInternalState.ts";

/**
 * @internal 
 * A fusion of user options and internal options.
 */
export type AllOptions<
  U extends LockBaseUserOptions = LockBaseUserOptions,
  I extends LockBaseInternalState = LockBaseInternalState
> = Required<U> & I & OptionsForTesting<U>;

/** 
 * @internal
 * Keys of AllOptions 
 */
export type AllOptionsKey<
  U extends LockBaseUserOptions = LockBaseUserOptions,
  I extends LockBaseInternalState = LockBaseInternalState
> = keyof AllOptions<U, I>;

/**
 * @internal
 * Options for testing.
 */
export interface OptionsForTesting<T> {
  _resolvedOpts?: T
}