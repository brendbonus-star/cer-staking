import telebot
import json
import requests
import os
from flask import Flask, jsonify
import threading

TOKEN = os.getenv("BOT_TOKEN")
STAKING_ADDRESS = "EQBLEMocvp-FS-jfhEKAQ2261_ZwJRvUKmaHHhZXIizLJQvs"
PORT = int(os.getenv("PORT", 5000))

if not TOKEN:
    raise ValueError("BOT_TOKEN not set")

bot = telebot.TeleBot(TOKEN)
app = Flask(__name__)

def get_reward_pool():
    try:
        url = f"https://tonapi.io/v2/accounts/{STAKING_ADDRESS}/jettons"
        response = requests.get(url, timeout=10)
        data = response.json()
        if data and "balances" in data:
            for jetton in data["balances"]:
                if jetton.get("jetton", {}).get("symbol") == "CER":
                    balance = int(jetton.get("balance", 0))
                    return balance // 10**9
        return 0
    except Exception as e:
        print(f"Error: {e}")
        return 0

@app.route('/reward_pool')
def reward_pool_endpoint():
    pool = get_reward_pool()
    return jsonify({"rewardPool": pool})

@bot.message_handler(commands=['reward_pool'])
def reward_pool(message):
    pool = get_reward_pool()
    bot.reply_to(message, json.dumps({"rewardPool": pool}))

@bot.message_handler(commands=['start'])
def start(message):
    bot.reply_to(message, "💰 CER Staking Bot готов")

def run_flask():
    app.run(host='0.0.0.0', port=PORT)

if __name__ == '__main__':
    # Запускаем Flask в отдельном потоке
    flask_thread = threading.Thread(target=run_flask)
    flask_thread.start()
    # Запускаем бота
    print("Бот запущен")
    bot.infinity_polling()
