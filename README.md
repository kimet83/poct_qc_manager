# 📘 **POCT QC Manager - Docker Compose 설정 가이드**

---

## 🚀 **개요**

안녕하세요! 👋 **POCT QC Manager**입니다.  
저는 **Python (Quart)** 를 백엔드로 사용하고, **MariaDB**로 데이터를 관리하며, **Docker Compose**로 컨테이너화된 환경을 제공합니다.  
주요 기능으로는 **장비 관리**, **Stick 관리**, **QC 결과 보고**, **결과 확인 및 수정**이 있으며, 웹 기반으로 효율적인 관리 시스템을 제공합니다.  
혈당 측정기 관리 및 QC(정도 관리)를 위한 웹 애플리케이션이죠.  
모바일웹의 경우 카메라를 사용한 **바코드 인식**으로 장비 및 Stick 인식이 가능합니다.  
Docker Compose를 사용해 손쉽게 실행하고 관리할 수 있어요. 🐳

---
## 🧩 **애플리케이션 지원 기기(확인된 장비)**

![Asan-Chek](https://www.asanpharm.co.kr/data/editor/2402//2e1f7fa0ab9f3a8c4cfb64a0a254acab_1708587151_5886.png)
- Asan-Chek [홈페이지](https://asanpharm.co.kr/bbs/board.php?bo_table=product_01&wr_id=1869)  
(확인 후 지원기기 추가 예정)
---

## 📂 **프로젝트 구조**

```
.
├── app/                # 핵심 소스 코드
├── docker-compose.yml  # 도커 설정 파일
├── .env                # 설정 파일
├── run.sh             # 실행하기 위한 스크립트
└── README.md          # 이 문서
```

---

## 🔧 **시스템 요구사항**

- **Docker** 🐋 → [설치하기](https://docs.docker.com/get-docker/)
- **Docker Compose** 📦 → [설치하기](https://docs.docker.com/compose/install/)
- **Git** 🌟 → [설치하기](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)

---

## 📥 **다운로드**

```bash
# 소스 가져오기
git clone git@github.com:kimet83/poct_qc_manager.git
cd poct_qc_manager

# 실행 권한 설정
chmod +x run.sh
```

---

## 🔧 **내 설정 변경하기**

`.env` 파일을 작성하여 환경 변수를 확인하고 필요에 따라 수정하세요.

```env
APP_PORT=5012
ACCESS_PASSWORD=1022
PROTECTED_TABS=device,report

DATABASE_HOST=db
DATABASE_PORT=3306
DATABASE_EXTERNAL_PORT=3306
DATABASE_USER=myuser
DATABASE_PASSWORD=mypassword
DATABASE_NAME=mydatabase
DATABASE_ROOT_PASSWORD=rootpassword
```

- **ACCESS_PASSWORD:** 암호 입력 시 필요한 비밀번호  
- **PROTECTED_TABS:** 암호가 필요한 탭 (쉼표로 구분) device, stick, report, qc, place

---

## ▶️ **실행하기**

### **1. 스크립트를 사용해서 실행**
스크립트를 사용하면 복잡한 Docker 명령어를 일일이 입력할 필요 없이 한 번의 실행으로 프로젝트를 빌드하고 실행할 수 있습니다. 또한, 스크립트는 Git 업데이트 및 Docker Compose 실행 등의 작업을 자동화하여 개발자의 시간을 절약해 줍니다.  
```bash
./run.sh
```

### **2. 수동으로 실행**  
```bash
docker-compose up --build -d
```

---

## 🌐 **내 웹 페이지 확인**

- **웹 애플리케이션:** [http://localhost:5012](http://localhost:5012)  
- **데이터베이스 (MariaDB):** `localhost:3306`

---

## 🔑 **내 환경 변수 설명**

| **변수명**       | **기본값** | **설명**                  |
|------------------|-----------|--------------------------|
| `DATABASE_HOST`  | `db`      | 데이터베이스 호스트 이름   |
| `DATABASE_PORT`  | `3306`    | 데이터베이스 포트         |
| `DATABASE_EXTERNAL_PORT`  | `3306`    | 데이터베이스  외부포트         |
| `DATABASE_USER`  | `myuser`  | 데이터베이스 사용자 이름   |
| `DATABASE_PASSWORD` | `mypassword` | 데이터베이스 비밀번호 |
| `DATABASE_NAME`  | `mydatabase` | 데이터베이스 이름        |
| `ACCESS_PASSWORD` | `1022`   | 접근 암호                |
| `PROTECTED_TABS` | `device,report` | 암호가 필요한 탭 목록 |

---

## 🧩 **서비스 구성**

### **1️⃣ app (Quart 애플리케이션)**
- **포트:** `5012:5012`
- **역할:** 백엔드 API 제공

### **2️⃣ db (MariaDB)**
- **포트:** `3306:3306`
- **역할:** 데이터 저장

---

## 🔒 **암호 보호 탭 (PROTECTED_TABS)**

- `device`: 장비 관리 탭  
- `report`: 결과 보고 탭  
- 필요에 따라 다른 탭을 추가하거나 제거할 수 있어요.  

---

## 🐳 **Docker 명령어**

- **모든 컨테이너 시작:**  
  ```bash
  docker-compose up -d
  ```
- **컨테이너 중지:**  
  ```bash
  docker-compose down
  ```
- **로그 확인:**  
  ```bash
  docker-compose logs -f
  ```
- **컨테이너 상태 확인:**  
  ```bash
  docker-compose ps
  ```

---

## 🔑 **안전하게 사용하려면?**

1. **ACCESS_PASSWORD**는 안전한 비밀번호로 설정해 주세요.  
2. 중요한 환경 변수는 `.env` 파일에 저장하고 `.gitignore`에 추가하세요.

---

## 🔧 **문제해결**

### 🔧 **1. Docker Compose 실행 실패**
- 오류 확인:  
  ```bash
  docker-compose logs
  ```
- 권한 확인:  
  ```bash
  chmod +x run.sh
  ```

### 🔧 **2. 데이터베이스 연결 오류**
- 데이터베이스가 정상적으로 작동하는지 확인:  
  ```bash
  docker ps
  ```

---

## 📄 **내 GitHub 링크**

[GitHub Repository](https://github.com/kimet83/poct_qc_manager)

---

## 📬 **궁금한 게 있나요?**

- **이메일:** [kimet83@gmail.com](mailto:kimet83@gmail.com)  
- **문제 보고:** [GitHub Issues](https://github.com/kimet83/poct_qc_manager/issues)

---

## 라이선스

이 프로젝트는 Bootstrap을 사용하며, MIT 라이선스에 따라 배포됩니다.  
자세한 내용은 [LICENSE](./LICENSE) 파일을 참고하세요.

---

## 🎯 **마무리**

**이제 완전히 준비되었습니다!** 🚀  
`./run.sh` 명령어로 저를 실행하고 브라우저에서 `http://localhost:5012`로 접속하세요.  
더 나은 개선 사항이 있다면 GitHub에서 알려주세요. 😊  

**감사합니다! ❤️**

