// apps/runtime-service/src/runtime-service.controller.ts

import { Controller } from '@nestjs/common';

import {
    MessagePattern,
    Payload,
} from '@nestjs/microservices';

import { RuntimeServiceService } from './runtime-service.service';

import type {
    BuildWorkspacePayload,
    DeleteWorkspacePayload,
    ExecuteRuntimeCommandPayload,
    ResetWorkspacePayload,
    RunContractPayload,
    StartWorkspacePayload,
    StopWorkspacePayload,
    TestWorkspacePayload,
    WorkspaceStatusPayload,
} from './runtime.types';

@Controller()
export class RuntimeServiceController {
    constructor(
        private readonly runtimeService: RuntimeServiceService,
    ) { }

    @MessagePattern({
        cmd: 'runtime.health',
    })
    health() {
        return this.runtimeService.health();
    }

    @MessagePattern({
        cmd: 'runtime.start',
    })
    startWorkspace(
        @Payload()
        payload: StartWorkspacePayload,
    ) {
        return this.runtimeService.startWorkspace(payload);
    }

    @MessagePattern({
        cmd: 'runtime.stop',
    })
    stopWorkspace(
        @Payload()
        payload: StopWorkspacePayload,
    ) {
        return this.runtimeService.stopWorkspace(payload);
    }

    @MessagePattern({
        cmd: 'runtime.status',
    })
    getWorkspaceStatus(
        @Payload()
        payload: WorkspaceStatusPayload,
    ) {
        return this.runtimeService.getWorkspaceStatus(payload);
    }

    @MessagePattern({
        cmd: 'runtime.delete',
    })
    deleteWorkspace(
        @Payload()
        payload: DeleteWorkspacePayload,
    ) {
        return this.runtimeService.deleteWorkspace(payload);
    }

    @MessagePattern({
        cmd: 'runtime.reset',
    })
    resetWorkspace(
        @Payload()
        payload: ResetWorkspacePayload,
    ) {
        return this.runtimeService.resetWorkspace(
            payload.workspaceId,
            payload.userId,
        );
    }

    @MessagePattern({
        cmd: 'runtime.execute',
    })
    executeCommand(
        @Payload()
        payload: ExecuteRuntimeCommandPayload,
    ) {
        return this.runtimeService.executeRuntimeCommand(
            payload.workspaceId,
            payload.command,
            payload.workingDirectory,
            payload.userId,
        );
    }

    @MessagePattern({
        cmd: 'runtime.build',
    })
    buildWorkspace(
        @Payload()
        payload: BuildWorkspacePayload,
    ) {
        return this.runtimeService.buildProject(
            payload.workspaceId,
            payload.userId,
        );
    }

    @MessagePattern({
        cmd: 'runtime.test',
    })
    testWorkspace(
        @Payload()
        payload: TestWorkspacePayload,
    ) {
        return this.runtimeService.testProject(
            payload.workspaceId,
            payload.userId,
        );
    }

    @MessagePattern({
        cmd: 'runtime.run-contract',
    })
    runContract(
        @Payload()
        payload: RunContractPayload,
    ) {
        return this.runtimeService.runDefaultContract(
            payload.workspaceId,
            payload.userId,
        );
    }
}