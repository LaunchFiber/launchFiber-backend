// apps/terminal-service/src/terminal.types.ts
import { Socket } from 'socket.io';
import { Duplex } from 'stream';
import Docker from 'dockerode';

export interface AuthenticatedSocket extends Socket {
    user?: {
        id: string;
        email: string;
        name?: string;
    };
    terminalStream?: Duplex;
    terminalExecId?: string;
    workspaceId?: string;
    currentTestRun?: {
        runId: string;
        exec: Docker.Exec;
        stream: NodeJS.ReadableStream;
        containerId: string;
        startedAt?: number;
        cwd?: string;
    };
    currentBuild?: {
        buildId: string;
        exec: Docker.Exec;
        stream: NodeJS.ReadableStream;
        containerId: string;
        startedAt?: number;
        cwd?: string;
    };
}