import { LockBaseUserOptions } from "./LockBaseUserOptions.ts";
import { LockBaseInternalState } from "./LockBaseInternalState.ts";

/** A fusion of user options and internal options. */
export type AllOptions<
  U extends LockBaseUserOptions = LockBaseUserOptions,
  I extends LockBaseInternalState = LockBaseInternalState
> = U & I;

/** Keys of AllOptions */
export type AllOptionsKey<
  U extends LockBaseUserOptions = LockBaseUserOptions,
  I extends LockBaseInternalState = LockBaseInternalState
> = keyof AllOptions<U, I>;
