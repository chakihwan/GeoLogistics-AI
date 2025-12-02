import pandas as pd
from sklearn.cluster import KMeans
from scipy.spatial import ConvexHull
import numpy as np

def perform_kmeans(df: pd.DataFrame, k: int):
    # 데이터 준비
    X = df[['lat', 'lon']].values

    # K-Means 수행
    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
    kmeans.fit(X)

    df['cluster'] = kmeans.labels_
    centers = kmeans.cluster_centers_

    # 군집별 개수 세기
    unique_labels, counts = np.unique(kmeans.labels_, return_counts=True)
    count_dict = dict(zip(unique_labels, counts))

    results = {
        "centers": [],
        "points": [],
        "polygons": []
    }

    # 1. 중심점 정리
    for i, center in enumerate(centers):
        results["centers"].append({
            "cluster_id": int(i),
            "lat": float(center[0]),
            "lon": float(center[1]),
            "count": int(count_dict.get(i, 0))
        })

    # 2. 전체 포인트 정리
    # to_dict는 Pandas가 알아서 변환해주므로 보통 괜찮습니다.
    results["points"] = df.fillna("").to_dict(orient="records")

    # 3. 다각형(Convex Hull) 계산 (float() 형변환 필수!)
    for i in range(k):
        cluster_points = X[kmeans.labels_ == i]
        
        # 점 3개 이상일 때만 다각형 생성
        if len(cluster_points) >= 3:
            try:
                hull = ConvexHull(cluster_points)
                hull_points = cluster_points[hull.vertices]
                
                path = []
                for point in hull_points:
                    path.append({
                        "lat": float(point[0]), # 여기서 에러 많이 남! 꼭 float() 씌우기
                        "lon": float(point[1])
                    })
                
                results["polygons"].append({
                    "cluster_id": int(i),
                    "path": path
                })
            except Exception:
                continue

    return results

def calculate_elbow(df: pd.DataFrame, max_k: int = 10):
    X = df[['lat', 'lon']].values
    inertias = []
    limit = min(len(df), max_k)
    
    for k in range(1, limit + 1):
        kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
        kmeans.fit(X)
        # inertia_ 값도 numpy float이므로 변환 필요
        inertias.append(float(kmeans.inertia_))
        
    return {
        "ks": list(range(1, limit + 1)),
        "inertias": inertias
    }