import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sql from 'mssql';

@Injectable()
export class DatabaseService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: sql.ConnectionPool | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const profile = this.configService.getOrThrow<string>('DB_PROFILE');
    const config: sql.config = {
      server: this.configService.getOrThrow<string>('DB_HOST'),
      port: this.configService.getOrThrow<number>('DB_PORT'),
      database: this.configService.getOrThrow<string>('DB_NAME'),
      user: this.configService.getOrThrow<string>('DB_USER'),
      password: this.configService.getOrThrow<string>('DB_PASSWORD'),
      connectionTimeout: this.configService.getOrThrow<number>(
        'DB_CONNECTION_TIMEOUT_MS',
      ),
      requestTimeout: this.configService.getOrThrow<number>(
        'DB_REQUEST_TIMEOUT_MS',
      ),
      pool: {
        max: this.configService.getOrThrow<number>('DB_POOL_MAX'),
        min: this.configService.getOrThrow<number>('DB_POOL_MIN'),
        idleTimeoutMillis: this.configService.getOrThrow<number>(
          'DB_POOL_IDLE_TIMEOUT_MS',
        ),
      },
      options: {
        encrypt: this.configService.getOrThrow<boolean>('DB_ENCRYPT'),
        trustServerCertificate: this.configService.getOrThrow<boolean>(
          'DB_TRUST_SERVER_CERTIFICATE',
        ),
        enableArithAbort: true,
        appName: 'juraporn-api',
      },
    };

    this.pool = await new sql.ConnectionPool(config).connect();
    this.logger.log(
      `Connected to ${profile} SQL Server database ${config.database} at ${config.server}:${config.port}`,
    );
  }

  createRequest(): sql.Request {
    if (!this.pool?.connected) {
      throw new ServiceUnavailableException('Database is not connected');
    }

    return this.pool.request();
  }

  async withTransaction<T>(
    work: (createRequest: () => sql.Request) => Promise<T>,
    isolationLevel: number = sql.ISOLATION_LEVEL.READ_COMMITTED,
  ): Promise<T> {
    if (!this.pool?.connected) {
      throw new ServiceUnavailableException('Database is not connected');
    }

    const transaction = new sql.Transaction(this.pool);
    await transaction.begin(isolationLevel);

    try {
      const result = await work(() => new sql.Request(transaction));
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
  }
}
