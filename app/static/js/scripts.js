let passwordVerified = false;
let protectedTabs = [];

// 🛡️ 보호된 탭 목록 가져오기
async function fetchProtectedTabs() {
  try {
    const response = await fetch('/protected-tabs');
    const result = await response.json();
    protectedTabs = result.protected_tabs || [];
    console.log("Protected tabs loaded:", protectedTabs);
  } catch (error) {
    console.error('Error fetching protected tabs:', error);
  }
}

// 🔑 암호 확인 함수
async function requirePassword(tabId) {
  console.log("Clicked tab ID:", tabId);

  // 보호된 탭이 아니면 바로 활성화
  if (!protectedTabs.includes(tabId)) {
    document.getElementById(`${tabId}-tab`).click();
    return;
  }

  // 이미 인증된 경우 바로 탭 활성화
  if (passwordVerified) {
    document.getElementById(`${tabId}-tab`).click();
    return;
  }

  const password = prompt('접근 암호를 입력하세요:');
  if (!password) {
    alert('암호를 입력해주세요.');
    document.getElementById('qc-tab').click(); // QC 탭으로 이동
    return;
  }

  try {
    const response = await fetch('/verify-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password })
    });

    const result = await response.json();

    if (response.ok && result.verified) {
      passwordVerified = true;
      document.getElementById(`${tabId}-tab`).click();
    } else {
      alert(result.message || '잘못된 암호입니다.');
      document.getElementById('qc-tab').click(); // QC 탭으로 이동
    }
  } catch (error) {
    console.error('Error verifying password:', error);
    alert('서버 오류가 발생했습니다.');
    document.getElementById('qc-tab').click(); // QC 탭으로 이동
  }
}

// 🖥️ 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', () => {
  // 보호된 탭 목록 불러오기
  fetchProtectedTabs();

  // 🟢 메뉴 탭 클릭 이벤트 리스너
  document.getElementById('menuTab').addEventListener('click', (event) => {
    const clickedTab = event.target.closest('.nav-link');
    if (!clickedTab) return;

    const tabId = clickedTab.id.replace('-tab', '');
    event.preventDefault(); // 기본 동작 방지
    requirePassword(tabId);

    // 활성화된 탭 ID 저장
    localStorage.setItem('activeTab', tabId);
  });

  // 📦 페이지 초기화 관련 함수 호출
  loadPlaceList();
  loadDeviceList();
  loadSticks();
  setDefaultDates();
  setupPlaceCodeChangeListener();
  setupQcPlaceCodeChangeListener();
  loadQcReagent();
  loadQcResults();
  adjustTableForMobile();

  // 🟡 URL 해시 또는 LocalStorage를 기반으로 탭 활성화
  const savedTabId = localStorage.getItem('activeTab');
  if (savedTabId && document.getElementById(`${savedTabId}-tab`)) {
    requirePassword(savedTabId);
  } else {
    // 기본 QC 탭 활성화
    document.getElementById('qc-tab').click(); 
    localStorage.setItem('activeTab', 'qc'); // QC 탭을 기본 활성 탭으로 저장
  }
});

// 📱 창 크기 조정 시 테이블 조정
window.addEventListener('resize', adjustTableForMobile);

// 🌐 URL 해시와 LocalStorage 업데이트
document.querySelectorAll('.nav-tabs .nav-link, .nav-pills .nav-link').forEach(tab => {
  tab.addEventListener('click', (event) => {
    const mainTabId = document.querySelector('.nav-tabs .nav-link.active').id; // 활성 메인 탭 ID
    const subTabId = document.querySelector('.tab-pane.active .nav-pills .nav-link.active')?.id || null; // 활성 서브 탭 ID

    // URL 해시 갱신
    const hash = subTabId ? `${mainTabId},${subTabId}` : mainTabId;
    window.location.hash = hash;

    // LocalStorage에 탭 ID 저장
    localStorage.setItem('activeTab', mainTabId);
  });
});

function adjustTableForMobile() {
  const isMobile = window.innerWidth <= 768;

  // 결과 목록 테이블
  document.querySelectorAll('#resultsTableBody tr').forEach(row => {
    row.querySelectorAll('.hide-on-mobile').forEach(cell => {
      cell.style.display = isMobile ? 'none' : 'table-cell';
    });
    row.querySelectorAll('.show-on-mobile').forEach(cell => {
      cell.style.display = isMobile ? 'table-cell' : 'none';
    });

    // Inactive 행은 모바일에서 숨기기
    if (isMobile && row.classList.contains('table-secondary')) {
      row.style.display = 'none';
    } else {
      row.style.display = ''; // 데스크톱에서는 기본 표시
    }
  });

  // 장비 목록 테이블
  document.querySelectorAll('#device-table-body tr').forEach(row => {
    row.querySelectorAll('.hide-on-mobile').forEach(cell => {
      cell.style.display = isMobile ? 'none' : 'table-cell';
    });
    row.querySelectorAll('.show-on-mobile').forEach(cell => {
      cell.style.display = isMobile ? 'table-cell' : 'none';
    });

    // Inactive 행은 모바일에서 숨기기
    if (isMobile && row.classList.contains('table-secondary')) {
      row.style.display = 'none';
    } else {
      row.style.display = ''; // 데스크톱에서는 기본 표시
    }
  });
}


function setDefaultDates() {
  // 오늘 날짜를 ISO 형식으로 가져와서 모든 날짜 입력 필드에 기본값으로 설정
  const today = new Date().toISOString().split('T')[0];
  document.querySelectorAll('input[type="date"]').forEach(input => input.value = today);
}


function getTodayDate() {
  // 현재 날짜를 "YYYY-MM-DD" 형식의 문자열로 반환
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0'); // 월은 0부터 시작하므로 +1
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


function loadReplaceSerials(placeCode) {
  const replaceSerialSelect = document.getElementById('registerReplaceSerial'); // 장비관리의 교체장비 선택

  if (!replaceSerialSelect) return;

  if (!placeCode) {
    // PlaceCode가 선택되지 않은 경우 초기화
    replaceSerialSelect.innerHTML = '<option value="">없음</option>';
    return;
  }

  fetch(`/GetActiveSerials?placeCode=${placeCode}`)
    .then(response => response.json())
    .then(data => {
      // 기본 옵션 추가
      replaceSerialSelect.innerHTML = '<option value="">없음</option>';

      // 데이터 추가
      data.forEach(device => {
        const option = document.createElement('option');
        option.value = device.Serial; // ReplaceSerial 값
        option.textContent = device.Serial; // Serial 표시
        replaceSerialSelect.appendChild(option);
      });
    })
    .catch(error => console.error('Error fetching ReplaceSerials:', error));
}

// PlaceCode 변경 시 ReplaceSerial  목록 갱신
function setupPlaceCodeChangeListener() {
  const placeCodeElements = ['registerPlaceCode'];

  placeCodeElements.forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('change', (event) => {
        const selectedPlaceCode = event.target.value;
        loadReplaceSerials(selectedPlaceCode);
      });
    }
  });
}


// 정도관리 결과등록 장소 선택시 장비 리스트 갱신
function loadReplaceSerialsForQc(placeCode) {
  const deviceSerialSelect = document.getElementById('deviceSerialSelect'); // 정도관리의 장비 선택

  if (!deviceSerialSelect) return;

  if (!placeCode) {
    // PlaceCode가 선택되지 않은 경우 초기화
    deviceSerialSelect.innerHTML = '<option value="" disabled selected>장비를 선택하세요</option>';
    return;
  }

  // DeviceSerial 데이터 갱신
  fetch(`/GetActiveSerials?placeCode=${placeCode}`)
    .then(response => response.json())
    .then(data => {
      deviceSerialSelect.innerHTML = '<option value="" disabled selected>장비를 선택하세요</option>'; // DeviceSerial 기본 옵션 추가
      availableDeviceSerials = data.map(device => device.Serial); // Serial 저장
      data.forEach(device => {
        const option = document.createElement('option');
        option.value = device.Serial;
        option.textContent = device.Serial;
        deviceSerialSelect.appendChild(option);
      });
    })
    .catch(error => console.error('Error fetching DeviceSerials:', error));
}

// 정도관리 메뉴의 PlaceCode 변경 시 이벤트 리스너 설정
function setupQcPlaceCodeChangeListener() {
  const placeCodeElements = ['placeSelect']; // 정도관리 메뉴의 장소 선택
  placeCodeElements.forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('change', (event) => {
        const selectedPlaceCode = event.target.value;
        loadReplaceSerialsForQc(selectedPlaceCode);
      })
    }
  })
}





// StickLot 스캐너 열기
function openStickLotScanner() {
  window.open('/barcode?type=StickLot', 'Barcode Scanner', 'width=400,height=400');
}

// registerSerial 스캐너 열기
function openRegisterSerialScanner() {
  window.open('/barcode?type=registerSerial', 'Barcode Scanner', 'width=400,height=400');
}
// StickLot 스캐너 열기
function openStickLotScannerforQc() {
  window.open('/barcode?type=StickLotforQc', 'Barcode Scanner', 'width=400,height=400');
}
function formatExpToDate(exp) {
  if (exp.length === 6) {
    const year = `20${exp.slice(0, 2)}`; // 연도 (25 → 2025)
    const month = exp.slice(2, 4); // 월 (11 → 11)
    const day = exp.slice(4, 6); // 일 (11 → 11)
    return `${year}-${month}-${day}`;
  }
  console.warn('Invalid exp format:', exp);
  return '';
}
// 메시지 수신
window.addEventListener('message', function (event) {
  console.log('Received message:', event.data);

  if (event.data && event.data.type && event.data.lot) {
    if (event.data.type === 'registerSerial') {
      // 시리얼 번호 입력 필드에 데이터 입력
      document.getElementById('registerSerial').value = event.data.lot;
    } else if (event.data.type === 'StickLot') {
      // StickLot 필드에 데이터 입력
      document.getElementById('StickLot').value = event.data.lot;
    } else if (event.data.type === 'StickLotforQc') {
      // Stick Lot 스캐너로 받은 데이터 처리
      const stickLotSelect = document.getElementById('stickLotSelect');
      const scannedLot = event.data.lot;

      // Stick Lot이 선택 목록에 있는지 확인
      const optionExists = Array.from(stickLotSelect.options).some(option => option.value === scannedLot);

      if (optionExists) {
        stickLotSelect.value = scannedLot;
        fetch(`/GetStickDetail/${scannedLot}`)
          .then(response => {
            if (!response.ok) throw new Error('Failed to fetch Stick details');
            return response.json();
          })
          .then(stick => {
            updateStickInfo(stick);
            alert(`Stick Lot ${scannedLot}가 선택되었습니다.`);
          })
          .catch(error => {
            console.error('Error fetching Stick details:', error);
            alert('Stick 정보를 불러오는 중 오류가 발생했습니다.');
          });
      } else {

        // Stick 등록 탭으로 이동 및 값 설정
        document.getElementById('stick-tab').click();
        document.getElementById('stick-register-tab').click();

        document.getElementById('StickLot').value = scannedLot;
        if (event.data.exp) {
          const formattedDate = formatExpToDate(event.data.exp);
          document.getElementById('StickExpDate').value = formattedDate;
        }

        // alert(`Stick Lot ${scannedLot}이(가) 존재하지 않습니다.`);

      }
    }

    // exp 데이터가 있을 경우 추가 처리
    if (event.data.exp) {
      const expDateInput = document.getElementById('StickExpDate');
      if (expDateInput) {
        const formattedDate = formatExpToDate(event.data.exp);
        console.log('Setting StickExpDate:', formattedDate);
        expDateInput.value = formattedDate;
      }
    }
  }
});

// Register Device
function registerDevice() {
  const data = {
    PlaceCode: document.getElementById('registerPlaceCode').value,
    Serial: document.getElementById('registerSerial').value,
    StartDate: document.getElementById('registerStartDate').value,
    ReplaceSerial: document.getElementById('registerReplaceSerial').value || null, // 공란 허용
    ReplaceReason: document.getElementById('registerReplaceReason').value || null, // 교체 사유 추가
    Detail: document.getElementById('registerDetail').value || null, // 공란 허용
    IsActive: 1 // 항상 활성 상태로 저장
  };

  // 데이터 유효성 검증
  if (!data.PlaceCode || !data.Serial || !data.StartDate) {
    alert('필수 항목을 입력해주세요.');
    return;
  }

  // 서버로 데이터 전송
  fetch('/RegisterDevice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
    .then(response => {
      if (response.ok) {
        alert('장비가 성공적으로 등록되었습니다!');
        document.getElementById('registerDeviceForm').reset(); // 폼 초기화
        loadDeviceList();
      } else {
        alert('장비 등록에 실패했습니다.');
      }
    })
    .catch(error => {
      console.error('Error registering device:', error);
      alert('장비 등록 중 오류가 발생했습니다.');
    });
}

//Load Device List
function loadDeviceList() {
  fetch('/DeviceList')
    .then(response => response.json())
    .then(data => {
      const tableBody = document.getElementById('device-table-body');
      tableBody.innerHTML = ''; // 기존 데이터 초기화

      data.forEach(device => {
        // Inactive 상태인 경우 행에 table-secondary 클래스 추가
        const rowClass = device.IsActive ? '' : 'table-secondary ';

        const row = `
      <tr data-device-id="${device.DeviceId}" class="${rowClass}">
        <td>${device.PlaceName || ''}</td>
        <td>${device.Serial || ''}</td>
        <td class="hide-on-mobile">${device.StartDate || ''}</td>
        <td class="hide-on-mobile">${device.EndDate || ''}</td>
        <td class="hide-on-mobile">${device.ReplaceSerial || ''}</td>
        <td class="hide-on-mobile">${device.ReplaceReason || ''}</td>
        <td>${device.Detail || ''}</td>
        <td>${device.IsActive ? 'Active' : 'Inactive'}</td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="editDevice('${device.DeviceId}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteDevice('${device.DeviceId}')">Delete</button>
        </td>
      </tr>
    `;
        tableBody.innerHTML += row;
      });
    })
    .catch(error => console.error('Error fetching device list:', error));
}

// 수정 모달에 데이터 채우기
function editDevice(deviceId) {
  fetch(`/DeviceDetail/${deviceId}`)
    .then(response => response.json())
    .then(device => {
      document.getElementById('editDeviceId').value = device.DeviceId;
      document.getElementById('editPlaceCode').value = device.PlaceCode;
      document.getElementById('editSerial').value = device.Serial;
      document.getElementById('editStartDate').value = device.StartDate;
      document.getElementById('editEndDate').value = device.EndDate;
      document.getElementById('editReplaceSerial').value = device.ReplaceSerial;
      document.getElementById('editReplaceReason').value = device.ReplaceReason || ''; // 교체사유 필드
      document.getElementById('editDetail').value = device.Detail;
      document.getElementById('editIsActive').value = device.IsActive.toString();

      // 모달 표시
      new bootstrap.Modal(document.getElementById('editDeviceModal')).show();
    })
    .catch(error => console.error('Error fetching device details:', error));
}

// 수정 내용 저장
function saveEdit() {
  const data = {
    DeviceId: document.getElementById('editDeviceId').value,
    PlaceCode: document.getElementById('editPlaceCode').value,
    Serial: document.getElementById('editSerial').value,
    StartDate: document.getElementById('editStartDate').value,
    EndDate: document.getElementById('editEndDate').value || null, // 공란 처리
    ReplaceSerial: document.getElementById('editReplaceSerial').value || null, // 공란 처리
    ReplaceReason: document.getElementById('editReplaceReason').value || null, // 교체사유 추가
    Detail: document.getElementById('editDetail').value || null, // 공란 처리
    IsActive: document.getElementById('editIsActive').value === 'true'
  };

  fetch('/UpdateDevice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
    .then(response => {
      if (response.ok) {
        alert('Device updated successfully!');
        window.location.reload();
      } else {
        alert('Failed to update device.');
      }
    })
    .catch(error => console.error('Error updating device:', error));
}



// 장비 삭제 함수
function deleteDevice(deviceId) {
  if (confirm(`Are you sure you want to delete device with ID: ${deviceId}?`)) {
    fetch(`/DeleteDevice/${deviceId}`, {
      method: 'DELETE'
    })
      .then(response => {
        if (response.ok) {
          alert('Device deleted successfully!');
          loadDeviceList(); // 장비 목록 다시 로드
        } else {
          alert('Failed to delete device.');
        }
      })
      .catch(error => console.error('Error deleting device:', error));
  }
}



// Stick 등록
async function registerStick() {
  const data = {
    StickLot: document.getElementById('StickLot').value,
    StickExpDate: document.getElementById('StickExpDate').value,
    LowMin: document.getElementById('LowMin').value || null,
    LowMax: document.getElementById('LowMax').value || null,
    HighMin: document.getElementById('HighMin').value || null,
    HighMax: document.getElementById('HighMax').value || null
  };

  if (!data.StickLot || !data.StickExpDate) {
    alert('StickLot 및 StickExpDate는 필수 항목입니다.');
    return;
  }

  try {
    const response = await fetch('/RegisterStick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (response.ok) {
      alert(result.message);
      document.getElementById('stickRegisterForm').reset();
      loadSticks();
    } else {
      alert(result.error || '등록에 실패했습니다.');
    }
  } catch (error) {
    console.error('Error registering stick:', error);
    alert('Stick 등록 중 오류가 발생했습니다.');
  }
}

// Stick 목록 불러오기
function loadSticks() {
  fetch('/GetSticks')
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      const stickLotSelect = document.getElementById('stickLotSelect');
      const tableBody = document.getElementById('sticks-table-body');

      if (!stickLotSelect || !tableBody) {
        console.error('HTML 요소를 찾을 수 없습니다.');
        return;
      }

      stickLotSelect.innerHTML = '<option value="" disabled selected>Stick Lot을 선택하세요</option>';
      tableBody.innerHTML = ''; // 기존 데이터 초기화

      data.forEach(stick => {
        // 테이블 업데이트
        const row = `
      <tr>
        <td>${stick.StickLot}</td>
        <td>${stick.StickExpDate || ''}</td>
        <td>${stick.LowMin || ''} - ${stick.LowMax || ''}</td>
        <td>${stick.HighMin || ''} - ${stick.HighMax || ''}</td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="editStick('${stick.StickLot}')">수정</button>
          <button class="btn btn-danger btn-sm" onclick="deleteStick('${stick.StickLot}')">삭제</button>
        </td>
      </tr>
    `;
        tableBody.innerHTML += row;

        // Stick Lot 선택 옵션 추가
        const option = document.createElement('option');
        option.value = stick.StickLot;
        option.textContent = stick.StickLot;
        stickLotSelect.appendChild(option);
      });
    })
    .catch(error => {
      console.error('Error loading sticks:', error);
      alert('Stick 데이터를 불러오는 중 오류가 발생했습니다.');
    });
}


//Stick Lot 선택 갱신
document.getElementById('stickLotSelect').addEventListener('change', function () {
  const selectedStickLot = this.value;

  if (!selectedStickLot) {
    // Stick Lot이 선택되지 않았을 때 정보를 초기화
    updateStickInfo(null);
    return;
  }

  // 서버에서 Stick Lot 세부정보 가져오기
  fetch(`/GetStickDetail/${selectedStickLot}`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(stick => {
      updateStickInfo(stick);
    })
    .catch(error => {
      console.error('Error fetching Stick details:', error);
      alert('Stick 정보를 불러오는 중 오류가 발생했습니다.');
    });
});

function updateStickInfo(stick) {
  const stickExpDate = document.getElementById('stickExpDate');
  const stickLow = document.getElementById('stickLow');
  const stickHigh = document.getElementById('stickHigh');

  if (stick) {
    stickExpDate.textContent = stick.StickExpDate || 'N/A';
    stickLow.textContent = `${stick.LowMin || 'N/A'} - ${stick.LowMax || 'N/A'}`;
    stickHigh.textContent = `${stick.HighMin || 'N/A'} - ${stick.HighMax || 'N/A'}`;
  } else {
    stickExpDate.textContent = '';
    stickLow.textContent = '';
    stickHigh.textContent = '';
  }
}

// Stick 수정
function editStick(stickLot) {
  fetch(`/GetStickDetail/${stickLot}`)
    .then(response => response.json())
    .then(stick => {
      document.getElementById('editStickLot').value = stick.StickLot;
      document.getElementById('editStickExpDate').value = stick.StickExpDate;
      document.getElementById('editLowMin').value = stick.LowMin;
      document.getElementById('editLowMax').value = stick.LowMax;
      document.getElementById('editHighMin').value = stick.HighMin;
      document.getElementById('editHighMax').value = stick.HighMax;

      // 모달 표시
      new bootstrap.Modal(document.getElementById('editStickModal')).show();
    })
    .catch(error => console.error('Error fetching Stick details:', error));
}
// Stick 수정 저장
function saveStickEdit() {
  const data = {
    StickLot: document.getElementById('editStickLot').value,
    StickExpDate: document.getElementById('editStickExpDate').value,
    LowMin: document.getElementById('editLowMin').value,
    LowMax: document.getElementById('editLowMax').value,
    HighMin: document.getElementById('editHighMin').value,
    HighMax: document.getElementById('editHighMax').value
  };

  fetch('/UpdateStick', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
    .then(response => {
      if (response.ok) {
        alert('Stick 수정이 성공적으로 완료되었습니다!');
        window.location.reload();
      } else {
        alert('Stick 수정에 실패했습니다.');
      }
    })
    .catch(error => console.error('Error updating Stick:', error));
}
// Stick 삭제
function deleteStick(stickLot) {
  if (confirm(`Stick Lot ${stickLot}을 삭제하시겠습니까?`)) {
    fetch(`/DeleteStick/${stickLot}`, { method: 'DELETE' })
      .then(response => {
        if (response.ok) {
          alert('Stick이 성공적으로 삭제되었습니다.');
          window.location.reload();
        } else {
          alert('Stick 삭제에 실패했습니다.');
        }
      })
      .catch(error => console.error('Error deleting Stick:', error));
  }
}

// 대화상자 컨테이너에 추가된 시리얼 번호 저장
let addedDeviceSerials = [];

// 현재 조회된 모든 장비의 Serial을 저장
let availableDeviceSerials = [];

// 장비 일괄추가 버튼 추가
document.getElementById('bulkAddButton').addEventListener('click', () => {
  const stickLotSelect = document.getElementById('stickLotSelect');
  const selectedStickLot = stickLotSelect.value;
  if (!selectedStickLot) {
    alert('Stick Lot를 선택해주세요.');
    return;
  }
  if (availableDeviceSerials.length === 0) {
    alert('등록된 장비가 없습니다.');
    return;
  }

  availableDeviceSerials.forEach(serial => {
    if (!addedDeviceSerials.includes(serial)) {
      addedDeviceSerials.push(serial); // 추가된 장비 추적
      createDialog(serial); // 대화상자 생성
    }
  });

  alert('모든 장비가 추가되었습니다.');
});

// 대화상자 생성
document.getElementById('addDialogButton').addEventListener('click', () => {
  const deviceSerialSelect = document.getElementById('deviceSerialSelect');
  const selectedSerial = deviceSerialSelect.value;
  const stickLotSelect = document.getElementById('stickLotSelect');
  const selectedStickLot = stickLotSelect.value;
  if (!selectedStickLot) {
    alert('Stick Lot를 선택해주세요.');
    return;
  }
  if (!selectedSerial) {
    alert('장비를 선택하세요.');
    return;
  }

  if (addedDeviceSerials.includes(selectedSerial)) {
    alert('이미 추가된 장비입니다.');
    return;
  }

  addedDeviceSerials.push(selectedSerial);
  createDialog(selectedSerial);
});

// 대화상자 생성 함수
function createDialog(serial) {
  const dialogContainer = document.getElementById('dialogContainer');

  const dialog = document.createElement('div');
  dialog.className = 'card p-3 mb-3';
  dialog.id = `dialog-${serial}`;

  dialog.innerHTML = `
<div class="card-body">
  <div class="d-flex justify-content-between align-items-center">
    <h5 class="card-title">장비: ${serial}</h5>
    <button class="btn btn-danger btn-sm" onclick="removeDialog('${serial}')">-</button>
  </div>
  <div class="mb-3">
    <label for="lowResult-${serial}" class="form-label">Low Result</label>
    <input type="tel" class="form-control" id="lowResult-${serial}" placeholder="Low Result 값을 입력하세요">
  </div>
  <div class="mb-3">
    <label for="highResult-${serial}" class="form-label">High Result</label>
    <input type="tel" class="form-control" id="highResult-${serial}" placeholder="High Result 값을 입력하세요">
  </div>
  <div class="mb-3">
    <label for="resultCheck-${serial}" class="form-label">결과판정</label>
    <input type="text" class="form-control" id="resultCheck-${serial}" placeholder="결과판정" readonly>
  </div>
  <div class="mb-3">
    <label for="deviceCheck-${serial}" class="form-label">장비 이상 유무</label>
    <select class="form-control" id="deviceCheck-${serial}">
      <option value="정상" selected>정상</option>
      <option value="비정상">비정상</option>
    </select>
  </div>
  <div class="mb-3">
    <label for="comment-${serial}" class="form-label">비고</label>
    <textarea class="form-control" id="comment-${serial}" rows="3"></textarea>
  </div>
</div>
`;

  dialogContainer.appendChild(dialog);

  // Low Result, High Result 입력값 변경 시 결과판정 자동 설정
  const lowResultInput = document.getElementById(`lowResult-${serial}`);
  const highResultInput = document.getElementById(`highResult-${serial}`);
  const resultCheckInput = document.getElementById(`resultCheck-${serial}`);

  [lowResultInput, highResultInput].forEach(input => {
    input.addEventListener('input', () => {
      const lowResult = parseFloat(lowResultInput.value);
      const highResult = parseFloat(highResultInput.value);

      // Stick Lot의 Low/High Min/Max 가져오기
      const stickLowMin = parseFloat(document.getElementById('stickLow').textContent.split(' - ')[0]) || null;
      const stickLowMax = parseFloat(document.getElementById('stickLow').textContent.split(' - ')[1]) || null;
      const stickHighMin = parseFloat(document.getElementById('stickHigh').textContent.split(' - ')[0]) || null;
      const stickHighMax = parseFloat(document.getElementById('stickHigh').textContent.split(' - ')[1]) || null;

      // 판정 로직
      const isLowValid = stickLowMin !== null && stickLowMax !== null && lowResult >= stickLowMin && lowResult <= stickLowMax;
      const isHighValid = stickHighMin !== null && stickHighMax !== null && highResult >= stickHighMin && highResult <= stickHighMax;

      if (isLowValid && isHighValid) {
        resultCheckInput.value = '정상';
      } else {
        resultCheckInput.value = '비정상';
      }
    });
  });
}

// 대화상자 삭제 함수
function removeDialog(serial) {
  const dialogContainer = document.getElementById('dialogContainer');
  const dialog = document.getElementById(`dialog-${serial}`);

  if (dialog) {
    dialogContainer.removeChild(dialog);
    addedDeviceSerials = addedDeviceSerials.filter(item => item !== serial); // 시리얼 번호 목록에서 제거
  }
}

// 서명 캔버스 설정
const signatureCanvas = document.getElementById('signatureCanvas');
const ctx = signatureCanvas.getContext('2d');
let isDrawing = false;

// 이벤트 헬퍼 함수
function getPointerPosition(event) {
  if (event.touches && event.touches[0]) {
    // 터치 이벤트
    const rect = signatureCanvas.getBoundingClientRect();
    return {
      x: event.touches[0].clientX - rect.left,
      y: event.touches[0].clientY - rect.top,
    };
  } else {
    // 마우스 또는 포인터 이벤트
    return {
      x: event.offsetX,
      y: event.offsetY,
    };
  }
}

// 서명 시작
function startDrawing(event) {
  isDrawing = true;
  const { x, y } = getPointerPosition(event);
  ctx.moveTo(x, y);
}

// 서명 중
function draw(event) {
  if (!isDrawing) return;
  const { x, y } = getPointerPosition(event);
  ctx.lineTo(x, y);
  ctx.stroke();
}

// 서명 종료
function stopDrawing() {
  isDrawing = false;
  ctx.beginPath(); // 새로운 경로 시작
}

// 서명 초기화 버튼
document.getElementById('clearSignature').addEventListener('click', () => {
  ctx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
});

// 이벤트 리스너 등록
signatureCanvas.addEventListener('mousedown', startDrawing);
signatureCanvas.addEventListener('mousemove', draw);
signatureCanvas.addEventListener('mouseup', stopDrawing);
signatureCanvas.addEventListener('mouseout', stopDrawing);

// 모바일 터치 이벤트
signatureCanvas.addEventListener('touchstart', (event) => {
  event.preventDefault(); // 터치 스크롤 방지
  startDrawing(event);
});
signatureCanvas.addEventListener('touchmove', (event) => {
  event.preventDefault(); // 터치 스크롤 방지
  draw(event);
});
signatureCanvas.addEventListener('touchend', (event) => {
  event.preventDefault(); // 터치 스크롤 방지
  stopDrawing(event);
});

// 저장 버튼 클릭 시 서명 모달 표시
document.getElementById('saveAllButton').addEventListener('click', () => {
  const qcLot = document.getElementById('qcLot').value;
  const qcExpDate = document.getElementById('qcExpDate').value;

  if (!qcLot || !qcExpDate) {
    alert('QC 시약 정보를 입력하세요.');
    return;
  }

  const signModal = new bootstrap.Modal(document.getElementById('signModal'));
  signModal.show();
});

// 서명 저장 및 결과 저장
document.getElementById('saveSignature').addEventListener('click', async () => {
  const imageData = signatureCanvas.toDataURL('image/png');
  const qcLot = document.getElementById('qcLot').value;
  const qcExpDate = document.getElementById('qcExpDate').value;

  try {
    // 서명 이미지 서버 저장
    const signResponse = await fetch('/saveSign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData }),
    });

    if (!signResponse.ok) throw new Error('서명 저장 실패');
    const { signUuid } = await signResponse.json();

    // 대화상자 데이터 수집 및 저장
    const results = [];
    addedDeviceSerials.forEach((serial) => {
      results.push({
        Serial: serial,
        PlaceCode: document.getElementById('placeSelect').value,
        TestDate: document.getElementById('testDate').value,
        StickLot: document.getElementById('stickLotSelect').value,
        QcLot: qcLot,
        QcExpDate: qcExpDate,
        LowResult: document.getElementById(`lowResult-${serial}`).value,
        HighResult: document.getElementById(`highResult-${serial}`).value,
        ResultCheck: document.getElementById(`resultCheck-${serial}`).value,
        DeviceCheck: document.getElementById(`deviceCheck-${serial}`).value,
        Comment: document.getElementById(`comment-${serial}`).value,
        SignUuid: signUuid,
      });
    });

    const saveResponse = await fetch('/saveResults', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results }),
    });

    if (!saveResponse.ok) throw new Error('결과 저장 실패');
    alert('결과가 성공적으로 저장되었습니다!');
    window.location.reload();
  } catch (error) {
    console.error(error);
    alert('저장 중 오류가 발생했습니다.');
  }
});
// QC 시약 정보 저장 함수
function saveQcReagent() {
  const qcLot = document.getElementById('qcLot').value;
  const qcExpDate = document.getElementById('qcExpDate').value;

  if (!qcLot || !qcExpDate) {
    alert('QC Lot와 유효기간은 필수 입력 항목입니다.');
    return;
  }

  const qcData = {
    lot: qcLot,
    exp_date: qcExpDate
  };

  fetch('/UpdateQcReagent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(qcData),
  })
    .then(response => {
      if (!response.ok) throw new Error('Failed to save QC Reagent data');
      return response.json();
    })
    .then(data => {
      alert(data.message || 'QC 시약 정보가 성공적으로 저장되었습니다!');
      loadQcReagent(); // QC 정보 다시 불러오기
    })
    .catch(error => {
      console.error('Error saving QC Reagent:', error);
      alert('QC 시약 정보를 저장하는 중 오류가 발생했습니다.');
    });
}

// QC 시약 정보 불러오기
function loadQcReagent() {
  fetch('/GetQcReagent')
    .then(response => {
      if (!response.ok) throw new Error('Failed to fetch QC reagent data');
      return response.json();
    })
    .then(data => {
      document.getElementById('qcLot').value = data.lot || '';
      document.getElementById('qcExpDate').value = data.exp_date || '';
    })
    .catch(error => {
      console.error('Error loading QC reagent:', error);
    });
}

// QC 결과 날짜 변경 이벤트 핸들러
function handleQcDateChange() {
  const selectedDate = document.getElementById('qcDateSearch').value;

  if (!selectedDate) {
    alert('날짜를 선택하세요.');
    return;
  }

  fetchResultsByDate(selectedDate);
}

document.getElementById('qcDateSearch').addEventListener('change', handleQcDateChange);

// QC 결과 로드 함수
function fetchResultsByDate(date) {
  fetch(`/GetResultsByDate?testDate=${date}`)
    .then(response => {
      if (!response.ok) throw new Error('Failed to fetch results');
      return response.json();
    })
    .then(results => renderResultsTable(results))
    .catch(error => {
      console.error('Error fetching results:', error);
      alert('결과 데이터를 불러오는 중 오류가 발생했습니다.');
    });
}

// QC 결과를 자동으로 로드
function loadQcResults() {
  const selectedDate = document.getElementById('qcDateSearch').value;
  if (selectedDate) fetchResultsByDate(selectedDate);
}

// QC 결과 테이블 렌더링 함수
function renderResultsTable(results) {
  const tableBody = document.getElementById('resultsTableBody');
  tableBody.innerHTML = ''; // 기존 데이터 초기화

  results.forEach(result => {
    const row = `
  <tr>
    <td>${result.Serial}</td>
    <td>${result.PlaceCode || ''}</td>
    <td class="hide-on-mobile">${result.TestDate || ''}</td>
    <td class="hide-on-mobile">${result.StickLot || ''}</td>
    <td>${result.LowResult || ''}</td>
    <td>${result.HighResult || ''}</td>
    <td class="hide-on-mobile">${result.ResultCheck || ''}</td>
    <td class="hide-on-mobile">${result.DeviceCheck || ''}</td>
    <td class="hide-on-mobile">
      ${result.SignImg ? `<img src="data:image/png;base64,${result.SignImg}" alt="서명" style="width: 50px; height: auto;">` : 'N/A'}
    </td>
    <td class="hide-on-mobile">${result.Comment || ''}</td>
    <td>
      <button class="btn btn-warning btn-sm" onclick="editResult(${result.ResultId})">수정</button>
      <button class="btn btn-danger btn-sm" onclick="deleteResult(${result.ResultId})">삭제</button>
    </td>
  </tr>
`;
    tableBody.innerHTML += row;
  });

  // 모바일 테이블 스타일 적용
  adjustTableForMobile();
}

function editResult(resultId) {
  fetch(`/GetResultDetail/${resultId}`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to fetch result detail');
      }
      return response.json();
    })
    .then(result => {
      // 폼에 데이터 채우기
      document.getElementById('editResultId').value = result.ResultId;
      document.getElementById('editTestDate').value = result.TestDate || '';
      document.getElementById('editLowResult').value = result.LowResult || '';
      document.getElementById('editHighResult').value = result.HighResult || '';
      document.getElementById('editResultCheck').value = result.ResultCheck || '';
      document.getElementById('editDeviceCheck').value = result.DeviceCheck || '정상';
      document.getElementById('editComment').value = result.Comment || '';

      // 수정 모달 표시
      const editModal = new bootstrap.Modal(document.getElementById('editResultModal'));
      editModal.show();
    })
    .catch(error => {
      console.error('Error fetching result detail:', error);
      alert('결과 데이터를 불러오는 중 오류가 발생했습니다.');
    });
}
function saveEditedResult() {
  const data = {
    ResultId: document.getElementById('editResultId').value,
    TestDate: document.getElementById('editTestDate').value,
    LowResult: document.getElementById('editLowResult').value,
    HighResult: document.getElementById('editHighResult').value,
    ResultCheck: document.getElementById('editResultCheck').value,
    DeviceCheck: document.getElementById('editDeviceCheck').value,
    Comment: document.getElementById('editComment').value,
  };

  fetch('/UpdateResult', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to update result');
      }
      return response.json();
    })
    .then(() => {
      alert('결과가 성공적으로 수정되었습니다.');
      window.location.reload();
    })
    .catch(error => {
      console.error('Error updating result:', error);
      alert('결과 수정 중 오류가 발생했습니다.');
    });
}
function deleteResult(resultId) {
  if (!confirm('정말로 삭제하시겠습니까?')) return;

  fetch(`/DeleteResult/${resultId}`, {
    method: 'DELETE',
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to delete result');
      }
      return response.json();
    })
    .then(() => {
      alert('결과가 성공적으로 삭제되었습니다.');
      window.location.reload();
    })
    .catch(error => {
      console.error('Error deleting result:', error);
      alert('결과 삭제 중 오류가 발생했습니다.');
    });
}
document.getElementById('deleteUnusedSignsButton').addEventListener('click', async () => {
  const statusElement = document.getElementById('deleteUnusedSignsStatus');
  statusElement.textContent = "Deleting unused signs...";

  try {
    const response = await fetch('/DeleteUnusedSigns', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    if (response.ok) {
      statusElement.textContent = data.message;
    } else {
      statusElement.textContent = `Error: ${data.error || 'Failed to delete unused signs'}`;
    }
  } catch (error) {
    statusElement.textContent = `Unexpected error: ${error.message}`;
  }
});
// 보고서 생성 함수
function generateReport() {
  const startDate = document.getElementById('reportStartDate').value;
  const endDate = document.getElementById('reportEndDate').value;
  const reportManager = document.getElementById('reportManager').value;

  if (!startDate || !endDate) {
    alert('시작 날짜와 종료 날짜를 선택해주세요.');
    return;
  }

  fetch('/generateReport', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate, endDate })
  })
    .then(response => {
      if (!response.ok) throw new Error('Failed to generate report');
      return response.json();
    })
    .then(data => {
      const reportData = data.data;
      const summary = data.summary;
      console.log(summary);
      const reportContentDiv = document.getElementById('reportContent');
      const reportDataDiv = document.getElementById('reportData');
      const reportPeriod = document.getElementById('reportPeriod');
      const reportQcLot = document.getElementById('reportQcLot');
      const reportQcExpDate = document.getElementById('reportQcExpDate');
      const reportManagerDisplay = document.getElementById('reportManagerDisplay')
      reportDataDiv.innerHTML = ''; // 기존 내용 초기화

      // 첫 번째 행의 QcLot, QcExpDate 값을 가져옴
      const firstRow = reportData[0] || {};
      const qcLot = firstRow.QcLot || '';
      const qcExpDate = firstRow.QcExpDate || '';

      // 헤더 정보 업데이트
      reportPeriod.textContent = `${startDate} ~ ${endDate}`;
      reportQcLot.textContent = qcLot;
      reportQcExpDate.textContent = qcExpDate;
      reportManagerDisplay.textContent = reportManager;

      // 테이블 데이터 동적 생성
      let reportHTML = `
    <table class="table table-sm align-middle">
      <thead>
        <tr>
          <th rowspan="2">장소</th>
          <th rowspan="2">시행일</th>
          <th rowspan="2">장비 Serial</th>
          <th rowspan="2">Stick Lot</th>
          <th>Low</th>
          <th>High</th>
          <th rowspan="2">결과판정</th>
          <th rowspan="2">장비상태</th>
          <th rowspan="2">검사자</th>
          <th rowspan="2">비고</th>
        </tr>
        <tr>
          <th>범위</th>
          <th>범위</th>
      </thead>
      <tbody>
  `;

      reportData.forEach(row => {
        reportHTML += `
      <tr>
        <td rowspan="2">${row.PlaceName || ''}</td>
        <td rowspan="2">${row.TestDate || ''}</td>
        <td rowspan="2">${row.Serial}</td>
        <td rowspan="2">${row.StickLot || ''}</td>
        <td>${row.LowResult || ''}</td>
        <td>${row.HighResult || ''}</td>
        <td rowspan="2">${row.ResultCheck || ''}</td>
        <td rowspan="2">${row.DeviceCheck || ''}</td>
        <td rowspan="2">${row.SignImg ? `<img src="data:image/png;base64,${row.SignImg}" style="width:50px;">` : ''}</td>            
        <td rowspan="2">${row.Comment || ''}</td>
      </tr>
      <tr>
        <td>${row.LowMin || ''}-${row.LowMax || ''}</td>
        <td>${row.HighMin || ''}-${row.HighMax || ''}</td>
    `;
      });

      reportHTML += `
      </tbody>
    </table>
  `;

      reportDataDiv.innerHTML = reportHTML;
      reportContentDiv.style.display = 'block';
    })
    .catch(error => {
      console.error('Error generating report:', error);
      alert('보고서를 생성하는 중 오류가 발생했습니다.');
    });
}

// 프린트 함수
function printReport() {
  // 보고서 콘텐츠 가져오기
  const reportContent = document.getElementById('reportContent').outerHTML;

  // 새 창 열기
  const newWindow = window.open('', '_blank');

  // 새 창에 HTML 작성
  newWindow.document.write(`
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>보고서 프린트</title>
  <!-- 외부 CSS 파일 로드 -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.1/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 20px;
    }
    .border {
      border: 1px solid #black;
      padding: 20px;
      background-color: #f9f9f9;
    }
    table.table-sm {
      text-align: center;
    }
    table.table-sm th {
      vertical-align: middle;
    }
    table.table-sm td {
      vertical-align: middle;
    }
    body {
      font-size: 12px;
      color: #000;
    }
    button {
      display: none;
    }
    @media print {
      table.table-sm {
        text-align: center;
      }
      table.table-sm th {
        vertical-align: middle;
      }
      table.table-sm td {
        vertical-align: middle;
      }
      body {
        font-size: 12px;
        color: #000;
      }
      button {
        display: none;
      }
    }
  </style>
</head>
<body>
  ${reportContent}
</body>
</html>
`);

  // CSS 로드 완료 후 프린트 실행
  newWindow.onload = () => {
    newWindow.focus(); // 새 창에 포커스 설정
    newWindow.print(); // 프린트 실행
    newWindow.close(); // 프린트 완료 후 새 창 닫기
  };

  // HTML 작성 완료
  newWindow.document.close();
}

function printDeviceTable() {
  const table = document.querySelector('#modify .table-responsive table');

  if (!table) {
    alert('출력할 테이블이 없습니다.');
    return;
  }

  // 테이블 복사본 생성
  const clonedTable = table.cloneNode(true);

  // "수정/삭제" 열 제거 (마지막 열 기준)
  const headerRow = clonedTable.querySelector('thead tr');
  if (headerRow) {
    headerRow.removeChild(headerRow.lastElementChild); // 헤더의 마지막 열 제거
  }

  const bodyRows = clonedTable.querySelectorAll('tbody tr');
  bodyRows.forEach(row => {
    row.removeChild(row.lastElementChild); // 본문의 마지막 열 제거
  });

  // 현재 날짜 가져오기
  const today = new Date();
  const formattedDate = today.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  // 새로운 창에 테이블 출력
  const newWindow = window.open('', '_blank');
  newWindow.document.write(`
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>장비 목록 출력</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.1/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body {
      margin: 20px;
      font-family: 'Noto Sans KR', sans-serif;
    }
    table {
      text-align: center;
      width: 100%;
      border-collapse: collapse;
    }
    table th, table td {
      border: 1px solid #ddd;
      padding: 8px;
    }
    table th {
      background-color: #f2f2f2;
      font-weight: bold;
    }
    .date {
      text-align: right;
      margin-bottom: 10px;
      font-size: 14px;
      color: #333;
    }
    @media print {
      body {
        font-size: 12px;
      }
      button {
        display: none;
      }
    }
  </style>
</head>
<body>
  <h1 style="text-align: center;">장비 목록</h1>
  <div class="date">작성일: ${formattedDate}</div>
  ${clonedTable.outerHTML} <!-- 수정된 테이블 내용 삽입 -->
</body>
</html>
`);
  newWindow.document.close();
  newWindow.print();
}

function loadPlaceList() {
  console.log("loadPlaceList 함수 실행됨"); // 함수 실행 확인

  // 테이블 요소 가져오기
  const tableBody = document.getElementById('place-table-body');
  const registerPlaceSelect = document.getElementById('registerPlaceCode');
  const placeSelect = document.getElementById('placeSelect');
  
  fetch('/GetPlaces')
      .then(response => {
          if (!response.ok) {
              throw new Error(`서버 응답 오류: ${response.status}`);
          }
          return response.json();
      })
      .then(data => {
          console.log("API 응답 데이터:", data); // API 응답 확인

          if (!Array.isArray(data)) {
              throw new Error("API에서 예상치 못한 데이터 형식이 반환되었습니다.");
          }

          // 📌 1. 장소 테이블 업데이트
          if (tableBody) {
              tableBody.innerHTML = ''; // 기존 데이터 초기화
              data.forEach(place => {
                  const row = `
                      <tr>
                          <td>${place.PlaceCode || 'N/A'}</td>
                          <td>${place.PlaceClass || 'N/A'}</td>
                          <td>${place.PlaceName || 'N/A'}</td>
                          <td>
                              <button class="btn btn-primary btn-sm" onclick="editPlace(${place.PlaceId})">수정</button>
                              <button class="btn btn-danger btn-sm" onclick="deletePlace(${place.PlaceId})">삭제</button>
                          </td>
                      </tr>
                  `;
                  tableBody.innerHTML += row;
              });
          } else {
              console.warn("Warning: 'place-table-body' 요소를 찾을 수 없습니다.");
          }

          // 📌 2. registerPlaceCode 드롭다운 업데이트
          if (registerPlaceSelect) {
              console.log("장소리스트 로드")
              registerPlaceSelect.innerHTML = '<option value="" disabled selected>장소를 선택하세요</option>';
              data.forEach(place => {
                  const option = document.createElement('option');
                  option.value = place.PlaceCode;
                  option.textContent = place.PlaceName;
                  registerPlaceSelect.appendChild(option);
              });
          } else {
              console.warn("Warning: 'registerPlaceCode' 요소를 찾을 수 없습니다.");
          }

          // 📌 3. placeSelect 드롭다운 업데이트
          if (placeSelect) {
              placeSelect.innerHTML = '<option value="" disabled selected>장소를 선택하세요</option>';
              data.forEach(place => {
                  const option = document.createElement('option');
                  option.value = place.PlaceCode;
                  option.textContent = place.PlaceName;
                  placeSelect.appendChild(option);
              });
          } else {
              console.warn("Warning: 'placeSelect' 요소를 찾을 수 없습니다.");
          }
      })
      .catch(error => {
          console.error('Error in loadPlaceList:', error);
          alert('장소 목록을 불러오는 중 오류가 발생했습니다.');
      });
}
  function registerPlace() {
    const data = {
      PlaceCode: document.getElementById('PlaceCode').value,
      PlaceClass: document.getElementById('PlaceClass').value,
      PlaceName: document.getElementById('PlaceName').value
    };
  
    if (!data.PlaceCode || !data.PlaceClass || !data.PlaceName) {
      alert('모든 필수 항목을 입력해주세요.');
      return;
    }
  
    fetch('/RegisterPlace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(response => response.json())
      .then(result => {
        if (result.message) {
          alert(result.message);
          document.getElementById('placeRegisterForm').reset();
          loadPlaceList(); // 목록 새로고침
        } else {
          alert(result.error || '등록에 실패했습니다.');
        }
      })
      .catch(error => {
        console.error('Error registering place:', error);
        alert('장소 등록 중 오류가 발생했습니다.');
      });
  }
  function editPlace(placeId) {
    fetch(`/GetPlaces`)
      .then(response => response.json())
      .then(data => {
        const place = data.find(p => p.PlaceId === placeId);
        if (!place) {
          alert('장소 정보를 찾을 수 없습니다.');
          return;
        }
  
        // 모달에 데이터 채우기
        document.getElementById('editPlaceId').value = place.PlaceId;
        document.getElementById('editPlaceCode').value = place.PlaceCode;
        document.getElementById('editPlaceClass').value = place.PlaceClass;
        document.getElementById('editPlaceName').value = place.PlaceName;
  
        // 모달 표시
        new bootstrap.Modal(document.getElementById('editPlaceModal')).show();
      })
      .catch(error => {
        console.error('Error fetching place details:', error);
        alert('장소 정보를 불러오는 중 오류가 발생했습니다.');
      });
  }
  function savePlaceEdit() {
    const data = {
      PlaceCode: document.getElementById('editPlaceCode').value,
      PlaceClass: document.getElementById('editPlaceClass').value,
      PlaceName: document.getElementById('editPlaceName').value
    };
  
    const placeId = document.getElementById('editPlaceId').value;
  
    fetch(`/UpdatePlace/${placeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(response => response.json())
      .then(result => {
        if (result.message) {
          alert(result.message);
          loadPlaceList(); // 목록 새로고침
          bootstrap.Modal.getInstance(document.getElementById('editPlaceModal')).hide();
        } else {
          alert(result.error || '수정에 실패했습니다.');
        }
      })
      .catch(error => {
        console.error('Error updating place:', error);
        alert('장소 수정 중 오류가 발생했습니다.');
      });
  }
  function deletePlace(placeId) {
    if (!confirm('정말로 이 장소를 삭제하시겠습니까?')) return;
  
    fetch(`/DeletePlace/${placeId}`, {
      method: 'DELETE'
    })
      .then(response => response.json())
      .then(result => {
        if (result.message) {
          alert(result.message);
          loadPlaceList(); // 목록 새로고침
        } else {
          alert(result.error || '삭제에 실패했습니다.');
        }
      })
      .catch(error => {
        console.error('Error deleting place:', error);
        alert('장소 삭제 중 오류가 발생했습니다.');
      });
  }
