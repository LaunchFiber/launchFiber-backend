// apps/terminal-service/src/terminal.types.ts
import { Socket } from 'socket.io';
import { Duplex } from 'stream';

export interface AuthenticatedSocket extends Socket {
    user?: {
        id: string;
        email: string;
        role?: string;
    };

    terminalStream?: Duplex;

    terminalExecId?: string;

    workspaceId?: string;
}