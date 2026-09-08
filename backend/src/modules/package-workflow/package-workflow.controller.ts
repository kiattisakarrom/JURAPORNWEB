import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ActorDto,
  CheckingPackagePairDto,
  ClaimVerifyLockDto,
  DispensingStatusDto,
  MatchingPackageScanDto,
  PackagesQueryDto,
  PackageTransitionDto,
  PackageWorkflowsQueryDto,
  SavePackageNoteDto,
  SaveVerifyNoteDto,
  SetPackagePendingDto,
  VerifyLockDto,
  VerifyPackageDto,
} from './dto/package-workflow.dto';
import {
  CheckingPairResponse,
  PackageNoteResponse,
  PackageResponse,
  PackageWorkflowResponse,
  VerifyNoteResponse,
  VerifyPackageResponse,
} from './interfaces/package-workflow-response.interface';
import { PackageWorkflowService } from './package-workflow.service';

@Controller()
export class PackageWorkflowController {
  constructor(
    private readonly service: PackageWorkflowService,
    private readonly configService: ConfigService,
  ) {}

  @Get('package-workflows')
  findWorkflows(
    @Query() query: PackageWorkflowsQueryDto,
  ): Promise<PackageWorkflowResponse[]> {
    if (!this.isEnabled()) return Promise.resolve([]);
    return this.service.findWorkflows(query);
  }

  @Get('package-workflows/:workflowId')
  findWorkflow(
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
  ): Promise<PackageWorkflowResponse> {
    this.assertEnabled();
    return this.service.findWorkflow(workflowId);
  }

  @Post('package-workflows/verify-lock')
  claimVerifyLock(
    @Body() body: ClaimVerifyLockDto,
  ): Promise<PackageWorkflowResponse> {
    this.assertEnabled();
    return this.service.claimVerifyLock(body);
  }

  @Post('package-workflows/:workflowId/verify-lock/heartbeat')
  heartbeatVerifyLock(
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
    @Body() body: VerifyLockDto,
    @Query('compact') compact?: string,
  ) {
    this.assertEnabled();
    return this.service.heartbeatVerifyLock(workflowId, body, compact === 'true');
  }

  @Delete('package-workflows/:workflowId/verify-lock')
  releaseVerifyLock(
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
    @Body() body: VerifyLockDto,
  ): Promise<PackageWorkflowResponse> {
    this.assertEnabled();
    return this.service.releaseVerifyLock(workflowId, body);
  }

  @Put('package-workflows/:workflowId/verify-note')
  saveVerifyNote(
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
    @Body() body: SaveVerifyNoteDto,
  ): Promise<VerifyNoteResponse> {
    this.assertEnabled();
    return this.service.saveVerifyNote(workflowId, body);
  }

  @Post('package-workflows/:workflowId/verify')
  verifyPrescription(
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
    @Body() body: VerifyPackageDto,
  ): Promise<VerifyPackageResponse> {
    this.assertEnabled();
    return this.service.verifyPrescription(workflowId, body);
  }

  @Post('package-workflows/pending')
  setPending(
    @Body() body: SetPackagePendingDto,
  ): Promise<PackageWorkflowResponse> {
    this.assertEnabled();
    return this.service.setPending(body);
  }

  @Post('package-workflows/:workflowId/return-to-verify')
  returnToVerify(
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
    @Body() body: ActorDto,
  ): Promise<PackageWorkflowResponse> {
    this.assertEnabled();
    return this.service.returnToVerify(workflowId, body.actorName);
  }

  @Get('packages')
  findPackages(@Query() query: PackagesQueryDto): Promise<PackageResponse[]> {
    if (!this.isEnabled()) return Promise.resolve([]);
    return this.service.findPackages(query);
  }

  @Get('packages/:packageId')
  findPackage(
    @Param('packageId', new ParseUUIDPipe()) packageId: string,
  ): Promise<PackageResponse> {
    this.assertEnabled();
    return this.service.findPackage(packageId);
  }

  @Put('packages/:packageId/note')
  savePackageNote(
    @Param('packageId', new ParseUUIDPipe()) packageId: string,
    @Body() body: SavePackageNoteDto,
  ): Promise<PackageNoteResponse> {
    this.assertEnabled();
    return this.service.savePackageNote(packageId, body);
  }

  @Post('packages/:packageId/transitions')
  transitionPackage(
    @Param('packageId', new ParseUUIDPipe()) packageId: string,
    @Body() body: PackageTransitionDto,
  ): Promise<PackageResponse> {
    this.assertEnabled();
    return this.service.transitionPackage(packageId, body);
  }

  @Post('packages/:packageId/matching/scan')
  scanMatchingMedicine(
    @Param('packageId', new ParseUUIDPipe()) packageId: string,
    @Body() body: MatchingPackageScanDto,
  ): Promise<PackageResponse> {
    this.assertEnabled();
    return this.service.scanMatchingMedicine(packageId, body);
  }

  @Post('packages/:packageId/checking/validate-pair')
  validateCheckingPair(
    @Param('packageId', new ParseUUIDPipe()) packageId: string,
    @Body() body: CheckingPackagePairDto,
  ): Promise<CheckingPairResponse> {
    this.assertEnabled();
    return this.service.validateCheckingPair(packageId, body);
  }

  @Post('packages/:packageId/dispensing/status')
  updateDispensingStatus(
    @Param('packageId', new ParseUUIDPipe()) packageId: string,
    @Body() body: DispensingStatusDto,
  ): Promise<PackageResponse> {
    this.assertEnabled();
    return this.service.updateDispensingStatus(packageId, body);
  }

  private isEnabled(): boolean {
    return this.configService.getOrThrow<boolean>('PACKAGE_WORKFLOW_ENABLED');
  }

  private assertEnabled(): void {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException(
        'Package workflow is disabled for the selected database profile',
      );
    }
  }
}
