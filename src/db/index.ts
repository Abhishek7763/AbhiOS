import {
  AuthTypes,
  Connector,
  GoogleAuth,
  IpAddressTypes,
} from '@google-cloud/cloud-sql-connector';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, PoolClient, PoolConfig } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
  var _cloudSqlConnector: Connector | undefined;
  var _cloudSqlStreamPromise: Promise<() => unknown> | undefined;
}

export type SqlConnectionMode = 'connector' | 'direct';

export function resolveSqlConnectionMode(
  env: Record<string, string | undefined> = process.env
): SqlConnectionMode {
  const explicit = env.SQL_CONNECTION_MODE?.trim().toLowerCase();
  if (explicit === 'connector') return 'connector';
  if (explicit === 'direct') return 'direct';
  if (env.CLOUD_SQL_INSTANCE_CONNECTION_NAME?.trim()) {
    return 'connector';
  }
  return 'direct';
}

export function resolvePoolMax(
  env: Record<string, string | undefined> = process.env
): number {
  const raw = Number(env.SQL_POOL_MAX);
  if (Number.isFinite(raw) && raw >= 1) {
    return Math.min(2, Math.floor(raw));
  }
  return 2;
}

function resolveIpType(
  env: Record<string, string | undefined> = process.env
): IpAddressTypes {
  const raw = env.CLOUD_SQL_IP_TYPE?.trim().toUpperCase();
  if (raw === 'PRIVATE') return IpAddressTypes.PRIVATE;
  if (raw === 'PSC') return IpAddressTypes.PSC;
  return IpAddressTypes.PUBLIC;
}

function getOrCreateConnector(): Connector {
  if (!global._cloudSqlConnector) {
    const rawJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim();
    if (rawJson) {
      let credentials: Record<string, unknown>;
      try {
        credentials = JSON.parse(rawJson) as Record<string, unknown>;
      } catch {
        throw new Error(
          'Invalid GOOGLE_APPLICATION_CREDENTIALS_JSON format (expected valid JSON).'
        );
      }
      const auth = new GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/sqlservice.admin'],
      });
      global._cloudSqlConnector = new Connector({ auth });
    } else {
      global._cloudSqlConnector = new Connector();
    }
  }
  return global._cloudSqlConnector;
}

async function getConnectorStreamFactory(): Promise<() => unknown> {
  if (!global._cloudSqlStreamPromise) {
    global._cloudSqlStreamPromise = (async () => {
      const instanceConnectionName =
        process.env.CLOUD_SQL_INSTANCE_CONNECTION_NAME?.trim();
      if (!instanceConnectionName) {
        throw new Error(
          'CLOUD_SQL_INSTANCE_CONNECTION_NAME is required when SQL_CONNECTION_MODE=connector.'
        );
      }
      const connector = getOrCreateConnector();
      const clientOpts = await connector.getOptions({
        instanceConnectionName,
        ipType: resolveIpType(),
        authType:
          process.env.CLOUD_SQL_AUTH_TYPE?.trim().toUpperCase() === 'IAM'
            ? AuthTypes.IAM
            : AuthTypes.PASSWORD,
      });
      return clientOpts.stream as () => unknown;
    })().catch((err) => {
      global._cloudSqlStreamPromise = undefined;
      throw err;
    });
  }
  return global._cloudSqlStreamPromise;
}

function buildDirectSslConfig(
  host: string | undefined
): PoolConfig['ssl'] {
  const sslEnv = process.env.SQL_SSL?.trim().toLowerCase();
  if (sslEnv === 'false' || sslEnv === '0') {
    return false;
  }
  const isUnixSocket = Boolean(host && host.startsWith('/'));
  const isLocalhost =
    !host || host === 'localhost' || host === '127.0.0.1' || host === '::1';

  if (sslEnv === 'true' || sslEnv === '1' || (!isUnixSocket && !isLocalhost)) {
    return {
      rejectUnauthorized:
        process.env.SQL_SSL_REJECT_UNAUTHORIZED?.trim().toLowerCase() !==
        'false',
    };
  }
  return false;
}

class ServerlessCloudSqlPool extends Pool {
  private readonly mode: SqlConnectionMode;

  constructor(config: PoolConfig, mode: SqlConnectionMode) {
    super(config);
    this.mode = mode;
  }

  override connect(): Promise<PoolClient>;
  override connect(
    callback: (
      err: Error | undefined,
      client: PoolClient | undefined,
      done: (release?: unknown) => void
    ) => void
  ): void;
  override connect(
    callback?: (
      err: Error | undefined,
      client: PoolClient | undefined,
      done: (release?: unknown) => void
    ) => void
  ): Promise<PoolClient> | void {
    if (this.mode !== 'connector') {
      if (callback) {
        super.connect(callback);
        return;
      }
      return super.connect();
    }

    const opts = (this as unknown as { options: Record<string, unknown> })
      .options;

    if (callback) {
      if (typeof opts.stream === 'function') {
        super.connect(callback);
        return;
      }
      getConnectorStreamFactory()
        .then((streamFactory) => {
          opts.stream = streamFactory;
          super.connect(callback);
        })
        .catch((err) => {
          callback(
            err instanceof Error
              ? err
              : new Error('Cloud SQL Connector initialization failed.'),
            undefined,
            () => {}
          );
        });
      return;
    }

    return (async () => {
      if (typeof opts.stream !== 'function') {
        opts.stream = await getConnectorStreamFactory();
      }
      return super.connect();
    })();
  }
}

export const createPool = (): Pool => {
  if (!global._postgresPool) {
    const mode = resolveSqlConnectionMode();
    const maxConnections = resolvePoolMax();
    const host = process.env.SQL_HOST?.trim();
    const port = process.env.SQL_PORT
      ? Number(process.env.SQL_PORT)
      : 5432;

    const baseConfig: PoolConfig = {
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: maxConnections,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    };

    if (mode === 'direct') {
      baseConfig.host = host;
      if (host && !host.startsWith('/')) {
        baseConfig.port = Number.isFinite(port) ? port : 5432;
      }
      baseConfig.ssl = buildDirectSslConfig(host);
    }

    global._postgresPool = new ServerlessCloudSqlPool(baseConfig, mode);

    global._postgresPool.on('error', () => {
      console.error('Unexpected error on idle SQL pool client.');
    });
  }
  return global._postgresPool;
};

export const pool = createPool();

export const db = drizzle(pool, { schema });
