import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { PrintDrugLabelDto, PublishDrugLabelDraftDto, SaveDrugLabelDraftDto, SaveDrugLabelLogoDto } from './drug-label.dto';
import { DrugLabelService } from './drug-label.service';

@Controller()
export class DrugLabelController {
  constructor(private readonly service: DrugLabelService) {}

  @Get('drug-label-templates/current')
  current() { return this.service.current(); }

  @Put('drug-label-templates/draft')
  saveDraft(@Body() body: SaveDrugLabelDraftDto) { return this.service.saveDraft(body); }

  @Put('drug-label-templates/draft/logo')
  saveLogo(@Body() body: SaveDrugLabelLogoDto) { return this.service.saveLogo(body); }

  @Post('drug-label-templates/draft/publish')
  publish(@Body() body: PublishDrugLabelDraftDto) { return this.service.publish(body); }

  @Post('packages/:packageId/items/:itemId/label/print')
  print(
    @Param('packageId', ParseUUIDPipe) packageId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() body: PrintDrugLabelDto,
  ) { return this.service.print(packageId, itemId, body); }
}
