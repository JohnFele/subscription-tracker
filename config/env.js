import { config } from 'dotenv';

config({ path: `.env.${process.env.NODE_ENV || 'development'}.local` });

export const { 
  PORT,
  SERVER_URL,
  NODE_ENV, 
  DB_URI,
  JWT_SECRET,
  JWT_EXPIRES_IN, 
  ARCJET_API_KEY,
  ARCJET_ENV,
  QSTASH_URL,
  QSTASH_TOKEN,
  GMAIL_PASS,
  GMAIL_USER,
} = process.env;
