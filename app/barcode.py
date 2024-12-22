import calendar
FNC1 = " "
DATE_LENGTH = 6

def preprocess_barcode(barcode_receive):
    """바코드에서 '(10', '(24', '(21' 패턴 이후의 '('를 ' '로 변환하고, 괄호 제거."""
    if barcode_receive[0] == '' or barcode_receive[0] != '0':
        print(barcode_receive)
        barcode_receive = barcode_receive[1:]
        # if barcode_receive[0] == '' or barcode_receive[0] != '0':
        #     barcode_receive = barcode_receive[1:]
        #     print(barcode_receive)
    replacements = ['(10', '(24', '(21']
    barcode_receive = barcode_receive.replace('',' ')
    for r in replacements:
        if r in barcode_receive:
            barcode_receive = barcode_receive.replace(r, " " + r[1:])  # '('만 ' '로 변환하고 숫자는 유지

            # 패턴 다음에 첫 번째 '('을 ' '로 변환
            next_open_paren = barcode_receive.find('(', barcode_receive.find(" ") + 1)
            if next_open_paren != -1:
                barcode_receive = barcode_receive[:next_open_paren] + ' ' + barcode_receive[next_open_paren + 1:]

    # 남아 있는 '(' 및 ')' 제거
    return barcode_receive.replace('(', '').replace(')', '')

def parse_section(barcode, start):
    """구분자(FNC1)까지의 문자열을 추출하는 함수"""
    fnc = barcode.find(FNC1, start)
    if fnc == -1:
        return barcode[start:], None, len(barcode)
    return barcode[start:fnc], barcode[fnc + 1:fnc + 3], fnc + 3

def handle_date_field(start, barcode):
    """날짜 필드를 처리하는 함수"""
    field_value = barcode[start:start + DATE_LENGTH]
    if barcode[start + DATE_LENGTH:start + DATE_LENGTH + 1] == ' ':
        next_code = barcode[start + DATE_LENGTH + 1:start + DATE_LENGTH + 3]
        start += DATE_LENGTH + 3
    else:
        next_code = barcode[start + DATE_LENGTH:start + DATE_LENGTH + 2]
        start += DATE_LENGTH + 2
    return field_value, next_code, start

def process_next_code(next_code, barcode, start, lot, exp, ref, serial):
    """다음 코드에 따라 적절한 필드를 처리"""
    if next_code == '10':  # Lot 처리
        lot, next_code, start = parse_section(barcode, start)
        print("Lot:", lot)
    elif next_code == '17':  # 만료일(Expiry Date) 처리
        exp, next_code, start = handle_date_field(start, barcode)
        print("Exp.Date:", exp)
    elif next_code == '11':  # 생산일(Production Date) 처리
        pd, next_code, start = handle_date_field(start, barcode)
        print("Pd.Date:", pd)
    elif next_code == '24':  # 참조 번호(Reference) 처리
        ref, next_code, start = parse_section(barcode, start + 1)
        print("Ref:", ref)
    elif next_code == '21':  # 시리얼 번호(Serial Number) 처리
        serial, next_code, start = parse_section(barcode, start)
        print("Serial:", serial)
    elif next_code == '91':  # 시리얼 번호(Serial Number)2 처리
        serial, next_code, start = parse_section(barcode, start)
        print("Serial:", serial)

    else:
        # 알 수 없는 코드인 경우 루프를 종료
        print("Unknown next_code:", next_code)
        next_code = None
    
    # start 값 유효성 검사
    if start > len(barcode):
        print("Error: start index out of range")
        next_code = None
    
    return lot, exp, ref, serial, next_code, start

def analyze_barcode(prebarcode):
    """바코드를 처리하는 함수"""
    barcode = preprocess_barcode(prebarcode)
    print(f"Preprocessed barcode: {barcode}")
    
    if not barcode.startswith('01'):
        print("Error: Invalid barcode")
        return "Invalid barcode"
    
    gtin = barcode[2:16]  # GTIN 추출
    lot, exp, ref, serial = 'none', 'none', 'other', 'none'
    
    # 다음 코드 추출
    if barcode[16:17] == ' ':
        next_code = barcode[17:19]
        start = 19
    else:
        next_code = barcode[16:18]
        start = 18

    while next_code:
        lot, exp, ref, serial, next_code, start = process_next_code(next_code, barcode, start, lot, exp, ref, serial)
        if start >= len(barcode):  # start 값이 초과할 경우 루프 종료
            print("End of barcode reached")
            break
    # 만료일의 마지막 두 자리가 '00'인 경우 말일로 처리
    if exp[4:6] == "00":
        year = int("20" + exp[:2])
        month = int(exp[2:4]) or 1  # 월이 '00'일 경우 1월로 처리
        day = calendar.monthrange(year, month)[1]  # 해당 월의 마지막 날
        exp = exp[:4] + str(day)

    print(f"GTIN: {gtin}, Lot: {lot}, Exp.Date: {exp}, REF: {ref}, Serial: {serial}")
    
    if lot == 'none':  # Lot 정보가 없을 경우 시리얼 정보 사용
        lot = serial
    print(lot,exp,gtin)
    return lot, exp, gtin

# 테스트용 예제 바코드 입력
barcode_example = "010880671200381821F132348N0600"
# analyze_barcode(barcode_example)