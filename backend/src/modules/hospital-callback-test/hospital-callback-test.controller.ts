import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { HospitalCallbackTestDto } from './hospital-callback-test.dto';
import { HospitalCallbackTestService } from './hospital-callback-test.service';

@Controller('api/hospital/queue/step-id')
export class HospitalCallbackTestController {
  constructor(private readonly service: HospitalCallbackTestService) {}

  @Post()
  @HttpCode(200)
  receive(@Body() body: HospitalCallbackTestDto) {
    this.service.assertEnabled();
    return this.service.receive(body);
  }

  @Get('recent')
  recent(@Req() request: { socket: { remoteAddress?: string } }) {
    this.service.assertEnabled();
    this.service.assertLocalViewer(request.socket.remoteAddress);
    return this.service.listRecent();
  }
}
