import { Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ChannelClaimDto, DispensingHistoryDto, ForceReleaseChannelDto, QueueChangesDto, TransferPackageDto } from './dispensing.dto';
import { DispensingService } from './dispensing.service';

@Controller('dispensing')
export class DispensingController {
  constructor(private readonly service: DispensingService) {}

  @Get('queue')
  queue() { return this.service.queue(); }

  @Get('queue/changes')
  changes(@Query() query: QueueChangesDto) { return this.service.changes(query.cursor); }

  @Get('channels')
  channels() { return this.service.channels(); }

  @Post('channels/:channel/claim')
  claim(@Param('channel', ParseIntPipe) channel: number, @Body() body: ChannelClaimDto) {
    return this.service.claim(channel, body.claimToken);
  }

  @Post('channels/:channel/claim/validate')
  validateClaim(@Param('channel', ParseIntPipe) channel: number, @Body() body: ChannelClaimDto) {
    return this.service.validateClaim(channel, body.claimToken);
  }

  @Delete('channels/:channel/claim')
  release(@Param('channel', ParseIntPipe) channel: number, @Body() body: ChannelClaimDto) {
    return this.service.release(channel, body.claimToken);
  }

  @Post('channels/:channel/claim/release-on-close')
  releaseOnClose(@Param('channel', ParseIntPipe) channel: number, @Body() body: ChannelClaimDto) {
    return this.service.release(channel, body.claimToken, 'ผู้ถือช่องปิดแท็บหรือปิดเว็บไซต์');
  }

  @Post('channels/:channel/force-release')
  forceRelease(@Param('channel', ParseIntPipe) channel: number, @Body() body: ForceReleaseChannelDto) {
    return this.service.forceRelease(channel, body);
  }

  @Post('packages/:packageId/transfer/:channel')
  transfer(@Param('packageId', ParseUUIDPipe) packageId: string,
    @Param('channel', ParseIntPipe) channel: number, @Body() body: TransferPackageDto) {
    return this.service.transfer(packageId, channel, body);
  }

  @Get('history')
  history(@Query() query: DispensingHistoryDto) { return this.service.history(query); }
}
