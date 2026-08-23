import { BaseUserOptions } from "./BaseUserOptions.ts";
import { BaseInternalState } from "./BaseInternalState.ts";

// The general type for Options (accepting a generic T)
export type AllOptions<
  U extends BaseUserOptions = BaseUserOptions,
  I extends BaseInternalState = BaseInternalState
> = U & I;

export type AllOptionsKey<
  U extends BaseUserOptions = BaseUserOptions,
  I extends BaseInternalState = BaseInternalState
> = keyof AllOptions<U, I>;


