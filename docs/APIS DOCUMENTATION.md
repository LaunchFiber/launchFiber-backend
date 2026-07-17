# FiberDev Studio API Documentation

## Overview

The FiberDev Studio API Gateway provides HTTP endpoints for authentication, workspace management, runtime management, file operations, and service health checks.

## Base URL

```text
http://localhost:<API_GATEWAY_PORT>
```

Example:

```text
http://localhost:8000
```

## Authentication

Most workspace, runtime, and file endpoints require a Bearer token:

```http
Authorization: Bearer <access_token>
```

---

# Authentication Endpoints

## Register User

```http
POST /auth/register
```

Creates a new FiberDev Studio user.

### Authentication

Not required.

### Request Body

```json
{
  "name": "Jimleston Osoi",
  "email": "jimleston@example.com",
  "password": "secure-password"
}
```

### Example

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jimleston Osoi",
    "email": "jimleston@example.com",
    "password": "secure-password"
  }'
```

## Login

```http
POST /auth/login
```

Authenticates a user and returns an access token.

### Request Body

```json
{
  "email": "jimleston@example.com",
  "password": "secure-password"
}   
```

### Example

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jimleston@example.com",
    "password": "secure-password"
  }'
```

## Verify Token

```http
POST /auth/verify
```

### Request Body

```json
{
  "token": "<access_token>"
}
```

## Get Current User

```http
GET /auth/me
```

Returns the authenticated user.

### Example

```bash
curl http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer <access_token>"
```

---

# Workspace Endpoints

## Create Workspace

```http
POST /workspaces
```

### Request Body

```json
{
  "name": "My CKB Workspace",
  "templateId": "optional-template-id"
}
```

| Field | Type | Required | Description |
|---|---|:---:|---|
| `name` | string | Yes | Workspace name |
| `templateId` | string | No | Starter template identifier |

### Example

```bash
curl -X POST http://localhost:8000/api/workspaces \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"My CKB Workspace"}'
```

## List Workspaces

```http
GET /workspaces
```

Returns all workspaces owned by the authenticated user.

## Get Workspace

```http
GET /workspaces/:id
```

Returns one workspace owned by the authenticated user.

## Delete Workspace

```http
DELETE /workspaces/:id
```

Deletes the complete workspace through the workspace service.

The workspace service should clean up runtime resources before deleting the workspace database record.

---

# Runtime Endpoints

## Start Workspace Runtime

```http
POST /workspaces/:id/start
```

The runtime service:

1. Creates a Docker network.
2. Creates the workspace source-code volume.
3. Creates the CKB data volume.
4. Starts the CKB node container.
5. Waits for the CKB RPC endpoint.
6. Starts the Fiber runtime container.
7. Generates the default CKB project.
8. Generates the default `hello-world` contract.
9. Marks the workspace as `RUNNING`.

### Internal Message Pattern

```text
runtime.start
```

### Internal Payload

```json
{
  "userId": "<user_id>",
  "workspaceId": "<workspace_id>"
}
```

## Stop Workspace Runtime

```http
POST /workspaces/:id/stop
```

Stops runtime containers without deleting persistent workspace or CKB data.

### Internal Message Pattern

```text
runtime.stop
```

## Get Runtime Status

```http
GET /workspaces/:id/status
```

Returns workspace status, Docker resource names, saved container records, and current Docker state.

### Example Response

```json
{
  "workspaceId": "workspace-uuid",
  "name": "My CKB Workspace",
  "status": "RUNNING",
  "runtimeNetwork": "fiberdev-workspace-uuid-network",
  "runtimeVolume": "fiberdev-workspace-uuid-workspace",
  "ckbDataVolume": "fiberdev-workspace-uuid-ckb-data",
  "lastStartedAt": "2026-07-17T12:00:00.000Z",
  "lastStoppedAt": null,
  "containers": [
    {
      "containerId": "docker-container-id",
      "name": "fiberdev-workspace-uuid-ckb",
      "image": "fiberdev/ckb-node:dev",
      "type": "CKB_NODE",
      "status": "RUNNING",
      "dockerState": "running",
      "dockerStatus": "Up 2 minutes",
      "internalPort": 8114,
      "hostPort": 49152
    }
  ]
}
```

### Internal Message Pattern

```text
runtime.status
```

## Reset Workspace Runtime

```http
POST /workspaces/:id/reset
```

Deletes the current containers, Docker network, workspace source-code volume, and CKB data volume, then provisions a new runtime.

> Warning: resetting removes persistent workspace files and development-chain data.

### Internal Message Pattern

```text
runtime.reset
```

## Delete Workspace Runtime

```http
DELETE /workspaces/:id/runtime
```

Deletes runtime infrastructure without deleting the workspace record.

### Query Parameters

| Parameter | Type | Default | Description |
|---|---|:---:|---|
| `deleteWorkspaceFiles` | boolean | `true` | Delete the persistent source-code volume |
| `deleteCkbData` | boolean | `true` | Delete the persistent CKB data volume |

Accepted values are `true`, `false`, `1`, and `0`.

### Preserve Workspace Files

```bash
curl -X DELETE \
  "http://localhost:8000/api/workspaces/<workspace_id>/runtime?deleteWorkspaceFiles=false" \
  -H "Authorization: Bearer <access_token>"
```

### Internal Message Pattern

```text
runtime.delete
```

## Execute Runtime Command

```http
POST /workspaces/:id/execute
```

Executes a command inside the workspace's `FIBER_RUNTIME` container.

### Request Body

```json
{
  "command": ["cargo", "--version"],
  "workingDirectory": "/workspace/ckb-rust-script"
}
```

| Field | Type | Required | Description |
|---|---|:---:|---|
| `command` | string array | Yes | Command and arguments |
| `workingDirectory` | string | No | Directory inside the runtime container |

### Example Response

```json
{
  "stdout": "cargo 1.x.x\n",
  "stderr": "",
  "exitCode": 0
}
```

### Internal Message Pattern

```text
runtime.execute
```

> Security: production deployments should add command allowlists, rate limits, audit logs, execution timeouts, and strict container isolation.

## Build Workspace

```http
POST /workspaces/:id/build
```

Runs:

```bash
make build
```

Internal message pattern: `runtime.build`.

## Test Workspace

```http
POST /workspaces/:id/test
```

Runs:

```bash
make test
```

Internal message pattern: `runtime.test`.

## Run Default Contract

```http
POST /workspaces/:id/run-contract
```

Runs the generated contract with `ckb-debugger`:

```bash
ckb-debugger --bin build/release/hello-world
```

Internal message pattern: `runtime.run-contract`.

---

# File Endpoints

All file paths are relative to the workspace root managed by the file service.

## List Files

```http
GET /workspaces/:id/files
```

Internal message pattern: `file.list`.

## Read File

```http
GET /workspaces/:id/files/content?path=<file_path>
```

### Query Parameters

| Parameter | Type | Required | Description |
|---|---|:---:|---|
| `path` | string | Yes | File path relative to the workspace root |

Internal message pattern: `file.read`.

## Create File

```http
POST /workspaces/:id/files
```

### Request Body

```json
{
  "path": "README.md",
  "content": "# My Fiber Project"
}
```

The `content` field is optional and defaults to an empty string.

Internal message pattern: `file.create`.

## Update File

```http
PUT /workspaces/:id/files
```

### Request Body

```json
{
  "path": "README.md",
  "content": "# Updated Fiber Project"
}
```

Internal message pattern: `file.update`.

## Delete File

```http
DELETE /workspaces/:id/files?path=<file_path>
```

Internal message pattern: `file.delete`.

## Create Directory

```http
POST /workspaces/:id/directories
```

### Request Body

```json
{
  "path": "contracts/new-contract"
}
```

Internal message pattern: `file.mkdir`.

## Rename File or Directory

```http
PUT /workspaces/:id/files/rename
```

### Request Body

```json
{
  "oldPath": "README.md",
  "newPath": "docs/README.md"
}
```

Internal message pattern: `file.rename`.

---

# Health Endpoints

## API Gateway Health

```http
GET /health
```

### Example Response

```json
{
  "status": "ok",
  "service": "api-gateway",
  "timestamp": "2026-07-17T12:00:00.000Z"
}
```

## Runtime Service Health

```http
GET /health/runtime
```

Checks whether the runtime service can connect to Docker.

### Example Response

```json
{
  "service": "runtime-service",
  "status": "ok",
  "timestamp": "2026-07-17T12:00:00.000Z"
}
```

Internal message pattern: `runtime.health`.

---

# Workspace Status Values

| Status | Description |
|---|---|
| `PENDING` | Workspace exists but has not been provisioned |
| `PROVISIONING` | Runtime resources are being created |
| `RUNNING` | Runtime containers are running |
| `IDLE` | Workspace is inactive but available |
| `STOPPED` | Runtime containers have been stopped |
| `FAILED` | Provisioning or a runtime operation failed |
| `DELETED` | Workspace runtime or workspace has been deleted |

# Runtime Container Types

| Type | Description |
|---|---|
| `IDE` | Browser IDE container |
| `CKB_NODE` | CKB development node |
| `FIBER_RUNTIME` | Fiber and CKB development runtime |
| `PREVIEW` | Application preview container |
| `TEST_RUNNER` | Isolated test runner |

# Runtime Container Status Values

| Status | Description |
|---|---|
| `CREATED` | Container has been created |
| `STARTING` | Container is starting |
| `RUNNING` | Container is running |
| `STOPPED` | Container has stopped |
| `FAILED` | Container operation failed |

---

# Error Responses

## Unauthorized

```json
{
  "statusCode": 401,
  "message": "Invalid or missing authentication token",
  "error": "Unauthorized"
}
```

## Bad Request

```json
{
  "statusCode": 400,
  "message": "Workspace runtime is not running",
  "error": "Bad Request"
}
```

## Gateway Timeout

```json
{
  "statusCode": 504,
  "message": "Request to runtime.start timed out",
  "error": "Gateway Timeout"
}
```

## Service Unavailable

```json
{
  "statusCode": 503,
  "message": "runtime.start service is unavailable",
  "error": "Service Unavailable"
}
```

---

# Runtime Configuration

## API Gateway

```env
API_GATEWAY_PORT=8000
RUNTIME_SERVICE_HOST=localhost
RUNTIME_SERVICE_PORT=3004
```

## Runtime Service

```env
DOCKER_SOCKET_PATH=/var/run/docker.sock

CKB_NODE_IMAGE=fiberdev/ckb-node:dev
FIBER_RUNTIME_IMAGE=fiberdev/ckb-runtime:dev

DEFAULT_PROJECT_NAME=ckb-rust-script
DEFAULT_CONTRACT_NAME=hello-world

CKB_NODE_MEMORY_BYTES=1073741824
CKB_NODE_NANO_CPUS=1000000000

RUNTIME_MEMORY_BYTES=2147483648
RUNTIME_NANO_CPUS=2000000000
```

---

# Endpoint Summary

| Method | Endpoint | Authentication | Service |
|---|---|:---:|---|
| POST | `/auth/register` | No | Auth |
| POST | `/auth/login` | No | Auth |
| POST | `/auth/verify` | No | Auth |
| GET | `/auth/me` | Yes | Auth |
| POST | `/workspaces` | Yes | Workspace |
| GET | `/workspaces` | Yes | Workspace |
| GET | `/workspaces/:id` | Yes | Workspace |
| DELETE | `/workspaces/:id` | Yes | Workspace |
| POST | `/workspaces/:id/start` | Yes | Runtime |
| POST | `/workspaces/:id/stop` | Yes | Runtime |
| GET | `/workspaces/:id/status` | Yes | Runtime |
| POST | `/workspaces/:id/reset` | Yes | Runtime |
| DELETE | `/workspaces/:id/runtime` | Yes | Runtime |
| POST | `/workspaces/:id/execute` | Yes | Runtime |
| POST | `/workspaces/:id/build` | Yes | Runtime |
| POST | `/workspaces/:id/test` | Yes | Runtime |
| POST | `/workspaces/:id/run-contract` | Yes | Runtime |
| GET | `/workspaces/:id/files` | Yes | File |
| GET | `/workspaces/:id/files/content` | Yes | File |
| POST | `/workspaces/:id/files` | Yes | File |
| PUT | `/workspaces/:id/files` | Yes | File |
| DELETE | `/workspaces/:id/files` | Yes | File |
| POST | `/workspaces/:id/directories` | Yes | File |
| PUT | `/workspaces/:id/files/rename` | Yes | File |
| GET | `/health` | No | API Gateway |
| GET | `/health/runtime` | No | Runtime |