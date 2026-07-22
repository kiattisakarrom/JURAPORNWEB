import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { PatientModule } from './modules/patient/patient.module';
import { VerifyModule } from './modules/verify/verify.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    VerifyModule,
    PatientModule,
  ],
})
export class AppModule {}
