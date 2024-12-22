# 베이스 이미지 선택
FROM python:3.12.4-slim

# 작업 디렉토리 설정
WORKDIR /app

# 필요한 패키지 설치
COPY requirements.txt .
RUN pip install -r requirements.txt

# 애플리케이션 소스 코드 복사
COPY . .

# 컨테이너 시작 시 실행할 명령어
CMD ["python", "app.py"]