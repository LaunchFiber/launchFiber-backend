FROM rust:1.82-bookworm

ARG CKB_DEBUGGER_VERSION=0.117.0

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    make \
    curl \
    wget \
    git \
    sed \
    bash \
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