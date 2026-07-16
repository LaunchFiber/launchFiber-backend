// apps/runtime-service/src/runtime.types.ts

export type RuntimeContainerType =
    | 'IDE'
    | 'FIBER_RUNTIME'
    | 'PREVIEW'
    | 'TEST_RUNNER';

export interface StartWorkspacePayload {
    workspaceId: string;
    userId: string;
}

export interface StopWorkspacePayload {
    workspaceId: string;
    userId: string;
}

export interface DeleteWorkspacePayload {
    workspaceId: string;
    userId: string;
}