import { Injectable } from '@nestjs/common';

@Injectable()
export class TerminalServiceService {
  getHello(): string {
    return 'Hello World!';
  }
}
