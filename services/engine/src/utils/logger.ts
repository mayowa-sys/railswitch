import { Logger } from "../wrapper/subscription-wrapper";

type LogLevelName = "debug" | "info" | "warn" | "error" | "silent";

function formatTime(): string {
  return new Date().toISOString();
}

export class GlobalLogger implements Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private baseMeta(level: LogLevelName) {
    return `[${formatTime()}] [${level.toUpperCase()}] [${this.context}]`;
  }

  debug(...args: unknown[]) {
    console.debug(this.baseMeta("debug"), ...args);
  }

  info(...args: unknown[]) {
    console.info(this.baseMeta("info"), ...args);
  }

  warn(...args: unknown[]) {
    console.warn(this.baseMeta("warn"), ...args);
  }

  error(...args: unknown[]) {
    console.error(this.baseMeta("error"), ...args);
  }
}

// convenience factory
export function createLogger(context: string) {
  return new GlobalLogger(context);
}

export { LogLevelName };
