import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }

  return value;
};

class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV = 'development';

  @IsIn(['local', 'live'])
  DB_PROFILE = 'local';

  @Transform(toBoolean)
  @IsBoolean()
  PACKAGE_WORKFLOW_ENABLED = true;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3001;

  @IsString()
  @IsNotEmpty()
  CORS_ORIGINS = 'http://localhost:3000';

  @IsString()
  @IsNotEmpty()
  DB_HOST!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT = 1433;

  @IsString()
  @IsNotEmpty()
  DB_NAME!: string;

  @IsString()
  @IsNotEmpty()
  DB_USER!: string;

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD!: string;

  @Transform(toBoolean)
  @IsBoolean()
  DB_ENCRYPT = false;

  @Transform(toBoolean)
  @IsBoolean()
  DB_TRUST_SERVER_CERTIFICATE = true;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  DB_POOL_MAX = 10;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  DB_POOL_MIN = 0;

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  DB_POOL_IDLE_TIMEOUT_MS = 30000;

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  DB_CONNECTION_TIMEOUT_MS = 15000;

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  DB_REQUEST_TIMEOUT_MS = 30000;
}

export function validateEnvironment(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
  });
  const errors = validateSync(validated, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validated;
}
