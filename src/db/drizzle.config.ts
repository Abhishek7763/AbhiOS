import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

const sqlHost = process.env.SQL_HOST?.trim();
const sqlPort = process.env.SQL_PORT ? Number(process.env.SQL_PORT) : 5432;
const sqlDbName = process.env.SQL_DB_NAME?.trim();
const user = (process.env.SQL_ADMIN_USER || process.env.SQL_USER)?.trim();
const password =
  process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD || '';

if (!sqlHost) {
  throw new Error('SQL_HOST must be set in environment variables.');
}
if (!sqlDbName) {
  throw new Error('SQL_DB_NAME must be set in environment variables.');
}
if (!user) {
  throw new Error(
    'SQL_ADMIN_USER (or SQL_USER) must be set in environment variables.'
  );
}
if (!password) {
  throw new Error(
    'SQL_ADMIN_PASSWORD (or SQL_PASSWORD) must be set in environment variables.'
  );
}

const isUnixSocket = sqlHost.startsWith('/');
const isLocalhost =
  sqlHost === 'localhost' || sqlHost === '127.0.0.1' || sqlHost === '::1';
const sslEnabled =
  process.env.SQL_SSL === 'true' ||
  (process.env.SQL_SSL !== 'false' && !isUnixSocket && !isLocalhost);

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['public'],
  dbCredentials: {
    host: sqlHost,
    port: Number.isFinite(sqlPort) ? sqlPort : 5432,
    user,
    password,
    database: sqlDbName,
    ssl: sslEnabled
      ? {
          rejectUnauthorized:
            process.env.SQL_SSL_REJECT_UNAUTHORIZED !== 'false',
        }
      : false,
  },
  verbose: true,
});
