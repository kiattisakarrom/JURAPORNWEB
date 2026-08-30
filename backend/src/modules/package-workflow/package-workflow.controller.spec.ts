import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PackageWorkflowResponse } from './interfaces/package-workflow-response.interface';
import { PackageWorkflowController } from './package-workflow.controller';
import { PackageWorkflowService } from './package-workflow.service';

describe('PackageWorkflowController', () => {
  const service = {
    findWorkflows: jest.fn(),
    findPackages: jest.fn(),
    findWorkflow: jest.fn(),
  } as unknown as PackageWorkflowService;

  beforeEach(() => jest.clearAllMocks());

  it('returns empty list responses without querying workflow tables when disabled', async () => {
    const configService = {
      getOrThrow: jest.fn().mockReturnValue(false),
    } as unknown as ConfigService;
    const controller = new PackageWorkflowController(service, configService);

    await expect(controller.findWorkflows({ limit: 200 })).resolves.toEqual(
      [],
    );
    await expect(controller.findPackages({ limit: 200 })).resolves.toEqual([]);
    expect(service.findWorkflows).not.toHaveBeenCalled();
    expect(service.findPackages).not.toHaveBeenCalled();
  });

  it('rejects detail and mutation operations clearly when disabled', () => {
    const configService = {
      getOrThrow: jest.fn().mockReturnValue(false),
    } as unknown as ConfigService;
    const controller = new PackageWorkflowController(service, configService);

    expect(() =>
      controller.findWorkflow('22222222-2222-2222-2222-222222222222'),
    ).toThrow(ServiceUnavailableException);
    expect(service.findWorkflow).not.toHaveBeenCalled();
  });

  it('delegates to the workflow service when enabled', async () => {
    const workflows: PackageWorkflowResponse[] = [];
    const configService = {
      getOrThrow: jest.fn().mockReturnValue(true),
    } as unknown as ConfigService;
    const enabledService = {
      findWorkflows: jest.fn().mockResolvedValue(workflows),
    } as unknown as PackageWorkflowService;
    const controller = new PackageWorkflowController(
      enabledService,
      configService,
    );

    await expect(controller.findWorkflows({ limit: 200 })).resolves.toBe(
      workflows,
    );
    expect(enabledService.findWorkflows).toHaveBeenCalledWith({ limit: 200 });
  });
});
