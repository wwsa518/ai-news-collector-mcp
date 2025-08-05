import dotenv from 'dotenv';
import { z } from 'zod';
import { SystemConfig } from '../types';

dotenv.config();

const configSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.string().default('3000'),
  API_PORT: z.string().default('3001'),
  RSSHUB_URL: z.string().default('http://124.221.80.250:5678'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().default('0'),
  DATABASE_TYPE: z.enum(['sqlite', 'postgres']).default('sqlite'),
  DATABASE_PATH: z.string().default('./data/news.db'),
  PYTHON_SERVICE_URL: z.string().default('http://localhost:8000'),
  PYTHON_SERVICE_ENABLED: z.string().default('false'),
  OPENAI_API_KEY: z.string().optional(),
  LOG_LEVEL: z.string().default('info'),
  LOG_FILE: z.string().optional(),
  API_SECRET_KEY: z.string().default('your-secret-key-here'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

const validatedConfig = configSchema.parse(process.env);

export const config: SystemConfig = {
  nodeEnv: validatedConfig.NODE_ENV,
  port: parseInt(validatedConfig.PORT),
  apiPort: parseInt(validatedConfig.API_PORT),
  rsshubUrl: validatedConfig.RSSHUB_URL,
  redis: {
    host: validatedConfig.REDIS_HOST,
    port: parseInt(validatedConfig.REDIS_PORT),
    password: validatedConfig.REDIS_PASSWORD,
    db: parseInt(validatedConfig.REDIS_DB),
  },
  database: {
    type: validatedConfig.DATABASE_TYPE,
    path: validatedConfig.DATABASE_PATH,
  },
  pythonService: {
    url: validatedConfig.PYTHON_SERVICE_URL,
    enabled: validatedConfig.PYTHON_SERVICE_ENABLED === 'true',
  },
  openaiApiKey: validatedConfig.OPENAI_API_KEY,
  logging: {
    level: validatedConfig.LOG_LEVEL,
    file: validatedConfig.LOG_FILE,
  },
  security: {
    apiKey: validatedConfig.API_SECRET_KEY,
    corsOrigin: validatedConfig.CORS_ORIGIN,
  },
};

export default config;