// apps/runtime-service/src/runtime.types.ts

export interface StartWorkspacePayload {
    workspaceId: string;
    userId: string;
}

export interface StopWorkspacePayload {
    workspaceId: string;
    userId: string;
}

export interface WorkspaceStatusPayload {
    workspaceId: string;
    userId: string;
}

export interface DeleteWorkspacePayload {
    workspaceId: string;
    userId: string;

    /**
     * Delete the persistent source-code volume.
     *
     * Defaults to true.
     */
    deleteWorkspaceFiles?: boolean;

    /**
     * Delete the persistent CKB node data volume.
     *
     * Defaults to true.
     */
    deleteCkbData?: boolean;
}

export interface ResetWorkspacePayload {
    workspaceId: string;
    userId: string;
}

export interface ExecuteRuntimeCommandPayload {
    workspaceId: string;
    userId: string;
    command: string[];
    workingDirectory?: string;
}

export interface BuildWorkspacePayload {
    workspaceId: string;
    userId: string;
}

export interface TestWorkspacePayload {
    workspaceId: string;
    userId: string;
}

export interface RunContractPayload {
    workspaceId: string;
    userId: string;
}