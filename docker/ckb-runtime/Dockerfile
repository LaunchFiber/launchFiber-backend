FROM rust:1.96-bookworm

ARG LLVM_VERSION=18
ARG CKB_DEBUGGER_VERSION=0.117.0

ENV DEBIAN_FRONTEND=noninteractive
ENV USER=root
ENV HOME=/root
ENV CARGO_HOME=/usr/local/cargo
ENV RUSTUP_HOME=/usr/local/rustup

ENV CC=clang-18
ENV CXX=clang++-18
ENV CLANG=clang-18

RUN apt-get update && apt-get install -y \
    make \
    curl \
    wget \
    git \
    sed \
    bash \
    coreutils \
    build-essential \
    gnupg \
    lsb-release \
    software-properties-common \
    pkg-config \
    libssl-dev \
    ca-certificates \
    unzip \
    jq \
    cmake \
    && rm -rf /var/lib/apt/lists/*

# Install Clang/LLVM 18 from the official LLVM repository.
RUN wget -qO /tmp/llvm.sh https://apt.llvm.org/llvm.sh \
    && chmod +x /tmp/llvm.sh \
    && /tmp/llvm.sh ${LLVM_VERSION} \
    && apt-get update \
    && apt-get install -y \
        clang-${LLVM_VERSION} \
        llvm-${LLVM_VERSION} \
        lld-${LLVM_VERSION} \
        libclang-${LLVM_VERSION}-dev \
    && ln -sf /usr/bin/clang-${LLVM_VERSION} /usr/local/bin/clang \
    && ln -sf /usr/bin/clang++-${LLVM_VERSION} /usr/local/bin/clang++ \
    && ln -sf /usr/bin/llvm-config-${LLVM_VERSION} /usr/local/bin/llvm-config \
    && rm -f /tmp/llvm.sh \
    && rm -rf /var/lib/apt/lists/*

RUN clang --version \
    && test "$(clang -dumpversion | cut -d. -f1)" -ge 16

RUN rustup target add riscv64imac-unknown-none-elf

RUN cargo install cargo-generate --version "^0.21.3" --locked

WORKDIR /workspace

CMD ["sh", "-c", "while true; do sleep 3600; done"]