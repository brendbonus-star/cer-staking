from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import base64
from pytoniq import Cell, Address, begin_cell

app = Flask(__name__)
CORS(app)

STAKING_ADDRESS = "EQBLEMocvp-FS-jfhEKAQ2261_ZwJRvUKmaHHhZXIizLJQvs"
JETTON_MASTER = "EQCeFJOkajBxztRloikZ9iUHhqnymZoX3pgxY47bbVlQuA3G"

# --- Функция для получения адреса Jetton-кошелька отправителя ---
# Это то, чего не хватало в моем прошлом коде!
def get_sender_jetton_wallet(user_address):
    url = f"https://tonapi.io/v2/accounts/{user_address}/jettons?jetton_master={JETTON_MASTER}"
    try:
        response = requests.get(url, timeout=10)
        data = response.json()
        # Находим баланс и адрес кошелька для токена CER
        if data and data.get("balances") and len(data["balances"]) > 0:
            return data["balances"][0]["wallet_address"]["address"]
    except Exception as e:
        print(f"Error: {e}")
    return None

# --- Функция для получения баланса пула (уже работала) ---
def get_reward_pool():
    try:
        url = f"https://tonapi.io/v2/accounts/{STAKING_ADDRESS}/jettons"
        response = requests.get(url, timeout=10)
        data = response.json()
        if data and data.get("balances"):
            for jetton in data["balances"]:
                if jetton.get("jetton", {}).get("symbol") == "CER":
                    balance = int(jetton.get("balance", 0))
                    return balance / 1e9
        return 0
    except Exception as e:
        return 0

# --- Функция для создания правильного тела Jetton-перевода ---
def create_jetton_transfer_body(user_address, amount_cer, days):
    # 1. Переводим сумму CER в нано-единицы
    amount_nano = int(amount_cer * 1e9)

    # 2. Получаем адрес Jetton-кошелька, с которого будут отправляться токены
    sender_jetton_wallet = get_sender_jetton_wallet(user_address)
    if not sender_jetton_wallet:
        raise Exception("Не удалось найти ваш Jetton-кошелек для CER")
    print(f"Sender jetton wallet: {sender_jetton_wallet}")

    # 3. Создаем forwardPayload для комментария (срок стейкинга)
    forward_payload = begin_cell()
    forward_payload.store_uint(0, 32)          # 0 opcode для комментария
    forward_payload.store_string(f"{days}")   # Записываем срок (30, 90, 180, 365)
    forward_payload_cell = forward_payload.end_cell()

    # 4. Создаем тело Jetton Transfer с правильным opcode (0xf8a7ea5)[citation:1][citation:4][citation:6]
    body = begin_cell()
    body.store_uint(0xf8a7ea5, 32)            # opcode jetton_transfer
    body.store_uint(0, 64)                    # query_id (0)
    body.store_coins(amount_nano)             # Сумма CER для перевода
    body.store_address(Address(STAKING_ADDRESS))   # Кому (контракт стейкинга)
    body.store_address(Address(user_address))      # Адрес для возврата (ваш кошелек)
    body.store_bit(0)                         # custom_payload (отсутствует)
    body.store_coins(100000000)               # forward_ton_amount (0.1 TON для газа)
    body.store_bit(1)                         # forward_payload присутствует
    body.store_ref(forward_payload_cell)      # Прикрепляем комментарий с сроком

    # 5. Возвращаем сформированную транзакцию
    return {
        "address": sender_jetton_wallet,          # Отправляем на Jetton-кошелек отправителя!
        "amount": "100000000",                    # 0.1 TON для комиссии (излишек вернется)
        "payload": body.end_cell().to_boc().hex()
    }

# --- Эндпоинт для Mini App (возвращает пул) ---
@app.route('/reward_pool', methods=['GET'])
def reward_pool():
    pool = get_reward_pool()
    return jsonify({"rewardPool": pool})

# --- Эндпоинт для кнопки "Стейкать" ---
@app.route('/stake', methods=['POST'])
def stake():
    data = request.json
    user_address = data.get('user')
    amount = float(data.get('amount'))
    days = data.get('days')
    
    if not user_address or not amount or not days:
        return jsonify({"error": "Missing parameters"}), 400
    
    try:
        # Формируем транзакцию прямо на сервере
        tx = create_jetton_transfer_body(user_address, amount, days)
        return jsonify({"transaction": tx})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
