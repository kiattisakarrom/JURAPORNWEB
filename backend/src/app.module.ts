import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { PackageWorkflowModule } from './modules/package-workflow/package-workflow.module';
import { PatientModule } from './modules/patient/patient.module';
import { VerifyModule } from './modules/verify/verify.module';

const databaseProfile = process.env.DB_PROFILE ?? 'local';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: `.env.${databaseProfile}`,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    VerifyModule,
    PackageWorkflowModule,
    PatientModule,
  ],
})
export class AppModule {}
