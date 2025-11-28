import pandas as pd
from sklearn.cluster import KMeans
from scipy.spatial import ConvexHull # 👈 추가된 핵심 라이브러리
import numpy as np

def perform_kmeans(df: pd.DataFrame, k: int):
    # 1. 데이터 추출
    X = df[['lat', 'lon']].values

    # 2. K-Means 수행
    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
    kmeans.fit(X)

    df['cluster'] = kmeans.labels_
    centers = kmeans.cluster_centers_

    #  각 군집별 데이터 개수 세기
    # return_counts=True 옵션으로 각 라벨이 몇 번 등장했는지 셉니다.
    unique_labels, counts = np.unique(kmeans.labels_, return_counts=True)
    # 라벨을 키(key), 개수를 값(value)으로 하는 딕셔너리 생성 (예: {0: 120, 1: 85, ...})
    count_dict = dict(zip(unique_labels, counts))

    # 3. 결과 구조체 초기화
    results = {
        "centers": [],
        "points": [],
        "polygons": []
    }

    # 중심점 정리 (여기에 개수 정보를 추가합니다!)
    for i, center in enumerate(centers):
        results["centers"].append({
            "cluster_id": i,
            "lat": center[0],
            "lon": center[1],
            "count": int(count_dict.get(i, 0)) # 👈 [New] 핵심! 해당 군집의 포인트 개수 추가
        })

    # 전체 포인트 정리
    results["points"] = df.to_dict(orient="records")

    # 4. [New] 군집별 영역(Convex Hull) 계산
    for i in range(k):
        # i번째 군집에 속한 데이터만 필터링
        cluster_points = X[kmeans.labels_ == i]

        # 점이 3개 이상이어야 다각형을 만들 수 있음
        if len(cluster_points) >= 3:
            try:
                hull = ConvexHull(cluster_points)
                # 외곽선을 구성하는 점들의 좌표 (순서대로)
                hull_points = cluster_points[hull.vertices]
                
                # 프론트엔드로 보낼 형식 만들기
                path = []
                for point in hull_points:
                    path.append({"lat": point[0], "lon": point[1]})
                
                results["polygons"].append({
                    "cluster_id": i,
                    "path": path
                })
            except Exception:
                # 일직선 위에 점이 있거나 예외 발생 시 패스
                continue

    return results

def calculate_elbow(df: pd.DataFrame, max_k: int = 10):
    """
    K=1 ~ max_k 까지 반복하며 Inertia(군집 내 오차 제곱합)를 계산
    """
    X = df[['lat', 'lon']].values
    inertias = []
    
    # 데이터 개수가 max_k보다 적으면 데이터 개수까지만 반복
    limit = min(len(df), max_k)
    
    for k in range(1, limit + 1):
        # random_state를 고정해야 그래프가 흔들리지 않음
        kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
        kmeans.fit(X)
        inertias.append(kmeans.inertia_)
        
    return {
        "ks": list(range(1, limit + 1)),
        "inertias": inertias
    }