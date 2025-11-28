import pandas as pd
import random

# 강남역 좌표 (중심점)
CENTER_LAT = 37.498095
CENTER_LON = 127.027610

# 데이터 개수 설정
NUM_SAMPLES = 300

def generate_data():
    data = []
    for i in range(1, NUM_SAMPLES + 1):
        # 강남역 반경 약 2~3km 내로 랜덤 좌표 생성
        # 0.01 도가 약 1km 정도 됩니다.
        lat = CENTER_LAT + (random.uniform(-0.02, 0.02))
        lon = CENTER_LON + (random.uniform(-0.03, 0.03))
        
        # 주문량 (1 ~ 10개 랜덤)
        demand = random.randint(1, 10)
        
        data.append([i, lat, lon, demand])
    
    # 데이터프레임 생성
    df = pd.DataFrame(data, columns=['id', 'lat', 'lon', 'demand'])
    
    # CSV 파일로 저장
    # 'app' 폴더 안이나, 'data' 폴더를 만들어 저장하면 좋습니다.
    # 여기서는 프로젝트 루트에 저장하겠습니다.
    filename = "orders.csv"
    df.to_csv(filename, index=False)
    print(f"✅ {filename} 생성 완료! ({NUM_SAMPLES}개 데이터)")

if __name__ == "__main__":
    generate_data()