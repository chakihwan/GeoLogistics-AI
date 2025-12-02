from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
import pandas as pd
import io # 메모리 상의 파일을 읽기 위해 필요
import os
import time
from app.services import perform_kmeans, calculate_elbow
from typing import Optional, List

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
    
# 공통 파일 읽기 함수 (중복 코드 제거용)
async def read_csv_file(file: UploadFile):
    contents = await file.read()
    df = None # 1. 먼저 빈 변수로 초기화 (에러 방지 핵심!)

    # 2. 여러 인코딩으로 순서대로 시도
    encodings = ['utf-8', 'cp949', 'euc-kr']
    
    for enc in encodings:
        try:
            # 시도!
            df = pd.read_csv(io.BytesIO(contents), encoding=enc)
            print(f"DEBUG: 인코딩 {enc} 방식으로 읽기 성공")
            break # 성공하면 반복문 탈출
        except Exception:
            continue # 실패하면 다음 인코딩으로 넘어감

    # 3. 모든 시도가 실패했는지 확인
    if df is None:
        print("ERROR: 모든 인코딩 방식 실패")
        raise HTTPException(status_code=400, detail="CSV 파일을 읽을 수 없습니다. (인코딩 오류 또는 손상된 파일)")

    # 4. 디버깅 로그 (이제 df가 확실히 있으므로 에러 안 남)
    print(f"DEBUG: 원본 컬럼 목록 = {df.columns.tolist()}")

    rename_map = {
        "위도": "lat", "경도": "lon",
        "상권업종중분류명": "category", "상권업종대분류명": "category", 
        "상권업종소분류명": "category", "분류": "category",
        "표준산업분류명": "category", "업종명": "category",
        
        "행정동명": "region", "법정동명": "region", 
        "시군구명": "region", "동정보": "region", "지역": "region"
    }
    df.rename(columns=rename_map, inplace=True)
    
    # 중복된 컬럼명 제거
    df = df.loc[:, ~df.columns.duplicated()]
    
    print(f"DEBUG: 변경 및 중복제거 후 컬럼 = {df.columns.tolist()}")
    
    return df

# 👇 [New] 1. 파일 미리보기 API (옵션 목록 추출)
@app.post("/preview")
async def preview_data(file: UploadFile = File(...)):
    df = await read_csv_file(file)
    
    response = {
        "categories": [],
        "regions": []
    }
    
    # category 컬럼이 있다면 유니크 값 추출
    if "category" in df.columns:
        response["categories"] = sorted(df["category"].dropna().unique().tolist())
        
    # region 컬럼이 있다면 유니크 값 추출
    if "region" in df.columns:
        response["regions"] = sorted(df["region"].dropna().unique().tolist())
        
    return response

# 👇 [Update] 2. 분석 API (필터링 추가)
@app.post("/analyze")
async def analyze_data(
    k: int = Form(...),
    file: UploadFile = File(...),
    category: List[str] = Form(None), # 선택된 업종 (없을수도 있음)
    region: List[str] = Form(None)    # 선택된 지역 (없을수도 있음) 리스트로 받게 변경
):
    df = await read_csv_file(file)

    # --- 🔍 필터링 로직 시작 ---
    # 1. 업종 필터링
    if category and "all" not in category and "category" in df.columns:
        df = df[df["category"].isin(category)]  # (== 대신 isin)
        
    # 2. 지역 필터링
    if region and region != "all" and "region" in df.columns:
        df = df[df["region"].isin(region)]
        
    if len(df) == 0:
        raise HTTPException(status_code=400, detail="선택한 조건에 맞는 데이터가 없습니다.")
    # --- 🔍 필터링 로직 끝 ---

    # 필수 컬럼 확인
    if 'lat' not in df.columns or 'lon' not in df.columns:
         raise HTTPException(status_code=400, detail="필수 컬럼(위도/경도) 누락")

    # 전처리 (기존과 동일)
    df['lat'] = pd.to_numeric(df['lat'], errors='coerce')
    df['lon'] = pd.to_numeric(df['lon'], errors='coerce')
    df = df.dropna(subset=['lat', 'lon'])

    # 샘플링
    MAX_SAMPLES = 5000
    if len(df) > MAX_SAMPLES:
        df = df.sample(n=MAX_SAMPLES, random_state=42)

    time.sleep(1.0) # 로딩 연출

    try:
        result = perform_kmeans(df, k)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"오류: {str(e)}")

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


