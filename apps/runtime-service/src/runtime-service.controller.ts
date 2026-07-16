// apps/runtime-service/src/runtime-service.controller.ts
import { Controller } from '@nestjs/common';
import {
  MessagePattern,
  Payload,
} from '@nestjs/microservices';
import { RuntimeServiceService } from './runtime-service.service';
import {
  type DeleteWorkspacePayload,
  type StartWorkspacePayload,
  type StopWorkspacePayload,
} from './runtime.types';

@Controller()
export class RuntimeServiceController {
  constructor(
    private readonly runtimeService: RuntimeServiceService,
  ) { }

  @MessagePattern({ cmd: 'runtime.health' })
  health() {
    return this.runtimeService.health();
  }

  @MessagePattern({ cmd: 'runtime.start' })
  startWorkspace(
    @Payload() payload: StartWorkspacePayload,
  ) {
    return this.runtimeService.startWorkspace(payload);
  }

  @MessagePattern({ cmd: 'runtime.stop' })
  stopWorkspace(
    @Payload() payload: StopWorkspacePayload,
  ) {
    return this.runtimeService.stopWorkspace(payload);
  }

  @MessagePattern({ cmd: 'runtime.status' })
  getWorkspaceStatus(
    @Payload()
    payload: {
      workspaceId: string;
      userId: string;
    },
  ) {
    return this.runtimeService.getWorkspaceStatus(
      payload.workspaceId,
      payload.userId,
    );
  }

  @MessagePattern({ cmd: 'runtime.delete' })
  deleteWorkspace(
    @Payload() payload: DeleteWorkspacePayload,
  ) {
    return this.runtimeService.deleteWorkspace(payload);
  }
}