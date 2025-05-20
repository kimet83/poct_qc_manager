from quart import Quart, render_template, jsonify, request
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from sqlalchemy import Column, Integer, String, Text, Date, Boolean, Enum, TIMESTAMP, ForeignKey, BLOB, asc, desc, CHAR, and_, or_
from sqlalchemy.sql import func, text
from sqlalchemy.future import select
import aiomysql
import json
from barcode import analyze_barcode  # barcode.py에 정의된 함수
import uuid
import base64  # Base64 인코딩 및 디코딩 처리
import traceback  # 오류 스택 트레이스를 출력하기 위해 추가
import logging  # 추가
from datetime import datetime  # datetime 추가
import os

app = Quart(__name__)

# 환경 변수로 데이터베이스 설정
DB_USER = os.getenv('DATABASE_USER', 'myuser')
DB_PASSWORD = os.getenv('DATABASE_PASSWORD', 'mypassword')
DB_HOST = os.getenv('DATABASE_HOST', 'db')  # MariaDB 컨테이너 이름
DB_PORT = os.getenv('DATABASE_EXTERNAL_PORT', '3306')
DB_NAME = os.getenv('DATABASE_NAME', 'mydatabase')
DB_CHARSET = "utf8mb4"
# 환경 변수에서 접근 암호 가져오기
ACCESS_PASSWORD = os.getenv('ACCESS_PASSWORD', '1022')
PROTECTED_TABS = os.getenv('PROTECTED_TABS', '').split(',')

# SQLAlchemy 설정
DATABASE_URL = f"mysql+aiomysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset={DB_CHARSET}"
BASE_DATABASE_URL = f"mysql+aiomysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/?charset={DB_CHARSET}"
engine: AsyncEngine = create_async_engine(DATABASE_URL, echo=True)
base_engine: AsyncEngine = create_async_engine(BASE_DATABASE_URL, echo=True)
SessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,  # 로그 레벨 설정 (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    format="%(asctime)s [%(levelname)s] %(message)s",  # 로그 메시지 포맷
    datefmt="%Y-%m-%d %H:%M:%S",  # 날짜/시간 포맷
)

# 데이터베이스 생성 함수
async def create_database_if_not_exists():
    """데이터베이스가 존재하지 않을 경우 생성"""
    async with base_engine.begin() as conn:
        await conn.execute(text(f"CREATE DATABASE IF NOT EXISTS {DB_NAME} CHARACTER SET {DB_CHARSET}"))
        print(f"Databases '{DB_NAME}' and 'REAGENT' checked or created.")


# 테이블: Places
class Place(Base):
    __tablename__ = 'places'

    PlaceId = Column(Integer, primary_key=True, autoincrement=True)
    PlaceCode = Column(String(50), unique=True, nullable=False)
    PlaceClass = Column(String(50), nullable=False)
    PlaceName = Column(String(100), nullable=True)
    CreatedAt = Column(TIMESTAMP, server_default=func.now())
    UpdatedAt = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # 관계 설정
    devices = relationship('Device', back_populates='place')
    results = relationship('Result', back_populates='place')
    exresults = relationship('ExResult', back_populates='place')

# 테이블: Devices
class Device(Base):
    __tablename__ = 'devices'

    DeviceId = Column(Integer, primary_key=True, autoincrement=True)
    Serial = Column(String(50), unique=True, nullable=False)
    PlaceCode = Column(String(50), ForeignKey('places.PlaceCode', ondelete='SET NULL'), nullable=True)
    StartDate = Column(Date, nullable=True)
    EndDate = Column(Date, nullable=True)
    ReplaceSerial = Column(String(50), nullable=True)
    ReplaceReason = Column(Text, nullable=True)
    Detail = Column(Text, nullable=True)
    IsActive = Column(Boolean, default=True)
    CreatedAt = Column(TIMESTAMP, server_default=func.now())
    UpdatedAt = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # 관계 설정
    place = relationship('Place', back_populates='devices')
    results = relationship('Result', back_populates='device')
    exresults = relationship('ExResult', back_populates='device')

# 테이블: Sticks
class Stick(Base):
    __tablename__ = 'sticks'

    StickLot = Column(String(50), primary_key=True)
    StickExpDate = Column(Date, nullable=False)
    LowMin = Column(Integer, nullable=True)
    LowMax = Column(Integer, nullable=True)
    HighMin = Column(Integer, nullable=True)
    HighMax = Column(Integer, nullable=True)
    CreatedAt = Column(TIMESTAMP, server_default=func.now())
    UpdatedAt = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # 관계 설정
    results = relationship('Result', back_populates='stick')
    exresults = relationship('ExResult', back_populates='stick')

class Signs(Base):
    __tablename__ = 'signs'

    SignId = Column(Integer, primary_key=True, autoincrement=True)
    SignUuid = Column(CHAR(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    SignImg = Column(BLOB)
    CreatedAt = Column(TIMESTAMP, server_default=func.now())
    UpdatedAt = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # Results와 역방향 관계
    results = relationship('Result', back_populates='sign')
    exresults = relationship('ExResult', back_populates='sign')


# 테이블: Results
class Result(Base):
    __tablename__ = 'results'

    ResultId = Column(Integer, primary_key=True, autoincrement=True)
    Serial = Column(String(50), ForeignKey('devices.Serial', ondelete='CASCADE'), nullable=False)
    PlaceCode = Column(String(50), ForeignKey('places.PlaceCode', ondelete='SET NULL'), nullable=True)
    TestDate = Column(Date, nullable=False)
    StickLot = Column(String(50), ForeignKey('sticks.StickLot', ondelete='SET NULL'), nullable=True)
    QcLot = Column(String(50), nullable=True)
    QcExpDate = Column(Date, nullable=True)
    LowResult = Column(Integer, nullable=True)
    HighResult = Column(Integer, nullable=True)
    ResultCheck = Column(String(20), nullable=True)
    DeviceCheck = Column(String(20), nullable=True)
    Comment = Column(Text, nullable=True)
    SignUuid = Column(CHAR(36), ForeignKey('signs.SignUuid', ondelete='SET NULL'))
    PreviousLow = Column(Integer, nullable=True)
    PreviousHigh = Column(Integer, nullable=True)
    PreviousCheck = Column(String(20), nullable=True)
    CreatedAt = Column(TIMESTAMP, server_default=func.now())
    UpdatedAt = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # 관계 설정
    device = relationship('Device', back_populates='results')
    place = relationship('Place', back_populates='results')
    stick = relationship('Stick', back_populates='results')
    sign = relationship('Signs', back_populates='results')

# 테이블: exresults
class ExResult(Base):
    __tablename__ = 'exresults'

    ExResultId = Column(Integer, primary_key=True, autoincrement=True)
    Serial = Column(String(50), ForeignKey('devices.Serial', ondelete='CASCADE'), nullable=False)
    PlaceCode = Column(String(50), ForeignKey('places.PlaceCode', ondelete='SET NULL'), nullable=True)
    TestDate = Column(Date, nullable=False)
    StickLot = Column(String(50), ForeignKey('sticks.StickLot', ondelete='SET NULL'), nullable=True)
    FirstResult = Column(Integer, nullable=True)
    SecondResult = Column(Integer, nullable=True)
    ThirdResult = Column(Integer, nullable=True)
    Comment = Column(Text, nullable=True)
    SignUuid = Column(CHAR(36), ForeignKey('signs.SignUuid', ondelete='SET NULL'))
    CreatedAt = Column(TIMESTAMP, server_default=func.now())
    UpdatedAt = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # 관계 설정
    device = relationship('Device', back_populates='exresults')
    place = relationship('Place', back_populates='exresults')
    stick = relationship('Stick', back_populates='exresults')
    sign = relationship('Signs', back_populates='exresults')

@app.before_serving
async def setup_database():
    """데이터베이스 및 테이블 설정"""
    await create_database_if_not_exists()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Databases initialized.")

@app.route('/test-connection')
async def test_connection():
    """직접 MariaDB 연결을 테스트하는 엔드포인트"""
    try:
        connection = await aiomysql.connect(
            host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASSWORD, db=DB_NAME, charset=DB_CHARSET
        )
        cursor = await connection.cursor()
        await cursor.execute("SELECT DATABASE()")
        database = await cursor.fetchone()
        await cursor.close()
        connection.close()
        return {"message": f"Connected to database: {database[0]}"}, 200
    except Exception as e:
        return {"error": str(e)}, 500
    
@app.route('/')
async def home():
    return await render_template('index.html')

@app.route('/barcode')
async def barcode():
    return await render_template('barcode.html')


@app.route('/processBarcode', methods=['POST'])
async def process_barcode():
    """바코드 처리 및 lot 값 반환"""
    try:
        data = await request.get_json()  # 비동기 방식으로 JSON 데이터 추출
        if data is None:
            return jsonify({"error": "Invalid JSON"}), 400

        barcode = data.get('barcode')
        if not barcode:
            return jsonify({"error": "No barcode provided"}), 400

        # barcode.py의 analyze_barcode 함수 사용
        lot, exp, _ = analyze_barcode(barcode)  # exp 값을 추가로 가져옴
        response_data = {"lot": lot}
        if exp:  # exp 값이 존재하면 응답에 추가
            response_data["exp"] = exp
        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

@app.route('/GetPlaces', methods=['GET'])
async def get_places():
    """PlaceClass, PlaceCode 순으로 정렬된 Place 목록 반환"""
    async with SessionLocal() as session:
        async with session.begin():
            query = select(Place).order_by(
                asc(Place.PlaceClass),  # PlaceClass 기준 오름차순
                asc(Place.PlaceCode)    # PlaceCode 기준 오름차순
            )
            result = await session.execute(query)
            places = result.scalars().all()

            # 데이터를 JSON 형태로 변환
            place_list = [
                {
                    "PlaceId": place.PlaceId,
                    "PlaceCode": place.PlaceCode,
                    "PlaceClass": place.PlaceClass,
                    "PlaceName": place.PlaceName,
                }
                for place in places
            ]
            return jsonify(place_list)

@app.route('/RegisterPlace', methods=['POST'])
async def register_place():
    """장소 등록"""
    data = await request.json

    required_fields = ['PlaceCode', 'PlaceClass', 'PlaceName']
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required fields"}), 400

    async with SessionLocal() as session:
        async with session.begin():
            new_place = Place(
                PlaceCode=data['PlaceCode'],
                PlaceClass=data['PlaceClass'],
                PlaceName=data['PlaceName']
            )
            session.add(new_place)
            await session.commit()

    return jsonify({"message": "Place registered successfully"}), 201

@app.route('/UpdatePlace/<int:place_id>', methods=['PUT'])
async def update_place(place_id):
    """장소 수정"""
    data = await request.json

    async with SessionLocal() as session:
        async with session.begin():
            place = await session.get(Place, place_id)
            if not place:
                return jsonify({"error": "Place not found"}), 404

            place.PlaceCode = data.get('PlaceCode', place.PlaceCode)
            place.PlaceClass = data.get('PlaceClass', place.PlaceClass)
            place.PlaceName = data.get('PlaceName', place.PlaceName)

            await session.commit()

    return jsonify({"message": "Place updated successfully"}), 200

@app.route('/DeletePlace/<int:place_id>', methods=['DELETE'])
async def delete_place(place_id):
    """장소 삭제"""
    async with SessionLocal() as session:
        async with session.begin():
            place = await session.get(Place, place_id)
            if not place:
                return jsonify({"error": "Place not found"}), 404

            await session.delete(place)
            await session.commit()

    return jsonify({"message": "Place deleted successfully"}), 200

@app.route('/GetActiveSerials', methods=['GET'])
async def get_active_serials():
    """
    IsActive가 1이고 PlaceCode가 일치하는 ActiveSerial 목록 반환
    includeTested=false 이고 testDate가 주어지면, 해당 날짜에 이미 결과가 있는 장비는 제외
    """
    place_code = request.args.get('placeCode')
    include_tested = request.args.get('includeTested', 'true').lower() == 'true'
    test_date = request.args.get('testDate')
 # 쿼리 파라미터로 PlaceCode 가져오기
    if not place_code:
        return jsonify([])  

    async with SessionLocal() as session:
        async with session.begin():
            query = select(Device).where(Device.IsActive == True, Device.PlaceCode == place_code).order_by(asc(Device.Serial))
            result = await session.execute(query)
            devices = result.scalars().all()
            if not include_tested and test_date:
                result2 = await session.execute(
                    select(Result.Serial).where(Result.TestDate == test_date)
                )
                tested_serials = {row[0] for row in result2.all()}
                devices = [d for d in devices if d.Serial not in tested_serials]

            serial_list = [{"Serial": device.Serial} for device in devices]
            return jsonify(serial_list)

@app.route('/RegisterDevice', methods=['POST'])
async def register_device():
    """장비 등록"""
    data = await request.json

    # 데이터 유효성 검사
    required_fields = ['PlaceCode', 'Serial', 'StartDate', 'IsActive']
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required fields"}), 400

    async with SessionLocal() as session:
        async with session.begin():
            # ReplaceSerial로 기존 장치 검색 및 업데이트
            if data.get('ReplaceSerial'):
                replace_serial = data['ReplaceSerial']
                device_to_update = await session.execute(
                    select(Device).where(Device.Serial == replace_serial)
                )
                device = device_to_update.scalar_one_or_none()
                if device:
                    # 기존 장비 업데이트
                    device.EndDate = data['StartDate']  # 신규 장치 시작일을 기존 장치 종료일로 설정
                    device.ReplaceSerial = data['Serial']  # 신규 장비의 시리얼을 기존 장비의 ReplaceSerial에 저장
                    device.ReplaceReason = data.get('ReplaceReason')  # 교체 사유 저장
                    device.IsActive = False  # 기존 장비 비활성화
                    session.add(device)

            # 신규 장비 등록
            new_device = Device(
                PlaceCode=data['PlaceCode'],
                Serial=data['Serial'],
                StartDate=data['StartDate'],
                EndDate=None,
                ReplaceSerial=None,  # 신규 장비의 ReplaceSerial 초기화
                Detail=data.get('Detail'),
                IsActive=data['IsActive']
            )
            session.add(new_device)

            # 변경 사항 커밋
            await session.commit()

    return jsonify({"message": "Device registered successfully"}), 201

@app.route('/DeviceList', methods=['GET'])
async def device_list():
    """IsActive가 1인 데이터를 우선 정렬하고, PlaceCode, StartDate 순으로 추가 정렬"""
    async with SessionLocal() as session:
        async with session.begin():
            query = (
                select(Device, Place.PlaceName)  # PlaceName으로 변경
                .outerjoin(Place, Device.PlaceCode == Place.PlaceCode)  # 조인 수정
                .order_by(
                    asc(Device.EndDate),
                    desc(Device.IsActive),  # IsActive가 1인 데이터를 우선
                    asc(Device.PlaceCode),  # PlaceCode 기준 오름차순
                    asc(Device.StartDate)  # StartDate 기준 오름차순
                )
            )
            result = await session.execute(query)
            devices = result.fetchall()  # fetchall로 결과 가져오기

            # 데이터를 JSON 형태로 변환
            device_list = [
                {
                    "DeviceId": row.Device.DeviceId,
                    "PlaceCode": row.Device.PlaceCode,
                    "PlaceName": row.PlaceName,  # PlaceName 추가
                    "Serial": row.Device.Serial,
                    "StartDate": row.Device.StartDate.isoformat() if row.Device.StartDate else None,
                    "EndDate": row.Device.EndDate.isoformat() if row.Device.EndDate else None,
                    "ReplaceSerial": row.Device.ReplaceSerial,
                    "ReplaceReason": row.Device.ReplaceReason,
                    "Detail": row.Device.Detail,
                    "IsActive": row.Device.IsActive
                }
                for row in devices
            ]
            return jsonify(device_list), 200



@app.route('/DeviceDetail/<int:device_id>', methods=['GET'])
async def get_device_detail(device_id):
    """장비 상세 정보 가져오기"""
    async with SessionLocal() as session:
        async with session.begin():
            device = await session.get(Device, device_id)
            if not device:
                return {"error": "Device not found"}, 404

            return jsonify({
                "DeviceId": device.DeviceId,
                "PlaceCode": device.PlaceCode,
                "Serial": device.Serial,
                "StartDate": device.StartDate.isoformat() if device.StartDate else None,
                "EndDate": device.EndDate.isoformat() if device.EndDate else None,
                "ReplaceSerial": device.ReplaceSerial,
                "ReplaceReason": device.ReplaceReason,
                "Detail": device.Detail,
                "IsActive": device.IsActive
            })

@app.route('/UpdateDevice', methods=['POST'])
async def update_device():
    """장비 정보 업데이트"""
    data = await request.json
    async with SessionLocal() as session:
        async with session.begin():
            device = await session.get(Device, data['DeviceId'])
            if not device:
                return {"error": "Device not found"}, 404

            # 업데이트 데이터 반영
            device.PlaceCode = data.get('PlaceCode')
            device.Serial = data.get('Serial')
            device.StartDate = data.get('StartDate')
            device.EndDate = data.get('EndDate') if data.get('EndDate') else None
            device.ReplaceSerial = data.get('ReplaceSerial') if data.get('ReplaceSerial') else None
            device.ReplaceReason = data.get('ReplaceReason') if data.get('ReplaceReason') else None  # 교체사유 추가
            device.Detail = data.get('Detail') if data.get('Detail') else None
            device.IsActive = data.get('IsActive')

            await session.commit()
            return {"message": "Device updated successfully"}, 200

@app.route('/DeleteDevice/<int:device_id>', methods=['DELETE'])
async def delete_device(device_id):
    """장비 정보 삭제"""
    async with SessionLocal() as session:
        async with session.begin():
            device = await session.get(Device, device_id)
            if not device:
                return {"error": "Device not found"}, 404

            await session.delete(device)
            await session.commit()

            return {"message": "Device deleted successfully"}, 200

@app.route('/RegisterStick', methods=['POST'])
async def register_stick():
    """Stick 등록"""
    data = await request.json

    # 데이터 유효성 검사
    required_fields = ['StickLot', 'StickExpDate']
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required fields"}), 400

    async with SessionLocal() as session:
        async with session.begin():
            # 데이터베이스에 Stick 추가
            new_stick = Stick(
                StickLot=data['StickLot'],
                StickExpDate=data['StickExpDate'],
                LowMin=data.get('LowMin'),
                LowMax=data.get('LowMax'),
                HighMin=data.get('HighMin'),
                HighMax=data.get('HighMax')
            )
            session.add(new_stick)
            await session.commit()

    return jsonify({"message": "Stick registered successfully"}), 201

# Stick 목록 가져오기 API
@app.route('/GetSticks', methods=['GET'])
async def get_sticks():
    """Stick 목록 반환"""
    async with SessionLocal() as session:
        async with session.begin():
            query = select(Stick).order_by(asc(Stick.StickLot))  # StickLot 기준 오름차순
            result = await session.execute(query)
            sticks = result.scalars().all()

            # JSON 형태로 반환
            stick_list = [
                {
                    "StickLot": stick.StickLot,
                    "StickExpDate": stick.StickExpDate.isoformat() if stick.StickExpDate else None,
                    "LowMin": stick.LowMin,
                    "LowMax": stick.LowMax,
                    "HighMin": stick.HighMin,
                    "HighMax": stick.HighMax
                }
                for stick in sticks
            ]
            return jsonify(stick_list), 200


# Stick 상세 정보 가져오기 API
@app.route('/GetStickDetail/<string:stick_lot>', methods=['GET'])
async def get_stick_detail(stick_lot):
    """Stick 상세 정보 반환"""
    async with SessionLocal() as session:
        async with session.begin():
            stick = await session.get(Stick, stick_lot)
            if not stick:
                return jsonify({"error": "Stick not found"}), 404

            # JSON 형태로 반환
            stick_detail = {
                "StickLot": stick.StickLot,
                "StickExpDate": stick.StickExpDate.isoformat(),
                "LowMin": stick.LowMin,
                "LowMax": stick.LowMax,
                "HighMin": stick.HighMin,
                "HighMax": stick.HighMax
            }
            return jsonify(stick_detail), 200


# Stick 수정 API
@app.route('/UpdateStick', methods=['POST'])
async def update_stick():
    """Stick 정보 수정"""
    data = await request.json

    # StickLot은 필수
    if 'StickLot' not in data:
        return jsonify({"error": "StickLot is required"}), 400

    async with SessionLocal() as session:
        async with session.begin():
            stick = await session.get(Stick, data['StickLot'])
            if not stick:
                return jsonify({"error": "Stick not found"}), 404

            # 업데이트 데이터 반영
            stick.StickExpDate = data.get('StickExpDate', stick.StickExpDate)
            stick.LowMin = data.get('LowMin', stick.LowMin)
            stick.LowMax = data.get('LowMax', stick.LowMax)
            stick.HighMin = data.get('HighMin', stick.HighMin)
            stick.HighMax = data.get('HighMax', stick.HighMax)

            await session.commit()

            return jsonify({"message": "Stick updated successfully"}), 200


# Stick 삭제 API
@app.route('/DeleteStick/<string:stick_lot>', methods=['DELETE'])
async def delete_stick(stick_lot):
    """Stick 정보 삭제"""
    async with SessionLocal() as session:
        async with session.begin():
            stick = await session.get(Stick, stick_lot)
            if not stick:
                return jsonify({"error": "Stick not found"}), 404

            await session.delete(stick)
            await session.commit()

            return jsonify({"message": "Stick deleted successfully"}), 200

@app.route('/saveSign', methods=['POST'])
async def save_sign():
    try:
        data = await request.json
        image = data.get("image")
        if not image:
            return jsonify({"error": "Image is required"}), 400

        # Base64 데이터 확인 및 디코딩
        if "," in image:
            base64_data = image.split(",")[1]
        else:
            return jsonify({"error": "Invalid image format"}), 400

        try:
            image_bytes = base64.b64decode(base64_data)
        except Exception as e:
            return jsonify({"error": f"Base64 decoding error: {str(e)}"}), 400

        # 데이터베이스 저장
        async with SessionLocal() as session:
            async with session.begin():  # 트랜잭션 시작
                new_sign = Signs(SignImg=image_bytes)
                session.add(new_sign)
                await session.flush()  # 여기서 PK를 가져올 수 있음
                sign_uuid = new_sign.SignUuid  # UUID 가져오기

        # 트랜잭션이 종료된 후에도 반환 값 사용 가능
        return jsonify({"signUuid": sign_uuid}), 201

    except Exception as e:
        logging.error(f"saveSign: Unexpected error: {traceback.format_exc()}")
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

@app.route('/GetQcReagent', methods=['GET'])
async def get_qc_reagent():
    """
    JSON 파일에서 QC Lot와 유효기간만 반환
    """
    try:
        # JSON 파일 경로 설정
        json_file_path = os.path.join(os.getcwd(), 'qc_reagents.json')

        # JSON 파일 존재 여부 확인
        if not os.path.exists(json_file_path):
            logging.error("qc_reagents.json 파일이 존재하지 않습니다.")
            return jsonify({"error": "QC reagent file not found"}), 404

        # JSON 파일 읽기
        with open(json_file_path, 'r', encoding='utf-8') as file:
            try:
                reagents = json.load(file)
            except json.JSONDecodeError as e:
                logging.error(f"JSON 파싱 오류: {str(e)}")
                return jsonify({"error": "Failed to parse JSON file"}), 500

        # 첫 번째 항목만 반환
        reagent = reagents[0] if reagents else None

        if not reagent:
            logging.info("조건에 맞는 QC reagent가 없습니다.")
            return jsonify({"error": "No reagent found"}), 404

        # JSON 형태로 데이터 반환
        return jsonify({
            "lot": reagent.get("lot"),
            "exp_date": reagent.get("exp_date")
        }), 200

    except Exception as e:
        logging.error(f"예상치 못한 오류 발생: {traceback.format_exc()}")
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

@app.route('/GetTodayExResultsCount', methods=['GET'])
async def get_today_ex_results_count():
    """
    오늘 날짜의 외부정도관리 결과 개수를 반환하는 API
    """
    try:
        today_date = datetime.today().date()  # 오늘 날짜 가져오기

        async with SessionLocal() as session:
            async with session.begin():
                # 오늘 날짜에 해당하는 ExResult 개수 조회
                query = select(func.count()).where(ExResult.TestDate == today_date)
                result = await session.execute(query)
                count = result.scalar()  # 개수 가져오기

        return jsonify({"today_ex_results_count": count}), 200

    except Exception as e:
        logging.error(f"❌ GetTodayExResultsCount 오류 발생: {traceback.format_exc()}")
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

@app.route('/saveExResults', methods=['POST'])
async def save_ex_results():
    """
    ExResults 데이터를 저장하는 엔드포인트
    - 여러 결과 데이터를 저장합니다.
    """
    try:
        # 클라이언트로부터 데이터 수신
        data = await request.json
        ex_results = data.get('results', [])

        if not ex_results:
            return jsonify({"error": "No results provided"}), 400

        async with SessionLocal() as session:
            async with session.begin():
                for result_data in ex_results:
                    # 데이터 유효성 검사
                    if not all([
                        result_data.get('Serial'),
                        result_data.get('StickLot'),
                        result_data.get('TestDate')
                    ]):
                        logging.error(f"🚨 데이터 누락 오류: {result_data}")
                        return jsonify({"error": "Missing required fields"}), 400

                    # ExResult 객체 생성 및 데이터 매핑
                    new_result = ExResult(
                        Serial=result_data.get('Serial'),
                        PlaceCode=result_data.get('PlaceCode'),
                        TestDate=result_data.get('TestDate'),
                        StickLot=result_data.get('StickLot'),
                        FirstResult=result_data.get('FirstResult'),
                        SecondResult=result_data.get('SecondResult'),
                        ThirdResult=result_data.get('ThirdResult'),
                        Comment=result_data.get('Comment'),
                        SignUuid=result_data.get('SignUuid'),
                    )

                    # 데이터베이스에 추가
                    session.add(new_result)
                    await session.flush()  # 데이터가 정상적으로 INSERT 되는지 확인

                    logging.info(f"✅ ExResult 저장됨: {new_result}")

                # 모든 데이터 커밋
                await session.commit()

        return jsonify({"message": "ExResults saved successfully"}), 201

    except Exception as e:
        logging.error(f"❌ saveExResults 오류 발생: {traceback.format_exc()}")
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500


@app.route('/saveResults', methods=['POST'])
async def save_results():
    """
    결과를 저장하는 엔드포인트
    - 서명 UUID와 함께 여러 결과 데이터를 저장합니다.
    """
    try:
        # 클라이언트로부터 데이터 수신
        data = await request.json
        results = data.get('results', [])

        if not results:
            return jsonify({"error": "No results provided"}), 400

        async with SessionLocal() as session:
            async with session.begin():
                for result_data in results:
                    # Result 객체 생성 및 데이터 매핑
                    new_result = Result(
                        Serial=result_data.get('Serial'),
                        PlaceCode=result_data.get('PlaceCode'),
                        TestDate=result_data.get('TestDate'),
                        StickLot=result_data.get('StickLot'),
                        QcLot=result_data.get('QcLot'),
                        QcExpDate=result_data.get('QcExpDate'),
                        LowResult=result_data.get('LowResult'),
                        HighResult=result_data.get('HighResult'),
                        ResultCheck=result_data.get('ResultCheck'),
                        DeviceCheck=result_data.get('DeviceCheck'),
                        Comment=result_data.get('Comment'),
                        SignUuid=result_data.get('SignUuid'),
                    )

                    # 데이터베이스에 추가
                    session.add(new_result)

                # 모든 데이터 커밋
                await session.commit()

        return jsonify({"message": "Results saved successfully"}), 201

    except Exception as e:
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

@app.route('/GetResultsByDate', methods=['GET'])
async def get_results_by_date():
    """
    선택된 날짜의 결과 데이터를 반환
    - 서명 이미지를 포함합니다.
    """
    try:
        # 쿼리 파라미터로 날짜 가져오기
        test_date = request.args.get('testDate')
        if not test_date:
            return jsonify({"error": "TestDate is required"}), 400

        async with SessionLocal() as session:
            async with session.begin():
                # `results`와 `signs` 테이블 조인
                query = (
                    select(Result, Signs.SignImg)
                    .outerjoin(Signs, Result.SignUuid == Signs.SignUuid)
                    .where(Result.TestDate == test_date)
                    .order_by(Result.Serial)  # Serial 기준 정렬
                )
                result = await session.execute(query)
                results = result.fetchall()

                # 데이터를 JSON 형태로 변환
                result_list = [
                    {
                        "ResultId": row.Result.ResultId,
                        "Serial": row.Result.Serial,
                        "PlaceCode": row.Result.PlaceCode,
                        "TestDate": row.Result.TestDate.isoformat(),
                        "StickLot": row.Result.StickLot,
                        "QcLot": row.Result.QcLot,
                        "QcExpDate": row.Result.QcExpDate.isoformat() if row.Result.QcExpDate else None,
                        "LowResult": row.Result.LowResult,
                        "HighResult": row.Result.HighResult,
                        "ResultCheck": row.Result.ResultCheck,
                        "DeviceCheck": row.Result.DeviceCheck,
                        "Comment": row.Result.Comment,
                        "SignImg": base64.b64encode(row.SignImg).decode('utf-8') if row.SignImg else None,
                    }
                    for row in results
                ]

                return jsonify(result_list), 200

    except Exception as e:
        logging.error(f"Error fetching results: {str(e)}")
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

@app.route('/GetResultDetail/<int:result_id>', methods=['GET'])
async def get_result_detail(result_id):
    """
    특정 결과 데이터를 가져오는 API
    """
    async with SessionLocal() as session:
        async with session.begin():
            # 결과 조회
            result = await session.get(Result, result_id)
            if not result:
                return jsonify({"error": "Result not found"}), 404

            # 서명 이미지도 포함하여 반환
            sign_img = None
            if result.SignUuid:
                sign = await session.execute(
                    select(Signs.SignImg).where(Signs.SignUuid == result.SignUuid)
                )
                sign_img = sign.scalar()

            # JSON 형태로 반환
            return jsonify({
                "ResultId": result.ResultId,
                "Serial": result.Serial,
                "TestDate": result.TestDate.isoformat() if result.TestDate else None,
                "QcLot": result.QcLot,
                "QcExpDate": result.QcExpDate.isoformat() if result.QcExpDate else None,
                "LowResult": result.LowResult,
                "HighResult": result.HighResult,
                "ResultCheck": result.ResultCheck,
                "DeviceCheck": result.DeviceCheck,
                "Comment": result.Comment,
                "SignImg": base64.b64encode(sign_img).decode('utf-8') if sign_img else None,
            }), 200


@app.route('/UpdateResult', methods=['POST'])
async def update_result():
    data = await request.json

    async with SessionLocal() as session:
        async with session.begin():
            result = await session.get(Result, data['ResultId'])
            if not result:
                return jsonify({"error": "Result not found"}), 404

            result.TestDate = data.get('TestDate')
            result.LowResult = data.get('LowResult')
            result.HighResult = data.get('HighResult')
            result.ResultCheck = data.get('ResultCheck')
            result.DeviceCheck = data.get('DeviceCheck')
            result.Comment = data.get('Comment')

            await session.commit()

    return jsonify({"message": "Result updated successfully"}), 200
@app.route('/DeleteResult/<int:result_id>', methods=['DELETE'])
async def delete_result(result_id):
    async with SessionLocal() as session:
        async with session.begin():
            result = await session.get(Result, result_id)
            if not result:
                return jsonify({"error": "Result not found"}), 404

            await session.delete(result)
            await session.commit()

    return jsonify({"message": "Result deleted successfully"}), 200

@app.route('/DeleteUnusedSigns', methods=['DELETE'])
async def delete_unused_signs():
    """
    Deletes unused signs from the database where they are not referenced in the results or exresults table.
    """
    try:
        async with SessionLocal() as session:
            async with session.begin():
                # Query to find unused SignUuids (not used in results or exresults)
                unused_signs_query = (
                    select(Signs.SignUuid)
                    .outerjoin(Result, Signs.SignUuid == Result.SignUuid)
                    .outerjoin(ExResult, Signs.SignUuid == ExResult.SignUuid)
                    .where(and_(Result.SignUuid == None, ExResult.SignUuid == None))
                )

                # Delete unused signs
                delete_query = delete(Signs).where(Signs.SignUuid.in_(unused_signs_query))
                await session.execute(delete_query)
                await session.commit()

        return jsonify({"message": "Unused signs deleted successfully."}), 200
    except Exception as e:
        logging.error(f"Error deleting unused signs: {traceback.format_exc()}")
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

@app.route('/generateReport', methods=['POST'])
async def generate_report():
    """
    지정된 기간 동안 results 데이터를 조회하고,
    PlaceName, 서명 이미지(SignImg), 요약(summary)를 포함하여 보고서를 반환하는 엔드포인트
    """
    try:
        # 클라이언트로부터 요청 데이터 가져오기
        data = await request.json
        start_date = data.get('startDate')
        end_date = data.get('endDate')

        # 날짜 유효성 확인
        if not start_date or not end_date:
            return jsonify({"error": "startDate and endDate are required"}), 400

        try:
            # 문자열을 datetime 형식으로 변환
            start_date = datetime.strptime(start_date, '%Y-%m-%d')
            end_date = datetime.strptime(end_date, '%Y-%m-%d')
        except ValueError:
            return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

        async with SessionLocal() as session:
            async with session.begin():
                # results, signs, places 테이블 조인하여 데이터 조회
                query = (
                    select(Result, Signs.SignImg, Place.PlaceName, Stick)
                    .outerjoin(Signs, Result.SignUuid == Signs.SignUuid)
                    .outerjoin(Place, Result.PlaceCode == Place.PlaceCode)
                    .outerjoin(Stick, Result.StickLot == Stick.StickLot)
                    .where(
                        and_(
                            Result.TestDate >= start_date,
                            Result.TestDate <= end_date
                        )
                    )
                    .order_by(Result.TestDate, Result.PlaceCode, Result.Serial)
                )
                result = await session.execute(query)
                results = result.fetchall()

                # 등록된 기기 및 교체된 기기 집계
                device_query = (
                    select(
                        func.count(Device.DeviceId).label("total_registered")
                    )
                    .where(
                        or_(
                            and_(Device.StartDate >= start_date, Device.StartDate <= end_date)
                        )
                    )
                )
                device_result = await session.execute(device_query)
                device_summary = device_result.fetchone()
                # 교체된 기기 집계
                replacementDevice_query = (
                    select(func.count(Device.ReplaceSerial).label("total_replaced"))
                    .where(
                        and_(
                            Device.ReplaceReason.isnot(None),
                            Device.EndDate >= start_date,
                            Device.EndDate <= end_date
                        )
                    )
                )
                replacementDevice_result = await session.execute(replacementDevice_query)
                replacementDevice_summary = replacementDevice_result.fetchone()
                # 교체 사유 수집
                replacement_query = (
                    select(Device.ReplaceReason)
                    .where(
                        and_(
                            Device.ReplaceReason.isnot(None),
                            Device.EndDate >= start_date,
                            Device.EndDate <= end_date
                        )
                    )
                )
                replacement_result = await session.execute(replacement_query)
                replacement_reasons = [row.ReplaceReason for row in replacement_result.fetchall()]

                # 데이터를 JSON 형태로 변환
                report_data = [
                    {
                        "ResultId": row.Result.ResultId,
                        "Serial": row.Result.Serial,
                        "PlaceCode": row.Result.PlaceCode,
                        "PlaceName": row.PlaceName,  # PlaceName 추가
                        "TestDate": row.Result.TestDate.isoformat(),
                        "StickLot": row.Result.StickLot,
                        "LowMin": getattr(row.Stick, 'LowMin', None),  # None 처리
                        "LowMax": getattr(row.Stick, 'LowMax', None),  # None 처리
                        "HighMin": getattr(row.Stick, 'HighMin', None),  # None 처리
                        "HighMax": getattr(row.Stick, 'HighMax', None),  # None 처리
                        "QcLot": row.Result.QcLot,
                        "QcExpDate": row.Result.QcExpDate.isoformat() if row.Result.QcExpDate else None,
                        "LowResult": row.Result.LowResult,
                        "HighResult": row.Result.HighResult,
                        "ResultCheck": row.Result.ResultCheck,
                        "DeviceCheck": row.Result.DeviceCheck,
                        "Comment": row.Result.Comment,
                        "CreatedAt": row.Result.CreatedAt.isoformat(),
                        "UpdatedAt": row.Result.UpdatedAt.isoformat(),
                        "SignImg": base64.b64encode(row.SignImg).decode('utf-8') if row.SignImg else None,  # 서명 이미지
                    }
                    for row in results
                ]

                # 요약 데이터 생성
                summary = {
                    "total_registered_devices": device_summary.total_registered,
                    "total_replaced_devices": replacementDevice_summary.total_replaced,
                    "replacement_reasons": replacement_reasons,
                }

        return jsonify({"data": report_data, "summary": summary}), 200

    except Exception as e:
        logging.error(f"Error generating report: {str(e)}")
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

@app.route('/UpdateQcReagent', methods=['POST'])
async def update_qc_reagent():
    """
    QC 시약 정보를 QC Lot와 유효기간만 유지하며 수정 또는 생성
    """
    try:
        # JSON 데이터 수신
        data = await request.json
        lot = data.get('lot')
        exp_date = data.get('exp_date')

        if not lot or not exp_date:
            return jsonify({"error": "'lot'과 'exp_date'는 필수 항목입니다."}), 400

        # JSON 파일 경로
        json_file_path = os.path.join(os.getcwd(), 'qc_reagents.json')

        # 파일 읽기
        if os.path.exists(json_file_path):
            with open(json_file_path, 'r', encoding='utf-8') as file:
                try:
                    reagents = json.load(file)
                except json.JSONDecodeError as e:
                    logging.error(f"JSON 파싱 오류: {str(e)}")
                    return jsonify({"error": "JSON 파일을 읽을 수 없습니다."}), 500
        else:
            reagents = []

        # 기존 QC Reagent 확인 및 수정
        if reagents:
            # 첫 번째 항목만 수정 (단일 항목 유지)
            reagent = reagents[0]
            reagent['lot'] = lot
            reagent['exp_date'] = exp_date
            message = "QC Reagent 정보가 수정되었습니다."
        else:
            # 항목이 없으면 새로 추가
            reagents.append({
                "lot": lot,
                "exp_date": exp_date
            })
            message = "QC Reagent 정보가 등록되었습니다."

        # JSON 파일 다시 저장
        with open(json_file_path, 'w', encoding='utf-8') as file:
            json.dump(reagents, file, indent=4, ensure_ascii=False)

        return jsonify({"message": message}), 200

    except Exception as e:
        logging.error(f"QC Reagent 업데이트 중 오류 발생: {traceback.format_exc()}")
        return jsonify({"error": f"예상치 못한 오류: {str(e)}"}), 500
@app.route('/protected-tabs', methods=['GET'])
async def protected_tabs():
    """보호된 탭 ID 목록 반환 API"""
    return jsonify({"protected_tabs": PROTECTED_TABS})
    
@app.route('/verify-password', methods=['POST'])
async def verify_password():
    """암호 확인 API"""
    data = await request.get_json()
    password = data.get('password')

    if password == ACCESS_PASSWORD:
        return jsonify({"verified": True}), 200
    else:
        return jsonify({"verified": False, "message": "Invalid password"}), 401
        
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('APP_PORT', 5012)))
