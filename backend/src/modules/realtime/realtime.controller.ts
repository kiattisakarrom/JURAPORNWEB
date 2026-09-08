import { Body, Controller, Get, MessageEvent, Param, ParseUUIDPipe, Post, Query, Sse } from '@nestjs/common';
import { concat, Observable, of } from 'rxjs';
import { RealtimeService } from './realtime.service';
import { SnapshotPageDto, SyncChangesDto, SyncFilterDto } from './realtime.dto';

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly service: RealtimeService) {}
  @Post('snapshots') snapshot(@Body() filter: SyncFilterDto) { return this.service.snapshot(filter); }
  @Get('snapshots/:id') page(@Param('id',new ParseUUIDPipe()) id:string,@Query() query:SnapshotPageDto) {
    return this.service.page(id,Number(query.pageCursor));
  }
  @Get('changes') changes(@Query() query:SyncChangesDto) {return this.service.changes(query.cursor);}
  @Sse('events') events():Observable<MessageEvent> {
    return concat(of({type:'status',data:this.service.status()}),this.service.events);
  }
}
