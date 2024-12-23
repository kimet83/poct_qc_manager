#!/bin/bash

# 설정
COMPOSE_FILE="docker-compose.yml"

# 최신 코드 업데이트
echo "=== Pulling latest code from GitHub ==="
if [ ! -d ".git" ]; then
    echo "Git 레포지토리가 없습니다. 클론합니다."
    git clone git@github.com:kimet83/poct_qc_manager.git .
else
    echo "기존 레포지토리에서 업데이트 중..."
    git pull || { echo "Git 업데이트 실패!"; exit 1; }
fi

# Docker Compose 빌드 및 실행
echo "=== Docker Compose 빌드 및 실행 ==="
# docker-compose -f "$COMPOSE_FILE" up --build -d || { echo "Docker Compose 실행 실패!"; exit 1; }
docker-compose --env-file .env up --build -d
echo "=== 모든 작업 완료 ==="