// apps/file-service/src/file-service.controller.ts
import { Controller } from '@nestjs/common';
import {
  MessagePattern,
  Payload,
} from '@nestjs/microservices';

import { FileServiceService } from './file-service.service';
import {
  type CreateDirectoryPayload,
  type FilePathPayload,
  type RenameFilePayload,
  type WorkspacePayload,
  type WriteFilePayload,
} from './file.types';

@Controller()
export class FileServiceController {
  constructor(
    private readonly fileService:
      FileServiceService,
  ) { }

  @MessagePattern({ cmd: 'file.list' })
  list(
    @Payload() payload: WorkspacePayload,
  ) {
    return this.fileService.listFiles(payload);
  }

  @MessagePattern({ cmd: 'file.read' })
  read(
    @Payload() payload: FilePathPayload,
  ) {
    return this.fileService.readFile(payload);
  }

  @MessagePattern({ cmd: 'file.create' })
  create(
    @Payload() payload: WriteFilePayload,
  ) {
    return this.fileService.createFile(payload);
  }

  @MessagePattern({ cmd: 'file.update' })
  update(
    @Payload() payload: WriteFilePayload,
  ) {
    return this.fileService.updateFile(payload);
  }

  @MessagePattern({ cmd: 'file.delete' })
  delete(
    @Payload() payload: FilePathPayload,
  ) {
    return this.fileService.deleteEntry(payload);
  }

  @MessagePattern({ cmd: 'file.rename' })
  rename(
    @Payload() payload: RenameFilePayload,
  ) {
    return this.fileService.renameEntry(payload);
  }

  @MessagePattern({ cmd: 'file.mkdir' })
  mkdir(
    @Payload()
    payload: CreateDirectoryPayload,
  ) {
    return this.fileService.createDirectory(
      payload,
    );
  }
}