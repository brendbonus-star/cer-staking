import asyncio
import os
import sqlite3
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import requests
from ton import TonlibClient
from ton.utils import to_nano

load_dotenv()

app = Flask(__name__)
CORS(app)

# ===== КОНФИГ =====
TRANSIT_MNEMONIC = os.getenv("TRANSIT_MNEMONIC", "").split()
if not TRANSIT_MNEMONIC:
    print("❌ Ошибка: TRANSIT_MNEMONIC не найдена в .env")
    exit(1)

API_KEY = os.getenv("API_KEY", "")
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS", "EQCDij22bDxzEA9F17A6h6HPTxi03giM7hSt0AP_NLH7cJHb")
TRANSIT_ADDRESS = os.getenv("TRANSIT_ADDRESS", "0:41e4e9e0fae239d6cacd7b53f7069d0c9e742bbed48919a5991fc7fbd1f2e10e")
LEADER_ADDRESS = os.getenv("LEADER_ADDRESS", "EQAmOJb8WPlCKhj6fyE2xGsvohshFx4xqOiMYWowtHKfeEdX")

DB_PATH = "staking.db"

# ===== БАЗА ДАННЫХ =====
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS processed_txs (
            tx_hash TEXT PRIMARY KEY,
            processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS stakes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_address TEXT NOT NULL,
            amount INTEGER NOT NULL,
            days INTEGER NOT NULL,
            stake_time INTEGER NOT NULL,
            lock_period INTEGER NOT NULL,
            fixed_rate INTEGER NOT NULL,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def is_tx_processed(tx_hash):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT 1 FROM processed_txs WHERE tx_hash = ?", (tx_hash,))
    exists = c.fetchone() is not None
    conn.close()
    return exists

def mark_tx_processed(tx_hash):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("INSERT INTO processed_txs (tx_hash) VALUES (?)", (tx_hash,))
    conn.commit()
    conn.close()

# ===== ПАРСИНГ ТРАНЗАКЦИЙ =====
def extract_comment_from_ton_transfer(tx):
    try:
        body = tx.get('in_msg', {}).get('msg_data', {}).get('body')
        if not body:
            return None
        import base64
        decoded = base64.b64decode(body).decode('utf-8', errors='ignore')
        import re
        match = re.search(r'\d+', decoded)
        return match.group(0) if match else None
    except:
        return None

# ===== ВЫЗОВ КОНТРАКТА =====
async def call_contract(method, body_comment):
    client = TonlibClient()
    await client.init_tonlib()
    wallet = await client.import_wallet(TRANSIT_MNEMONIC)
    print(f"Кошелек: {wallet.address}")
    await wallet.transfer(
        destination=CONTRACT_ADDRESS,
        amount=to_nano('0.01'),
        comment=body_comment
    )
    print(f"Команда {method} отправлена")

# ===== ОБРАБОТКА КОММЕНТАРИЕВ =====
async def process_comment(comment, from_address, amount):
    print(f"Обработка: comment={comment}, from={from_address}, amount={amount}")
    
    if comment in ['30', '90', '180', '365']:
        await call_contract('stake', f'stake:{comment}:{from_address}:{amount}')
        print(f"Стейк {amount} CER на {comment} дней от {from_address}")
    
    elif comment == '0':
        await call_contract('unstake', 'unstake')
        print(f"Unstake от {from_address}")
    
    elif comment == '777' and from_address == LEADER_ADDRESS:
        await call_contract('addReward', 'addReward')
        print(f"Пул пополнен на {amount} CER")
    
    elif comment.startswith('rate') and from_address == LEADER_ADDRESS:
        parts = comment.split(':')
        if len(parts) == 2 and parts[0].startswith('rate'):
            period = parts[0][4:]
            new_rate = parts[1]
            await call_contract('setMaxRate', f'setMaxRate:{new_rate}')
            print(f"Ставка для {period} дней изменена на {new_rate}")
    
    elif comment == '9999':
        await call_contract('emergencyWithdraw', 'emergencyWithdraw')
        print(f"Аварийный вывод от {from_address}")
    
    elif comment == '778' and from_address == LEADER_ADDRESS:
        await call_contract('withdrawPool', 'withdrawPool')
        print("Пул выведен лидером")
    
    elif comment == '7777' and from_address == LEADER_ADDRESS:
        await call_contract('emergencyWithdrawPool', 'emergencyWithdrawPool')
        print("Аварийный вывод пула лидером")
    
    else:
        print(f"Неизвестный комментарий: {comment} от {from_address}")

# ===== ФОНОВЫЙ ОПРОС ТРАНЗАКЦИЙ =====
async def check_transactions_loop():
    while True:
        try:
            url = f"https://toncenter.com/api/v2/getTransactions?address={TRANSIT_ADDRESS}&limit=20&api_key={API_KEY}"
            response = requests.get(url)
            data = response.json()
            
            if not data.get('ok'):
                print("Ошибка API")
                await asyncio.sleep(30)
                continue
            
            for tx in data.get('result', []):
                tx_hash = tx.get('transaction_id', {}).get('hash')
                if not tx_hash or is_tx_processed(tx_hash):
                    continue
                
                comment = extract_comment_from_ton_transfer(tx)
                if not comment:
                    continue
                
                from_address = tx.get('in_msg', {}).get('source')
                amount = int(tx.get('in_msg', {}).get('value', 0)) / 1e9
                
                await process_comment(comment, from_address, amount)
                mark_tx_processed(tx_hash)
        
        except Exception as e:
            print(f"Ошибка опроса транзакций: {e}")
        
        await asyncio.sleep(30)

# ===== ЭНДПОИНТЫ =====
@app.route('/reward_pool', methods=['GET'])
def get_reward_pool():
    return jsonify({"rewardPool": 0})

@app.route('/rates', methods=['GET'])
def get_rates():
    return jsonify({"rate30": 821, "rate90": 2466, "rate180": 4932, "rate365": 10000})

@app.route('/stake', methods=['POST'])
def stake():
    return jsonify({"error": "Direct stake not supported"}), 400

# ===== ЗАПУСК =====
if __name__ == '__main__':
    init_db()
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.create_task(check_transactions_loop())
    app.run(host='0.0.0.0', port=5000)
