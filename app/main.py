from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
import pandas as pd
import io # 메모리 상의 파일을 읽기 위해 필요
import os
import time
from app.services import perform_kmeans

app = FastAPI()

app.mount("/static", StaticFiles(directory="app/static"), name="static")

# 메인 페이지 로드 
@app.get("/", response_class=HTMLResponse)
def read_root():
    # 1. 환경 변수에서 키 가져오기 (없으면 빈 문자열)
    kakao_key = os.getenv("KAKAO_JS_KEY", "")
    
    with open("app/index.html", "r", encoding="utf-8") as f:
        html_content = f.read()
        
    # 2. HTML 안의 {kakao_key} 
    final_html = html_content.replace("{kakao_key}", kakao_key)
    return HTMLResponse(content=final_html)
    
@app.post("/analyze")
async def analyze_data(
    k: int = Form(...),       # HTML Form에서 'k'라는 이름으로 온 값
    file: UploadFile = File(...) # HTML Form에서 'file'이라는 이름으로 온 파일
):
    """
    사용자가 업로드한 CSV 파일을 받아 K-Means 분석 수행
    """
    # 1. 파일 형식 검사 (확장자 확인)
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="CSV 파일만 업로드 가능합니다.")

    # 2. 업로드된 파일 읽기
    try:
        # 파일 내용을 바이트(byte)로 읽음
        contents = await file.read()
        # 바이트 데이터를 Pandas DataFrame으로 변환
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파일 읽기 실패: {str(e)}")

    # 3. 데이터 컬럼 확인 (lat, lon이 있는지)
    if 'lat' not in df.columns or 'lon' not in df.columns:
         raise HTTPException(status_code=400, detail="CSV 파일에 'lat'(위도), 'lon'(경도) 컬럼이 있어야 합니다.")

    # 4. K값 유효성 검사
    if k > len(df):
        raise HTTPException(status_code=400, detail="K값이 데이터 개수보다 큽니다.")
    time.sleep(1.0)

    # 5. 분석 수행 (기존 로직 재사용)
    try:
        result = perform_kmeans(df, k)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"분석 중 오류 발생: {str(e)}")

@app.post("/elbow")
async def get_elbow_data(file: UploadFile = File(...)):
    """
    Elbow Method 그래프를 그리기 위한 데이터 반환
    """
    # 파일 읽기 로직 (analyze와 동일)
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파일 읽기 실패: {str(e)}")

    if 'lat' not in df.columns or 'lon' not in df.columns:
         raise HTTPException(status_code=400, detail="필수 컬럼 누락")

    # 분석 수행
    try:
        # 연출을 위한 딜레이 (선택사항)
        time.sleep(1)
        data = calculate_elbow(df)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"계산 중 오류: {str(e)}")