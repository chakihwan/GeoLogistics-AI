/* * ==========================================
 * Global Variables (전역 변수 설정)
 * ==========================================
 */
var map;                // 카카오맵 객체
var markers = [];       // 지도 마커 관리 배열
var infoWindows = [];   // 인포윈도우 관리 배열
var currentData = null; // 분석 결과 데이터 (다운로드용)

// 로딩창 제어 헬퍼 함수
function showLoading(message) {
    const overlay = document.getElementById('loading-overlay');
    const msgEl = document.getElementById('loading-message');
    
    if (overlay && msgEl) {
        msgEl.innerText = message || "처리 중...";
        overlay.style.display = 'flex'; // 강제로 보이기
    }
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none'; // 강제로 숨기기
    }
}

/* * ==========================================
 * Helper Functions (UI 동작 관련 - 드롭다운/라벨)
 * ==========================================
 */

// 1. 드롭다운 열고 닫기 (토글)
function toggleDropdown(id) {
    const el = document.getElementById(id);
    if (el.classList.contains('hidden')) {
        el.classList.remove('hidden');
    } else {
        el.classList.add('hidden');
    }
}

// 2. 다른 곳 클릭하면 드롭다운 닫기 (UX 향상)
window.addEventListener('click', function(e) {
    if (!e.target.closest('.relative')) {
        const catDropdown = document.getElementById('category-dropdown');
        const regDropdown = document.getElementById('region-dropdown');
        if(catDropdown) catDropdown.classList.add('hidden');
        if(regDropdown) regDropdown.classList.add('hidden');
    }
});

// 3. 선택된 개수에 따라 버튼 텍스트 업데이트 ("한식 외 2건" 등)
function updateLabel(type) {
    // type: 'category' 또는 'region'
    const checkboxes = document.querySelectorAll(`input[name="${type}"]:checked`);
    const btnText = document.getElementById(`${type}-btn`).querySelector('span');
    
    if (checkboxes.length === 0) {
        btnText.innerText = "선택된 항목 없음 (전체)";
        btnText.classList.add("text-gray-500");
    } else if (checkboxes.length === 1) {
        // 하나만 선택했으면 그 이름 그대로 출력
        btnText.innerText = checkboxes[0].value;
        btnText.classList.remove("text-gray-500");
    } else {
        // 여러 개면 "OOO 외 N개" 형식으로 표시
        btnText.innerText = `${checkboxes[0].value} 외 ${checkboxes.length - 1}개`;
        btnText.classList.remove("text-gray-500");
    }
}

// 4. 전체 선택/해제 로직 (라벨 업데이트 포함)
function toggleAll(source, name) {
    const checkboxes = document.querySelectorAll(`input[name="${name}"]`);
    checkboxes.forEach(cb => cb.checked = source.checked);
    updateLabel(name); // 체크 상태가 바뀌었으니 라벨도 바로 업데이트
}


/* * ==========================================
 * Initialization (초기화 및 이벤트 등록)
 * ==========================================
 */
function initMap() {
    var container = document.getElementById('map');
    var options = {
        center: new kakao.maps.LatLng(37.498095, 127.027610), // 강남역 부근
        level: 7
    };
    map = new kakao.maps.Map(container, options);
    
    // 컨트롤러 추가
    var mapTypeControl = new kakao.maps.MapTypeControl();
    map.addControl(mapTypeControl, kakao.maps.ControlPosition.TOPRIGHT);
    var zoomControl = new kakao.maps.ZoomControl();
    map.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT);
}

window.onload = function() {
    initMap(); 

    // 엔터키 이벤트 (K값 입력창)
    var kInput = document.getElementById('k-value');
    if(kInput) {
        kInput.addEventListener("keyup", function(event) {
            if (event.key === "Enter") {
                event.preventDefault(); 
                runAnalysis(); 
            }
        });
    }

    // 다운로드 버튼 이벤트
    var downloadBtn = document.getElementById('download-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadResult);
    }
};


/* * ==========================================
 * Feature 1: 데이터 미리보기 (Preview) - 드롭다운 생성
 * ==========================================
 */
async function loadPreview() {
    const fileInput = document.getElementById('csv-file');
    const catContainer = document.getElementById('category-list');
    const regContainer = document.getElementById('region-list');

    if (fileInput.files.length === 0) return;

    // ★ 로딩 시작
    showLoading("파일 업로드 및 분석 중...");

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    try {
        const response = await fetch('/preview', { method: 'POST', body: formData });
        
        if (!response.ok) throw new Error("서버 응답 오류");
        
        const data = await response.json();

        // 체크박스 HTML 생성 헬퍼
        const createCheckboxHTML = (name, value, label) => `
            <div class="flex items-center mb-2 hover:bg-gray-100 p-1 rounded transition">
                <input id="${name}-${value}" type="checkbox" name="${name}" value="${value}" 
                       onchange="updateLabel('${name}')"
                       class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer">
                <label for="${name}-${value}" class="ml-2 text-sm text-gray-700 cursor-pointer select-none w-full block">
                    ${label}
                </label>
            </div>
        `;

        // 1. 업종 목록 생성
        if (data.categories && data.categories.length > 0) {
            let html = `<div class="flex items-center mb-2 pb-2 border-b">
                            <input type="checkbox" onchange="toggleAll(this, 'category')" class="w-4 h-4 cursor-pointer">
                            <label class="ml-2 text-sm font-bold text-blue-600">전체 선택/해제</label>
                        </div>`;
            data.categories.forEach(cat => html += createCheckboxHTML('category', cat, cat));
            catContainer.innerHTML = html;
        } else {
            catContainer.innerHTML = '<div class="p-2 text-red-500">업종 정보 없음</div>';
        }

        // 2. 지역 목록 생성
        if (data.regions && data.regions.length > 0) {
            let html = `<div class="flex items-center mb-2 pb-2 border-b">
                            <input type="checkbox" onchange="toggleAll(this, 'region')" class="w-4 h-4 cursor-pointer">
                            <label class="ml-2 text-sm font-bold text-blue-600">전체 선택/해제</label>
                        </div>`;
            data.regions.forEach(reg => html += createCheckboxHTML('region', reg, reg));
            regContainer.innerHTML = html;
        } else {
            regContainer.innerHTML = '<div class="p-2 text-red-500">지역 정보 없음</div>';
        }

        updateLabel('category');
        updateLabel('region');

    } catch (error) {
        console.error("미리보기 실패:", error);
        alert("파일 로드 실패: " + error.message);
    } finally {
        //  로딩 종료 (성공하든 실패하든 무조건 실행)
        hideLoading();
    }
}


/* * ==========================================
 * Feature 2: 메인 분석 실행 (K-Means)
 * ==========================================
 */
async function runAnalysis() {
    const fileInput = document.getElementById('csv-file');
    const kValue = document.getElementById('k-value').value;
    
    // UI가 드롭다운으로 바뀌어도 input[type=checkbox]는 그대로이므로
    // querySelectorAll로 체크된 값들을 가져오는 방식은 동일합니다.
    const selectedCategories = Array.from(document.querySelectorAll('input[name="category"]:checked')).map(cb => cb.value);
    const selectedRegions = Array.from(document.querySelectorAll('input[name="region"]:checked')).map(cb => cb.value);

    const statusText = document.getElementById('status-text');
    const spinner = document.getElementById('loading-spinner');
    const downloadBtn = document.getElementById('download-btn');

    if (fileInput.files.length === 0) {
        alert("파일을 먼저 선택해주세요."); return;
    }
    
    showLoading("최적 거점 분석 중...");
    
    statusText.innerHTML = "데이터 필터링 및 분석 중...";
    downloadBtn.style.display = 'none';

    // FormData 구성
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('k', kValue);

    // 업종 데이터 추가 (배열 -> 개별 필드)
    if (selectedCategories.length === 0 || selectedCategories.includes('all')) {
        formData.append('category', 'all');
    } else {
        selectedCategories.forEach(val => formData.append('category', val));
    }

    // 지역 데이터 추가
    if (selectedRegions.length === 0 || selectedRegions.includes('all')) {
        formData.append('region', 'all');
    } else {
        selectedRegions.forEach(val => formData.append('region', val));
    }

    try {
        const response = await fetch('/analyze', { method: 'POST', body: formData });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail);
        }

        const data = await response.json();
        currentData = data; 
        
        downloadBtn.style.display = 'block';
        drawResult(data);
        
        // 결과 텍스트 업데이트
        let filterInfo = "";
        if(!selectedCategories.includes('all') && selectedCategories.length > 0) {
            filterInfo += `[업종: ${selectedCategories.length}개 선택] `;
        }
        if(!selectedRegions.includes('all') && selectedRegions.length > 0) {
            filterInfo += `[지역: ${selectedRegions.length}개 선택] `;
        }
        
        statusText.innerHTML = `✅ <b>분석 완료!</b><br>${filterInfo}<br>총 ${data.points.length}개 지점 중 <b>${data.centers.length}개 최적 거점</b> 도출`;

    } catch (error) {
        console.error(error);
        alert("오류 발생: " + error.message);
        statusText.innerHTML = "❌ 분석 실패";
    } finally {
        hideLoading();
    }
}


/* * ==========================================
 * Feature 3: 지도 시각화 (Markers & Polygons)
 * ==========================================
 */
function closeAllInfoWindows() {
    infoWindows.forEach(iw => iw.close());
    infoWindows = [];
}

function drawResult(data) {
    // 마커 초기화
    for (var i = 0; i < markers.length; i++) { markers[i].setMap(null); }
    markers = [];
    closeAllInfoWindows();

    const colors = [
        '#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F', 
        '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC'
    ];

    // 1. 다각형 그리기
    if (data.polygons) {
        data.polygons.forEach(poly => {
            var path = poly.path.map(p => new kakao.maps.LatLng(p.lat, p.lon));
            var polygon = new kakao.maps.Polygon({
                map: map, 
                path: path,
                strokeWeight: 2, 
                strokeColor: colors[poly.cluster_id % colors.length], 
                strokeOpacity: 0.9, 
                fillColor: colors[poly.cluster_id % colors.length], 
                fillOpacity: 0.3 
            });
            markers.push(polygon);
        });
    }

    // 2. 점(Point) 그리기
    data.points.forEach(point => {
        var circle = new kakao.maps.Circle({
            center : new kakao.maps.LatLng(point.lat, point.lon),
            radius: 12, 
            strokeWeight: 1, 
            strokeColor: '#fff',
            strokeOpacity: 0.5, 
            fillColor: colors[point.cluster % colors.length], 
            fillOpacity: 0.7
        });
        circle.setMap(map);
        markers.push(circle);
    });

    var geocoder = new kakao.maps.services.Geocoder();
    var imageSrc = "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png"; 
    
    // 3. 거점(Hub) 깃발 그리기
    data.centers.forEach(center => {
        var imageSize = new kakao.maps.Size(40, 55); 
        var markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize); 
        
        var marker = new kakao.maps.Marker({
            map: map, 
            position: new kakao.maps.LatLng(center.lat, center.lon),
            title: "추천 거점", 
            image: markerImage, 
            zIndex: 10
        });

        // 클릭 이벤트 (인포윈도우)
        kakao.maps.event.addListener(marker, 'click', function() {
            closeAllInfoWindows();

            geocoder.coord2Address(center.lon, center.lat, function(result, status) {
                if (status === kakao.maps.services.Status.OK) {
                    var detailAddr = !!result[0].road_address ? 
                                     result[0].road_address.address_name : 
                                     result[0].address.address_name;
                    
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
 * Feature 4: Elbow Method
 * ==========================================
 */
var modal = document.getElementById("elbowModal");
var chartInstance = null; 

function closeModal() { if(modal) modal.style.display = "none"; }
window.onclick = function(event) { if (event.target == modal) { modal.style.display = "none"; } }

async function runElbow() {
    const fileInput = document.getElementById('csv-file');
    if (fileInput.files.length === 0) {
        alert("먼저 데이터 파일을 선택해주세요!"); return;
    }
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    if(modal) modal.style.display = "block";
    if (chartInstance) { chartInstance.destroy(); }

    try {
        const response = await fetch('/elbow', { method: 'POST', body: formData });
        if (!response.ok) throw new Error("서버 오류");
        const data = await response.json();
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
            labels: labels,
            datasets: [{
                label: 'Inertia (오차 제곱합)',
                data: dataPoints,
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
                y: { title: { display: true, text: 'Inertia' } }
            }
        }
    });
}


/* * ==========================================
 * Feature 5: CSV 다운로드 (BOM 포함 + Blob 사용)
 * ==========================================
 */
function downloadResult() {
    if (!currentData || !currentData.points) {
        alert("저장할 데이터가 없습니다."); return;
    }

    // 1. CSV 헤더 (한글 깨짐 방지 BOM)
    let csvContent = "\uFEFFlat,lon,cluster_id,category,region\n";

    // 2. 데이터 변환
    currentData.points.forEach(row => {
        let cat = row.category ? row.category : "";
        let reg = row.region ? row.region : "";
        
        // ★ row.cluster (0,1,2...) 사용
        csvContent += `${row.lat},${row.lon},${row.cluster},${cat},${reg}\n`;
    });

    // 3. Blob 생성 및 다운로드
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "cluster_result.csv"); 
    
    document.body.appendChild(link);
    link.click(); 
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}