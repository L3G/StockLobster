type LogLevel = "info" | "warn" | "error";

const PREFIXES: Record<LogLevel, string> = {
  info: "[INFO]",
  warn: "[WARN]",
  error: "[ERROR]",
};

export function log(level: LogLevel, message: string): void {
  const timestamp = new Date().toISOString();
  const prefix = PREFIXES[level];
  const line = `${timestamp} ${prefix} ${message}`;

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}
