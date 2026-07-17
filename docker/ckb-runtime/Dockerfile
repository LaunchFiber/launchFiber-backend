FROM rust:1.82-bookworm

ARG CKB_DEBUGGER_VERSION=0.117.0

RUN apt-get update && apt-get install -y \
    make \
    curl \
    git \
    sed \
    bash \
    coreutils \
    build-essential \
    clang-18 \
    llvm-18 \
    pkg-config \
    libssl-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN rustup target add riscv64imac-unknown-none-elf

RUN cargo install cargo-generate --version "^0.17"


# Replace this section with the correct official debugger
# binary download for your target architecture.
# The image should ultimately expose:
# /usr/local/bin/ckb-debugger

WORKDIR /workspace

CMD ["sh", "-c", "while true; do sleep 3600; done"]