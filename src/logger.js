import winston from "winston";
import path from "path";
const { format } = winston;

const logDir = process.env.LOG_DIR || "./logs";

// Get the execution file name and current date for log file naming
function getExecutionFileName() {
  // Use import.meta.url for ES modules or process.argv[1] as fallback
  if (process.argv[1]) {
    return path.basename(process.argv[1], path.extname(process.argv[1]));
  }
  // Final fallback
  return "app";
}

function getCurrentDateString() {
  const now = new Date();
  return now.toISOString().split("T")[0]; // YYYY-MM-DD format
}

const executionFileName = getExecutionFileName();
const dateString = getCurrentDateString();
const logFilePrefix = `${executionFileName}_${dateString}`;
const formatCustom = format.printf(
  ({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  }
);
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    formatCustom
  ),
  defaultMeta: { service: "hamichlol-bot" },
  transports: [
    //
    // Log files are named based on level first: {level}_{filename}_{YYYY-MM-DD}.log
    //
    new winston.transports.File({
      dirname: logDir,
      filename: `error_${logFilePrefix}.log`,
      level: "error",
    }),
    new winston.transports.File({
      dirname: logDir,
      filename: `warnings_${logFilePrefix}.log`,
      level: "warn",
    }),
    new winston.transports.File({
      dirname: logDir,
      filename: `combined_${logFilePrefix}.log`,
    }),
    new winston.transports.File({
      dirname: logDir,
      filename: `filter_${logFilePrefix}.log`,
      level: "info",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        formatCustom,
        winston.format((info) => {
          if (info.service === "filter") {
            return info;
          }
          return false;
        })()
      ),
    }),
    new winston.transports.Console(),
  ],
  exitOnError: false,
});

export default logger;
