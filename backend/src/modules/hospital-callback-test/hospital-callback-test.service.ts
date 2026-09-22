import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DispensingService } from '../dispensing/dispensing.service';
import { HospitalCallbackTestDto } from './hospital-callback-test.dto';

@Injectable()
export class HospitalCallbackTestService {
  constructor(private readonly config: ConfigService, private readonly dispensing: DispensingService) {}

  assertEnabled(): void {
    const enabled = this.config.get<boolean>('HOSPITAL_QUEUE_CALLBACK_ENABLED')
      || (this.config.get<string>('DB_PROFILE') === 'local'
        && this.config.get<string>('NODE_ENV') !== 'production'
        && this.config.get<boolean>('HOSPITAL_CALLBACK_TEST_ENABLED'));
    if (!enabled || !this.config.get<boolean>('PACKAGE_WORKFLOW_ENABLED')) {
      throw new ServiceUnavailableException('Hospital queue callback is disabled for this database profile');
    }
  }

  assertLocalViewer(remoteAddress: string | undefined): void {
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remoteAddress ?? '')) {
      throw new ForbiddenException('Recent callbacks can only be viewed locally');
    }
  }

  receive(body: HospitalCallbackTestDto) {
    return this.dispensing.receiveReady(body.vn, body.visit_date);
  }

  listRecent() {
    return this.dispensing.recent();
  }
}
