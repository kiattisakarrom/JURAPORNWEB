import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ActorDto,
  CheckingPackagePairDto,
  ClaimVerifyLockDto,
  DispensingStatusDto,
  MatchingPackageScanDto,
  PackagesQueryDto,
  PackageTransitionDto,
  PackageWorkflowsQueryDto,
  SetPackagePendingDto,
  VerifyLockDto,
  VerifyPackageDto,
} from './dto/package-workflow.dto';
import {
  CheckingPairResponse,
  PackageResponse,
  PackageWorkflowResponse,
  VerifyPackageResponse,
} from './interfaces/package-workflow-response.interface';
import { PackageWorkflowService } from './package-workflow.service';

@Controller()
export class PackageWorkflowController {
  constructor(private readonly service: PackageWorkflowService) {}

  @Get('package-workflows')
  findWorkflows(
    @Query() query: PackageWorkflowsQueryDto,
  ): Promise<PackageWorkflowResponse[]> {
    return this.service.findWorkflows(query);
  }

  @Get('package-workflows/:workflowId')
  findWorkflow(
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
  ): Promise<PackageWorkflowResponse> {
    return this.service.findWorkflow(workflowId);
  }

  @Post('package-workflows/verify-lock')
  claimVerifyLock(
    @Body() body: ClaimVerifyLockDto,
  ): Promise<PackageWorkflowResponse> {
    return this.service.claimVerifyLock(body);
  }

  @Post('package-workflows/:workflowId/verify-lock/heartbeat')
  heartbeatVerifyLock(
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
    @Body() body: VerifyLockDto,
  ): Promise<PackageWorkflowResponse> {
    return this.service.heartbeatVerifyLock(workflowId, body);
  }

  @Delete('package-workflows/:workflowId/verify-lock')
  releaseVerifyLock(
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
    @Body() body: VerifyLockDto,
  ): Promise<PackageWorkflowResponse> {
    return this.service.releaseVerifyLock(workflowId, body);
  }

  @Post('package-workflows/:workflowId/verify')
  verifyPrescription(
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
    @Body() body: VerifyPackageDto,
  ): Promise<VerifyPackageResponse> {
    return this.service.verifyPrescription(workflowId, body);
  }

  @Post('package-workflows/pending')
  setPending(
    @Body() body: SetPackagePendingDto,
  ): Promise<PackageWorkflowResponse> {
    return this.service.setPending(body);
  }

  @Post('package-workflows/:workflowId/return-to-verify')
  returnToVerify(
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
    @Body() body: ActorDto,
  ): Promise<PackageWorkflowResponse> {
    return this.service.returnToVerify(workflowId, body.actorName);
  }

  @Get('packages')
  findPackages(@Query() query: PackagesQueryDto): Promise<PackageResponse[]> {
    return this.service.findPackages(query);
  }

  @Get('packages/:packageId')
  findPackage(
    @Param('packageId', new ParseUUIDPipe()) packageId: string,
  ): Promise<PackageResponse> {
    return this.service.findPackage(packageId);
  }

  @Post('packages/:packageId/transitions')
  transitionPackage(
    @Param('packageId', new ParseUUIDPipe()) packageId: string,
    @Body() body: PackageTransitionDto,
  ): Promise<PackageResponse> {
    return this.service.transitionPackage(packageId, body);
  }

  @Post('packages/:packageId/matching/scan')
  scanMatchingMedicine(
    @Param('packageId', new ParseUUIDPipe()) packageId: string,
    @Body() body: MatchingPackageScanDto,
  ): Promise<PackageResponse> {
    return this.service.scanMatchingMedicine(packageId, body);
  }

  @Post('packages/:packageId/checking/validate-pair')
  validateCheckingPair(
    @Param('packageId', new ParseUUIDPipe()) packageId: string,
    @Body() body: CheckingPackagePairDto,
  ): Promise<CheckingPairResponse> {
    return this.service.validateCheckingPair(packageId, body);
  }

  @Post('packages/:packageId/dispensing/status')
  updateDispensingStatus(
    @Param('packageId', new ParseUUIDPipe()) packageId: string,
    @Body() body: DispensingStatusDto,
  ): Promise<PackageResponse> {
    return this.service.updateDispensingStatus(packageId, body);
  }
}

