from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

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
        print(f"Error: {e}")
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
    
    return jsonify({"jettonWallet": jetton_wallet})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
