// apps/file-service/src/file.types.ts

export interface WorkspacePayload {
    workspaceId: string;
    userId: string;
}

export interface FilePathPayload
    extends WorkspacePayload {
    path: string;
}

export interface WriteFilePayload
    extends FilePathPayload {
    content: string;
}

export interface RenameFilePayload
    extends WorkspacePayload {
    oldPath: string;
    newPath: string;
}

export interface CreateDirectoryPayload
    extends WorkspacePayload {
    path: string;
}

export interface WorkspaceFile {
    name: string;
    path: string;
    type: 'file';
    content?: string;
    size?: number;
}

export interface WorkspaceDirectory {
    name: string;
    path: string;
    type: 'directory';
}

export type WorkspaceEntry =
    | WorkspaceFile
    | WorkspaceDirectory;