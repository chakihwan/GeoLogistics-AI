import pandas as pd
from sklearn.cluster import KMeans

def perform_kmeans(df: pd.DataFrame, k: int):
    """
    데이터프레임(df)과 군집 수(k)를 받아 K-Means 분석을 수행하는 함수
    """
    # 1. 분석에 사용할 데이터 추출 (위도, 경도)
    # 실제로는 'demand'(주문량)도 가중치로 쓸 수 있지만, 일단 좌표로만 군집화합니다.
    X = df[['lat', 'lon']]

    # 2. K-Means 모델 생성 및 학습
    # n_init=10: 초기 중심점 설정을 10번 반복해서 가장 좋은 결과를 씀 (안정성 확보)
    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
    kmeans.fit(X)

    # 3. 결과 정리
    df['cluster'] = kmeans.labels_ # 각 점이 몇 번 군집인지 라벨링 (0, 1, 2...)
    centers = kmeans.cluster_centers_ # 각 군집의 중심점 좌표 (위도, 경도)

    # 4. 프론트엔드로 보내기 좋게 JSON 형태로 변환
    results = {
        "centers": [],  # 중심점 리스트
        "points": []    # 전체 데이터 리스트 (라벨 포함)
    }

    # 중심점 데이터 정리
    for i, center in enumerate(centers):
        results["centers"].append({
            "cluster_id": i,
            "lat": center[0],
            "lon": center[1]
        })

    # 전체 포인트 데이터 정리
    results["points"] = df.to_dict(orient="records")

    return results