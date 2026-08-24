import { UserOptionsBase } from "./UserOptionsBase.ts";
import { InternalStateBase } from "./InternalStateBase.ts";

/** A fusion of user options and internal options. */
export type AllOptions<
  U extends UserOptionsBase = UserOptionsBase,
  I extends InternalStateBase = InternalStateBase
> = U & I;

/** Keys of AllOptions */
export type AllOptionsKey<
  U extends UserOptionsBase = UserOptionsBase,
  I extends InternalStateBase = InternalStateBase
> = keyof AllOptions<U, I>;
