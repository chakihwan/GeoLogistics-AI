from fastapi import FastAPI, HTTPException
import pandas as pd
import os

app = FastAPI()

# CSV 파일 위치 (app 폴더 내에 있다고 가정)
# 만약 data 폴더 안에 넣으셨다면 "app/data/orders.csv"로 수정하세요.
# 컨테이너 기준 경로는 /code/app/... 입니다.
CSV_FILE_PATH = "app/data/orders.csv" 

@app.get("/")
def read_root():
    return {"message": "GeoLogistics AI Service is Running!"}

@app.get("/data")
def get_all_data():
    """
    저장된 CSV 데이터를 읽어서 그대로 반환하는 테스트용 API
    """
    if not os.path.exists(CSV_FILE_PATH):
        raise HTTPException(status_code=404, detail="Data file not found.")
    
    # Pandas로 CSV 읽기
    df = pd.read_csv(CSV_FILE_PATH)
    
    # NaN(빈 값)이 있으면 JSON 변환 시 에러가 나므로 처리
    df = df.fillna("")
    
    # DataFrame -> Dictionary(JSON) 변환
    result = df.to_dict(orient="records")
    
    return {"count": len(result), "data": result}