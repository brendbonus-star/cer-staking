from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import base64
from ton import Cell, Address, begin_cell

app = Flask(__name__)
CORS(app)  # разрешаем запросы с любых доменов

STAKING_ADDRESS = "EQBLEMocvp-FS-jfhEKAQ2261_ZwJRvUKmaHHhZXIizLJQvs"
JETTON_MASTER = "EQCeFJOkajBxztRloikZ9iUHhqnymZoX3pgxY47bbVlQuA3G"

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

def get_jetton_wallet(user_address):
    url = f"https://tonapi.io/v2/accounts/{user_address}/jettons?jetton_master={JETTON_MASTER}"
    try:
        response = requests.get(url, timeout=10)
        data = response.json()
        if data and data.get("balances") and len(data["balances"]) > 0:
            return data["balances"][0]["wallet_address"]["address"]
    except Exception as e:
        print(f"Error: {e}")
    return None

def create_jetton_transfer_body(user_address, jetton_wallet, amount_cer, days):
    amount_nano = int(amount_cer * 1e9)
    forward_ton_amount = 100000000  # 0.1 TON для газа
    
    forward_payload = begin_cell()
    forward_payload.store_uint(0, 32)
    forward_payload.store_string(f"{days}")
    forward_payload_cell = forward_payload.end_cell()
    
    body = begin_cell()
    body.store_uint(0xf8a7ea5, 32)
    body.store_uint(0, 64)
    body.store_coins(amount_nano)
    body.store_address(Address(STAKING_ADDRESS))
    body.store_address(Address(user_address))
    body.store_bit(0)
    body.store_coins(forward_ton_amount)
    body.store_bit(1)
    body.store_ref(forward_payload_cell)
    
    return body.end_cell().to_boc().hex()

@app.route('/reward_pool', methods=['GET'])
def reward_pool():
    pool = get_reward_pool()
    return jsonify({"rewardPool": pool})

@app.route('/stake', methods=['POST'])
def stake():
    data = request.json
    user_address = data.get('user')
    amount = float(data.get('amount'))
    days = data.get('days')
    
    if not user_address or not amount or not days:
        return jsonify({"error": "Missing parameters"}), 400
    
    jetton_wallet = get_jetton_wallet(user_address)
    if not jetton_wallet:
        return jsonify({"error": "Jetton wallet not found"}), 404
    
    tx_body_hex = create_jetton_transfer_body(user_address, jetton_wallet, amount, days)
    tx_body_base64 = base64.b64encode(bytes.fromhex(tx_body_hex)).decode('utf-8')
    
    return jsonify({
        "unsignedTransaction": {
            "address": jetton_wallet,
            "amount": "100000000",
            "payload": tx_body_base64
        }
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
