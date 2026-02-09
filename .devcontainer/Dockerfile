FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV HOME=/root

RUN corepack enable && corepack prepare pnpm@10 --activate
