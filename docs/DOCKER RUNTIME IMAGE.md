# Building and Deploying the Fiber Runtime Docker Image

## Overview

The Fiber Runtime image provides the isolated development environment used by FiberDev Studio workspaces. Every workspace launches a dedicated runtime container responsible for compiling, testing, and executing CKB/Fiber projects.

The runtime image includes:

* Rust toolchain
* Cargo
* Cargo Generate
* RISC-V target
* Clang/LLVM
* Build tools
* Git
* CMake
* OpenSSL development libraries
* CKB development tools (optional)
* Fiber CLI (optional)

---

# Directory Structure

```text
backend/
├── docker/
│   ├── ckb-node/
│   │   └── Dockerfile
│   └── ckb-runtime/
│       └── Dockerfile
└── apps/
```

---

# Runtime Dockerfile

Example:

```dockerfile
FROM rust:1.82-bookworm

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    make \
    curl \
    wget \
    git \
    bash \
    sed \
    coreutils \
    build-essential \
    clang \
    llvm \
    libclang-dev \
    cmake \
    pkg-config \
    libssl-dev \
    ca-certificates \
    unzip \
    jq \
    && rm -rf /var/lib/apt/lists/*

RUN rustup target add riscv64imac-unknown-none-elf

RUN cargo install cargo-generate --version "^0.17" --locked

WORKDIR /workspace

CMD ["sh", "-c", "while true; do sleep 3600; done"]
```

---

# Build the Image

From the backend root:

```bash
docker build \
    -t fiberdev/ckb-runtime:dev \
    docker/ckb-runtime
```

If your Dockerfile has a different name:

```bash
docker build \
    -t fiberdev/ckb-runtime:dev \
    -f docker/ckb-runtime/Dockerfile \
    .
```

---

# Verify the Image

List local images:

```bash
docker images
```

Expected output:

```text
REPOSITORY                 TAG
fiberdev/ckb-node          dev
fiberdev/ckb-runtime       dev
```

---

# Test the Runtime Image

Open a shell inside the image:

```bash
docker run --rm -it \
    fiberdev/ckb-runtime:dev \
    bash
```

Verify Rust:

```bash
rustc --version
cargo --version
```

Verify Cargo Generate:

```bash
cargo generate --version
```

Verify Clang:

```bash
clang --version
```

Verify LLVM:

```bash
llvm-config --version
```

Verify the RISC-V target:

```bash
rustup target list --installed
```

Expected:

```text
riscv64imac-unknown-none-elf
```

---

# Runtime Service Configuration

Configure the runtime image in your `.env` file.

```env
FIBER_RUNTIME_IMAGE=fiberdev/ckb-runtime:dev
```

The runtime service reads this value whenever it provisions a workspace.

---

# Workspace Startup Flow

When a workspace is started, the Runtime Service performs the following steps:

1. Creates a Docker network.
2. Creates the workspace source volume.
3. Creates the CKB data volume.
4. Starts the CKB node container.
5. Waits until the CKB RPC endpoint becomes available.
6. Ensures the runtime image exists locally.
7. Starts the runtime container.
8. Generates the default project.
9. Persists runtime metadata.
10. Marks the workspace as `RUNNING`.

---

# Rebuilding After Changes

Whenever the Dockerfile changes, rebuild the image:

```bash
docker build \
    --no-cache \
    -t fiberdev/ckb-runtime:dev \
    docker/ckb-runtime
```

---

# Removing the Image

To delete the runtime image:

```bash
docker rmi fiberdev/ckb-runtime:dev
```

---

# Cleaning Up Failed Workspace Resources

If workspace provisioning fails, remove the leftover resources.

Remove containers:

```bash
docker rm -f <container_name>
```

Remove the Docker network:

```bash
docker network rm <network_name>
```

Remove workspace volumes:

```bash
docker volume rm <workspace_volume>
docker volume rm <ckb_data_volume>
```

Alternatively, use the Runtime API:

```http
DELETE /workspaces/{workspaceId}/runtime
```

---

# Troubleshooting

## Runtime Image Not Found

Error:

```text
pull access denied for fiberdev/ckb-runtime
```

Cause:

The runtime image has not been built locally.

Solution:

```bash
docker build \
    -t fiberdev/ckb-runtime:dev \
    docker/ckb-runtime
```

---

## Clang Package Not Found

Error:

```text
Unable to locate package clang-18
```

Cause:

Debian Bookworm repositories do not include versioned LLVM packages.

Solution:

Use:

```dockerfile
clang
llvm
libclang-dev
```

instead of:

```dockerfile
clang-18
llvm-18
```

---

## Missing CKB Debugger

If contract execution fails because `ckb-debugger` is missing, install the official Linux binary during the Docker image build and place it in:

```text
/usr/local/bin/ckb-debugger
```

Verify:

```bash
ckb-debugger --version
```

---

# Production Recommendations

For production deployments:

* Pin image versions instead of using mutable tags.
* Publish images to a private container registry.
* Scan images for vulnerabilities before deployment.
* Use non-root containers where possible.
* Apply CPU and memory limits.
* Regularly rebuild images to receive security updates.
* Sign container images before distribution.
