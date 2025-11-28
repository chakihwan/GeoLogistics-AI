from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
import pandas as pd
import os
from app.services import perform_kmeans # 함수 임포트

app = FastAPI()

# 데이터 파일 경로
CSV_FILE_PATH = "app/data/orders.csv"

# 1. [Pydantic] 요청 데이터 검증 모델 (설계도)
class AnalyzeRequest(BaseModel):
    k: int # 사용자는 반드시 숫자(int)로 k를 보내야 함

@app.get("/", response_class=HTMLResponse)
def read_root():
    """
    메인 페이지 (index.html)를 읽어서 반환
    """
    # HTML 파일 경로
    html_path = "app/index.html"
    
    with open(html_path, "r", encoding="utf-8") as f:
        return f.read()

@app.post("/analyze")
def analyze_data(request: AnalyzeRequest):
    """
    K-Means 분석 요청을 처리하는 API
    """
    # 1. 데이터 파일 확인
    if not os.path.exists(CSV_FILE_PATH):
        raise HTTPException(status_code=404, detail="데이터 파일이 없습니다. (orders.csv)")

    # 2. 데이터 읽기
    try:
        df = pd.read_csv(CSV_FILE_PATH)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CSV 읽기 실패: {str(e)}")

    # 3. 유효성 검사 (데이터 개수보다 K가 크면 안됨)
    if request.k > len(df):
        raise HTTPException(status_code=400, detail="K값이 데이터 개수보다 큽니다.")
    if request.k < 1:
        raise HTTPException(status_code=400, detail="K값은 1 이상이어야 합니다.")

    # 4. 분석 수행 (services.py의 함수 호출)
    try:
        result = perform_kmeans(df, request.k)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"분석 중 오류 발생: {str(e)}")