var map;
var markers = []; 
var infoWindows = []; // 열려있는 인포윈도우를 관리하기 위한 배열

function initMap() {
    var container = document.getElementById('map');
    var options = {
        center: new kakao.maps.LatLng(37.498095, 127.027610),
        level: 7 // 지도 넚이 조절
    };
    map = new kakao.maps.Map(container, options);
    
    // 지도 타입 컨트롤러 (스카이뷰 등) 추가
    var mapTypeControl = new kakao.maps.MapTypeControl();
    map.addControl(mapTypeControl, kakao.maps.ControlPosition.TOPRIGHT);
    var zoomControl = new kakao.maps.ZoomControl();
    map.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT);
}

window.onload = function() {
    initMap(); // 1. 지도 생성 먼저 하고

    // 2. K값 입력창(k-value)에서 엔터키(Enter) 감지 이벤트 추가
    var kInput = document.getElementById('k-value');
    kInput.addEventListener("keyup", function(event) {
        // 눌린 키가 'Enter'라면 분석 함수 실행
        if (event.key === "Enter") {
            event.preventDefault(); // 기본 동작(새로고침 등) 방지
            runAnalysis(); // 분석 버튼 누른 것과 똑같이 실행
        }
    });
};

async function runAnalysis() {
    const fileInput = document.getElementById('csv-file');
    const kValue = document.getElementById('k-value').value;
    const statusText = document.getElementById('status-text');
    const spinner = document.getElementById('loading-spinner');

    if (fileInput.files.length === 0) {
        alert("CSV 파일을 먼저 선택해주세요!");
        return;
    }

    // UI 로딩 상태로 변경
    statusText.innerHTML = "데이터 분석 중입니다...";
    spinner.classList.remove('hidden'); // 스피너 표시

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('k', kValue);

    try {
        const response = await fetch('/analyze', { method: 'POST', body: formData });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail);
        }

        const data = await response.json();
        drawResult(data);
        statusText.innerHTML = `✅ <b>분석 완료!</b><br>총 ${data.points.length}개 지점 분석<br><b>${data.centers.length}개 최적 거점</b> 도출`;

    } catch (error) {
        console.error(error);
        alert("오류 발생: " + error.message);
        statusText.innerHTML = "❌ 분석 실패";
    } finally {
        spinner.classList.add('hidden'); // 스피너 숨김
    }
}

// 다른 인포윈도우를 모두 닫는 함수
function closeAllInfoWindows() {
    infoWindows.forEach(iw => iw.close());
    infoWindows = [];
}

function drawResult(data) {
    // 초기화
    for (var i = 0; i < markers.length; i++) { markers[i].setMap(null); }
    markers = [];
    closeAllInfoWindows();

    // 🎨 전문적인 색상 팔레트 (Tableau 10 color scheme 활용)
    const colors = [
        '#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F', 
        '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC'
    ];

    // 1. 다각형(영역) 그리기
    if (data.polygons) {
        data.polygons.forEach(poly => {
            var path = poly.path.map(p => new kakao.maps.LatLng(p.lat, p.lon));
            var polygon = new kakao.maps.Polygon({
                map: map, path: path,
                strokeWeight: 2, strokeColor: colors[poly.cluster_id % colors.length],
                strokeOpacity: 0.9, fillColor: colors[poly.cluster_id % colors.length],
                fillOpacity: 0.3 
            });
            markers.push(polygon);
        });
    }

    // 2. 일반 점 찍기
    data.points.forEach(point => {
        var circle = new kakao.maps.Circle({
            center : new kakao.maps.LatLng(point.lat, point.lon),
            radius: 12, strokeWeight: 1, strokeColor: '#fff',
            strokeOpacity: 0.5, fillColor: colors[point.cluster % colors.length],
            fillOpacity: 0.7
        });
        circle.setMap(map);
        markers.push(circle);
    });

    // 주소 변환 객체 생성
    var geocoder = new kakao.maps.services.Geocoder();

    // 3. 거점(깃발) 찍기 및 인터랙션 추가
    var imageSrc = "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png"; 
    
    data.centers.forEach(center => {
        var imageSize = new kakao.maps.Size(40, 55); 
        var markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize); 
        var marker = new kakao.maps.Marker({
            map: map, position: new kakao.maps.LatLng(center.lat, center.lon),
            title: "추천 거점", image: markerImage, zIndex: 10
        });

        // 💬 마커 클릭 이벤트 (주소 변환 로직 포함)
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

                    var infowindow = new kakao.maps.InfoWindow({
                        content : iwContent,
                        removable : true
                    });
                    infowindow.open(map, marker);
                    infoWindows.push(infowindow);
                }
            });
        });

        markers.push(marker);
    });
}