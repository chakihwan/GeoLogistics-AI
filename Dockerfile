# 1. 파이썬 3.12 슬림 버전 사용 (가볍고 안정적)
FROM python:3.12-slim

# 2. 컨테이너 내 작업 폴더 설정
WORKDIR /code

# 3. 의존성 파일 복사 및 설치 (캐싱 효율을 위해 코드 복사보다 먼저 수행)
COPY ./requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# 4. 소스 코드 복사
COPY ./app /code/app

# 5. 서버 실행 (개발 모드: --reload 옵션으로 코드 수정 시 자동 재시작)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]