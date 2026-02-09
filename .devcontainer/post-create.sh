#!/bin/bash
set -e

# 依存関係インストール
pnpm install

# E2Eテスト用ブラウザ
pnpm exec playwright install --with-deps chromium

# Claude Code
claude install
