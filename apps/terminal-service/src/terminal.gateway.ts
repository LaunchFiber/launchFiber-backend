// apps/terminal-service/src/terminal.gateway.ts
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server } from 'socket.io';

import { TerminalService } from './terminal-service.service';
import { type AuthenticatedSocket } from './terminal.types';

@WebSocketGateway({
    namespace: '/terminal',
    cors: {
        origin: true,
        credentials: true,
    },
    transports: ['websocket'],
})
export class TerminalGateway
    implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(
        TerminalGateway.name,
    );

    @WebSocketServer()
    server: Server;

    constructor(
        private readonly terminalService: TerminalService,
    ) { }

    async handleConnection(
        client: AuthenticatedSocket,
    ) {
        try {
            const token = this.extractToken(client);

            client.user =
                await this.terminalService.verifyToken(token);

            this.logger.log(
                `Terminal client connected: ${client.id}`,
            );

            client.emit('terminal:authenticated', {
                success: true,
                user: client.user,
            });
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Unauthorized';

            client.emit('terminal:error', {
                message,
            });

            client.disconnect(true);
        }
    }

    handleDisconnect(client: AuthenticatedSocket) {
        if (client.terminalStream) {
            client.terminalStream.end();
            client.terminalStream.destroy();
        }

        this.logger.log(
            `Terminal client disconnected: ${client.id}`,
        );
    }

    @SubscribeMessage('terminal:open')
    async openTerminal(
        @ConnectedSocket()
        client: AuthenticatedSocket,

        @MessageBody()
        payload: {
            workspaceId: string;
            cols?: number;
            rows?: number;
        },
    ) {
        if (!client.user) {
            client.emit('terminal:error', {
                message: 'Unauthenticated connection',
            });

            return;
        }

        if (client.terminalStream) {
            client.terminalStream.end();
            client.terminalStream.destroy();
        }

        try {
            const terminal =
                await this.terminalService.openTerminal(
                    client.user.id,
                    payload.workspaceId,
                );

            client.terminalStream = terminal.stream;
            client.terminalExecId = terminal.execId;
            client.workspaceId = payload.workspaceId;

            terminal.stream.on('data', (chunk: Buffer) => {
                client.emit(
                    'terminal:output',
                    chunk.toString('utf8'),
                );
            });

            terminal.stream.on('end', () => {
                client.emit('terminal:closed', {
                    workspaceId: payload.workspaceId,
                });
            });

            terminal.stream.on('error', (error) => {
                client.emit('terminal:error', {
                    message: error.message,
                });
            });

            client.emit('terminal:ready', {
                workspaceId: payload.workspaceId,
                execId: terminal.execId,
            });

            if (
                payload.cols &&
                payload.rows &&
                client.terminalExecId
            ) {
                await this.terminalService.resizeTerminal(
                    client.terminalExecId,
                    payload.cols,
                    payload.rows,
                );
            }
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Unable to open terminal';

            client.emit('terminal:error', {
                message,
            });
        }
    }

    @SubscribeMessage('terminal:input')
    writeInput(
        @ConnectedSocket()
        client: AuthenticatedSocket,

        @MessageBody()
        payload: {
            data: string;
        },
    ) {
        if (!client.terminalStream) {
            client.emit('terminal:error', {
                message: 'Terminal is not open',
            });

            return;
        }

        client.terminalStream.write(payload.data);
    }

    @SubscribeMessage('terminal:resize')
    async resizeTerminal(
        @ConnectedSocket()
        client: AuthenticatedSocket,

        @MessageBody()
        payload: {
            cols: number;
            rows: number;
        },
    ) {
        if (!client.terminalExecId) {
            return;
        }

        await this.terminalService.resizeTerminal(
            client.terminalExecId,
            payload.cols,
            payload.rows,
        );
    }

    @SubscribeMessage('terminal:close')
    closeTerminal(
        @ConnectedSocket()
        client: AuthenticatedSocket,
    ) {
        if (client.terminalStream) {
            client.terminalStream.end();
            client.terminalStream.destroy();
            client.terminalStream = undefined;
        }

        client.terminalExecId = undefined;
        client.workspaceId = undefined;

        client.emit('terminal:closed', {
            success: true,
        });
    }

    private extractToken(
        client: AuthenticatedSocket,
    ): string {
        const authToken =
            client.handshake.auth?.token as string | undefined;

        const authorizationHeader =
            client.handshake.headers.authorization;

        if (authToken) {
            return authToken.replace(/^Bearer\s+/i, '');
        }

        if (authorizationHeader) {
            return authorizationHeader.replace(
                /^Bearer\s+/i,
                '',
            );
        }

        throw new Error('Missing authentication token');
    }
}