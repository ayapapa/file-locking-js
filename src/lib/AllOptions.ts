import { BaseUserOptions } from "./BaseUserOptions.ts";
import { BaseInternalState } from "./BaseInternalState.ts";

/** A fusion of user options and internal options. */
export type AllOptions<
  U extends BaseUserOptions = BaseUserOptions,
  I extends BaseInternalState = BaseInternalState
> = U & I;

/** Keys of AllOptions */
export type AllOptionsKey<
  U extends BaseUserOptions = BaseUserOptions,
  I extends BaseInternalState = BaseInternalState
> = keyof AllOptions<U, I>;
