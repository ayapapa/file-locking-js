/** Type of the log output object. */
export type LogProvider = Pick<Console, 'log' | 'trace' | 'debug' | 'info' | 'warn' | 'error' > & {fatal?: (...args: any[]) => void};

/** Basic config */
export interface LockBaseConfig {

  /**
  * External logger. 
  * Default is `console`.
  */
  logger?: LogProvider;

  /**
   * @internal
   * Indicates whether to execute in debug mode.
   * If `true`, process-related information is added to the lock information file, 
   * and history tracking is enabled.
   * This is a debug flag for this class and is intended for use only during development.
   * However, if an external logger is injected, it cannot be controlled; 
   * please adjust the log level yourself as necessary.
   */
  _debug?: boolean;
}

 export const defaultLockBaseConfig: Readonly<Required<LockBaseConfig>> = {
  logger: console,
  _debug: false,
}