/** Type of the log output object. */
export type LogProvider = Pick<Console, 'log' | 'trace' | 'debug' | 'info' | 'warn' | 'error' > & {fatal?: (...args: any[]) => void};

/** Basic config */
export interface BaseConfig {
   /**
    * External logger. 
    * Default is `console`.
    */
   logger?: LogProvider;
 }
