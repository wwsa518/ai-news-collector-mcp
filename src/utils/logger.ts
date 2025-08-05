import { createLogger, format, transports } from 'winston';
import path from 'path';

export const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'ai-news-collector' },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    new transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

export class SimpleLogger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  info(message: string, meta?: any) {
    logger.info(message, { ...meta, context: this.context });
  }

  error(message: string, error?: any, meta?: any) {
    logger.error(message, { 
      ...meta, 
      context: this.context,
      error: error?.stack || error 
    });
  }

  warn(message: string, meta?: any) {
    logger.warn(message, { ...meta, context: this.context });
  }

  debug(message: string, meta?: any) {
    logger.debug(message, { ...meta, context: this.context });
  }
}