from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
import pandas as pd
import io # 메모리 상의 파일을 읽기 위해 필요
import os
import time
from app.services import perform_kmeans, calculate_elbow

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
async def analyze_data(k: int = Form(...), file: UploadFile = File(...)):
    # 1. 파일 읽기 (인코딩 처리)
    contents = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(contents), encoding='utf-8')
    except UnicodeDecodeError:
        try:
            df = pd.read_csv(io.BytesIO(contents), encoding='cp949') # 한글 윈도우 인코딩
        except:
            df = pd.read_csv(io.BytesIO(contents), encoding='euc-kr') # 또 다른 한글 인코딩

    # 2. 컬럼명 통일 (한글 -> 영어)
    df.rename(columns={"위도": "lat", "경도": "lon"}, inplace=True)

    # 3. 필수 컬럼 확인
    if 'lat' not in df.columns or 'lon' not in df.columns:
         raise HTTPException(status_code=400, detail="필수 컬럼(lat, lon 또는 위도, 경도)이 없습니다.")

    # [핵심 수정] 4. 데이터 강제 형변환 (문자열 -> 숫자)
    # "37.5", "  37.5 " 같은 건 숫자로 바꾸고, "-", "null" 같은 건 NaN(빈값)으로 만듦
    df['lat'] = pd.to_numeric(df['lat'], errors='coerce')
    df['lon'] = pd.to_numeric(df['lon'], errors='coerce')

    # 5. 결측치(빈 값, NaN) 제거
    df = df.dropna(subset=['lat', 'lon'])

    # 6. 데이터 샘플링 (속도 향상)
    MAX_SAMPLES = 5000
    if len(df) > MAX_SAMPLES:
        df = df.sample(n=MAX_SAMPLES, random_state=42)

    if len(df) == 0:
        raise HTTPException(status_code=400, detail="유효한 데이터가 없습니다.")

    # 5. K값 유효성 검사
    if k > len(df):
        raise HTTPException(status_code=400, detail="K값이 데이터 개수보다 큽니다.")
    time.sleep(1.0)

    # 분석 수행 
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
    contents = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(contents), encoding='utf-8')
    except UnicodeDecodeError:
        df = pd.read_csv(io.BytesIO(contents), encoding='cp949')
        
    df.rename(columns={"위도": "lat", "경도": "lon"}, inplace=True)
    
    if 'lat' not in df.columns or 'lon' not in df.columns:
         raise HTTPException(status_code=400, detail="필수 컬럼 누락")

    # [NEW] 결측치 제거 및 샘플링
    df = df.dropna(subset=['lat', 'lon'])
    
    MAX_SAMPLES = 5000
    if len(df) > MAX_SAMPLES:
        df = df.sample(n=MAX_SAMPLES, random_state=42)

    # 분석 수행
    try:
        # 연출을 위한 딜레이 (선택사항)
        time.sleep(1)
        data = calculate_elbow(df)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"계산 중 오류: {str(e)}")