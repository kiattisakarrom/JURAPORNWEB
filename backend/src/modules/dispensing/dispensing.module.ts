import { Module } from '@nestjs/common';
import { DispensingController } from './dispensing.controller';
import { DispensingService } from './dispensing.service';

@Module({ controllers: [DispensingController], providers: [DispensingService], exports: [DispensingService] })
export class DispensingModule {}
