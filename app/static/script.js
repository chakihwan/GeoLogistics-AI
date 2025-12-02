/* * ==========================================
 * Global Variables (전역 변수 설정)
 * ==========================================
 */
var map;                // 카카오맵 객체를 담을 변수
var markers = [];       // 지도에 표시된 마커(점, 다각형 등)를 관리하는 배열 (나중에 지울 때 필요)
var infoWindows = [];   // 열려있는 인포윈도우(설명창)를 관리하기 위한 배열
var currentData = null; // ★중요★ 분석이 끝난 데이터를 저장해두는 변수 (다운로드 기능에서 사용)


/* * ==========================================
 * Initialization (초기화 및 이벤트 등록)
 * ==========================================
 */
function initMap() {
    var container = document.getElementById('map');
    var options = {
        center: new kakao.maps.LatLng(37.498095, 127.027610), // 초기 중심 좌표 (강남역 부근)
        level: 7 // 지도의 확대 레벨 (숫자가 클수록 멀리 보임)
    };
    
    // 지도 생성
    map = new kakao.maps.Map(container, options);
    
    // 지도 컨트롤러 추가 (스카이뷰, 줌 컨트롤)
    var mapTypeControl = new kakao.maps.MapTypeControl();
    map.addControl(mapTypeControl, kakao.maps.ControlPosition.TOPRIGHT);
    var zoomControl = new kakao.maps.ZoomControl();
    map.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT);
}

// 웹페이지가 다 로딩되면 실행되는 함수
window.onload = function() {
    // 1. 지도 생성
    initMap(); 

    // 2. K값 입력창에서 엔터(Enter) 키 입력 시 분석 실행 기능
    var kInput = document.getElementById('k-value');
    if(kInput) {
        kInput.addEventListener("keyup", function(event) {
            if (event.key === "Enter") {
                event.preventDefault(); // 브라우저 기본 동작 방지
                runAnalysis(); // 분석 함수 실행
            }
        });
    }

    // 3. [다운로드] 버튼 클릭 이벤트 연결
    // HTML에 id="download-btn"인 버튼이 있어야 동작합니다.
    var downloadBtn = document.getElementById('download-btn');
    if (downloadBtn) {
        // 버튼을 누르면 downloadResult 함수 실행
        downloadBtn.addEventListener('click', downloadResult);
    }
};


/* * ==========================================
 * Feature 1: 데이터 미리보기 (Preview)
 * ==========================================
 */
async function loadPreview() {
    const fileInput = document.getElementById('csv-file');
    const catSelect = document.getElementById('category-select');
    const regSelect = document.getElementById('region-select');

    // 파일이 선택되지 않았으면 중단
    if (fileInput.files.length === 0) return;

    // UI: 로딩 중 표시
    catSelect.innerHTML = '<option value="all">로드 중...</option>';
    regSelect.innerHTML = '<option value="all">로드 중...</option>';
    catSelect.disabled = true;
    regSelect.disabled = true;

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    try {
        // 서버의 /preview API 호출
        const response = await fetch('/preview', { method: 'POST', body: formData });
        const data = await response.json();

        // 1. 업종(Category) 옵션 채우기
        catSelect.innerHTML = '<option value="all">전체 업종</option>';
        if (data.categories && data.categories.length > 0) {
            data.categories.forEach(cat => {
                catSelect.innerHTML += `<option value="${cat}">${cat}</option>`;
            });
            catSelect.disabled = false;
        } else {
            catSelect.innerHTML = '<option value="all">업종 정보 없음</option>';
        }

        // 2. 지역(Region) 옵션 채우기
        regSelect.innerHTML = '<option value="all">전체 지역</option>';
        if (data.regions && data.regions.length > 0) {
            data.regions.forEach(reg => {
                regSelect.innerHTML += `<option value="${reg}">${reg}</option>`;
            });
            regSelect.disabled = false;
        } else {
            regSelect.innerHTML = '<option value="all">지역 정보 없음</option>';
        }

    } catch (error) {
        console.error("미리보기 실패:", error);
        catSelect.innerHTML = '<option value="all">로드 실패</option>';
        regSelect.innerHTML = '<option value="all">로드 실패</option>';
    }
}


/* * ==========================================
 * Feature 2: 메인 분석 실행 (K-Means)
 * ==========================================
 */
async function runAnalysis() {
    // HTML 요소 가져오기
    const fileInput = document.getElementById('csv-file');
    const kValue = document.getElementById('k-value').value;
    const category = document.getElementById('category-select').value;
    const region = document.getElementById('region-select').value;
    
    const statusText = document.getElementById('status-text');
    const spinner = document.getElementById('loading-spinner');
    const downloadBtn = document.getElementById('download-btn');

    // 예외 처리: 파일이 없으면 경고
    if (fileInput.files.length === 0) {
        alert("파일을 먼저 선택해주세요."); return;
    }
    
    // UI 상태 업데이트 (분석 중 표시)
    statusText.innerHTML = "데이터 필터링 및 분석 중...";
    spinner.classList.remove('hidden'); // 뺑글뺑글 로딩바 표시
    downloadBtn.style.display = 'none'; // 분석 중엔 다운로드 버튼 숨김

    // 서버로 보낼 데이터 준비
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('k', kValue);
    formData.append('category', category);
    formData.append('region', region);

    try {
        // 서버의 /analyze API 호출 (Python 백엔드)
        const response = await fetch('/analyze', { method: 'POST', body: formData });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail); // 에러 발생 시 catch로 이동
        }

        const data = await response.json();
        
        // ★ 핵심: 받아온 데이터를 전역 변수에 저장 (나중에 다운로드할 때 씀)
        currentData = data; 
        
        // 분석이 성공했으므로 다운로드 버튼을 보여줌
        downloadBtn.style.display = 'block';

        // 지도 그리기 함수 호출
        drawResult(data);
        
        // 결과 텍스트 업데이트
        let filterInfo = "";
        if(category !== 'all') filterInfo += `[${category}] `;
        if(region !== 'all') filterInfo += `[${region}] `;
        
        statusText.innerHTML = `✅ <b>분석 완료!</b><br>${filterInfo}총 ${data.points.length}개 지점<br><b>${data.centers.length}개 최적 거점</b> 도출`;

    } catch (error) {
        console.error(error);
        alert("오류 발생: " + error.message);
        statusText.innerHTML = "❌ 분석 실패";
    } finally {
        // 성공하든 실패하든 로딩바는 숨김
        spinner.classList.add('hidden'); 
    }
}


/* * ==========================================
 * Feature 3: 지도 시각화 (Markers & Polygons)
 * ==========================================
 */
// 열려있는 모든 인포윈도우 닫기
function closeAllInfoWindows() {
    infoWindows.forEach(iw => iw.close());
    infoWindows = [];
}

// 실제 지도에 점과 다각형을 찍는 함수
function drawResult(data) {
    // 1. 기존 마커들 싹 지우기 (초기화)
    for (var i = 0; i < markers.length; i++) { markers[i].setMap(null); }
    markers = [];
    closeAllInfoWindows();

    // 색상 팔레트 (클러스터별로 다른 색을 주기 위함)
    const colors = [
        '#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F', 
        '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC'
    ];

    // 2. 다각형(Convex Hull) 그리기 - 클러스터 영역 표시
    if (data.polygons) {
        data.polygons.forEach(poly => {
            var path = poly.path.map(p => new kakao.maps.LatLng(p.lat, p.lon));
            var polygon = new kakao.maps.Polygon({
                map: map, 
                path: path,
                strokeWeight: 2, 
                strokeColor: colors[poly.cluster_id % colors.length], // 테두리 색
                strokeOpacity: 0.9, 
                fillColor: colors[poly.cluster_id % colors.length],   // 채우기 색
                fillOpacity: 0.3 
            });
            markers.push(polygon); // 나중에 지우기 위해 배열에 저장
        });
    }

    // 3. 일반 음식점 점 찍기
    data.points.forEach(point => {
        var circle = new kakao.maps.Circle({
            center : new kakao.maps.LatLng(point.lat, point.lon),
            radius: 12, // 점 크기
            strokeWeight: 1, 
            strokeColor: '#fff',
            strokeOpacity: 0.5, 
            fillColor: colors[point.cluster % colors.length], // 클러스터 ID에 따른 색상
            fillOpacity: 0.7
        });
        circle.setMap(map);
        markers.push(circle);
    });

    // 주소를 좌표로 변환해주는 객체
    var geocoder = new kakao.maps.services.Geocoder();
    var imageSrc = "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png"; 
    
    // 4. 추천 거점(Hub) 깃발 찍기
    data.centers.forEach(center => {
        var imageSize = new kakao.maps.Size(40, 55); 
        var markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize); 
        
        var marker = new kakao.maps.Marker({
            map: map, 
            position: new kakao.maps.LatLng(center.lat, center.lon),
            title: "추천 거점", 
            image: markerImage, 
            zIndex: 10 // 다른 마커보다 위에 보이게 함
        });

        // 마커 클릭 시 주소와 정보를 보여주는 이벤트
        kakao.maps.event.addListener(marker, 'click', function() {
            closeAllInfoWindows(); // 기존 창 닫기

            // 좌표 -> 주소 변환
            geocoder.coord2Address(center.lon, center.lat, function(result, status) {
                if (status === kakao.maps.services.Status.OK) {
                    var detailAddr = !!result[0].road_address ? 
                                     result[0].road_address.address_name : 
                                     result[0].address.address_name;
                    
                    // 인포윈도우에 들어갈 HTML 내용
                    var iwContent = `
                        <div style="padding:15px; min-width:200px; border-radius:5px;">
                            <h4 style="margin:0 0 10px 0; color:#2c3e50; border-bottom:1px solid #eee; padding-bottom:5px;">
                                🚩 추천 거점 ${center.cluster_id + 1}
                            </h4>
                            <p style="margin:5px 0; font-size:0.9rem; color:#555;">
                                <b>주소:</b> ${detailAddr}
                            </p>
                            <p style="margin:5px 0; font-size:0.9rem; color:#555;">
                                <b>커버 주문:</b> <span style="color:#e74c3c; font-weight:bold;">${center.count}건</span>
                            </p>
                        </div>
                    `;
                    var infowindow = new kakao.maps.InfoWindow({ content : iwContent, removable : true });
                    infowindow.open(map, marker);
                    infoWindows.push(infowindow);
                }
            });
        });
        markers.push(marker);
    });
}


/* * ==========================================
 * Feature 4: Elbow Method (최적 K 찾기)
 * ==========================================
 */
var modal = document.getElementById("elbowModal");
var chartInstance = null; // 차트 객체 (중복 생성 방지)

function closeModal() { modal.style.display = "none"; }
// 모달 바깥 영역 클릭 시 닫기
window.onclick = function(event) { if (event.target == modal) { modal.style.display = "none"; } }

async function runElbow() {
    const fileInput = document.getElementById('csv-file');
    if (fileInput.files.length === 0) {
        alert("먼저 데이터 파일을 선택해주세요!"); return;
    }
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    // 모달 열기
    modal.style.display = "block";
    
    // 기존 차트 삭제 (안 그러면 겹쳐 그려짐)
    if (chartInstance) { chartInstance.destroy(); }

    try {
        const response = await fetch('/elbow', { method: 'POST', body: formData });
        if (!response.ok) throw new Error("서버 오류");
        const data = await response.json();
        
        // 차트 그리기 함수 호출
        drawElbowChart(data.ks, data.inertias);
    } catch (error) {
        alert("계산 실패: " + error.message);
        closeModal();
    }
}

function drawElbowChart(labels, dataPoints) {
    var ctx = document.getElementById('elbowChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels, // X축 (K값)
            datasets: [{
                label: 'Inertia (오차 제곱합)',
                data: dataPoints, // Y축 (오차값)
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.2)',
                borderWidth: 2,
                pointRadius: 5,
                pointBackgroundColor: '#e74c3c',
                fill: true
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: { title: { display: true, text: '군집 개수 (K)' } },
                y: { title: { display: true, text: 'Inertia (낮을수록 좋음)' } }
            }
        }
    });
}


/* * ==========================================
 * Feature 5: CSV 다운로드 (브라우저 처리)
 * ==========================================
 */
function downloadResult() {
    // 저장할 데이터가 없으면 중단
    if (!currentData || !currentData.points) {
        alert("저장할 데이터가 없습니다."); return;
    }

    // 1. CSV 파일의 헤더 작성 (\uFEFF는 엑셀에서 한글 깨짐 방지를 위한 BOM 문자)
    let csvContent = "\uFEFFlat,lon,cluster_id,category,region\n";

    // 2. 데이터 한 줄씩 CSV 형식으로 변환
    currentData.points.forEach(row => {
        let cat = row.category ? row.category : ""; // 정보 없으면 빈칸
        let reg = row.region ? row.region : "";
        
        // ★ 중요 수정 사항: row.cluster_id가 아니라 row.cluster를 사용해야 함
        // (Python 백엔드의 services.py에서 labels_를 'cluster'라는 이름으로 저장했기 때문)
        csvContent += `${row.lat},${row.lon},${row.cluster},${cat},${reg}\n`;
    });

    // 3. Blob 객체 생성 (대용량 문자열을 파일 객체처럼 다룸)
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    
    // 4. 가상의 다운로드 링크 생성 및 클릭 트리거
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "cluster_result.csv"); // 저장될 파일명
    
    document.body.appendChild(link);
    link.click(); // 강제 클릭 발생
    
    // 5. 뒷정리 (메모리 해제)
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}