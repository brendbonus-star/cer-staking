import telebot
import json
import requests
import os

TOKEN = os.getenv("BOT_TOKEN")
STAKING_ADDRESS = "EQBLEMocvp-FS-jfhEKAQ2261_ZwJRvUKmaHHhZXIizLJQvs"
JETTON_MASTER = "EQCeFJOkajBxztRloikZ9iUHhqnymZoX3pgxY47bbVlQuA3G"

if not TOKEN:
    raise ValueError("BOT_TOKEN not set")

bot = telebot.TeleBot(TOKEN)

def get_reward_pool():
    try:
        url = f"https://tonapi.io/v2/accounts/{STAKING_ADDRESS}/jettons"
        response = requests.get(url, timeout=10)
        data = response.json()
        
        if data and "balances" in data:
            for jetton in data["balances"]:
                if jetton.get("jetton", {}).get("symbol") == "CER":
                    balance = int(jetton.get("balance", 0))
                    return balance // 10**9  # 9 знаков после запятой
        return 0
    except Exception as e:
        print(f"Error: {e}")
        return 0

@bot.message_handler(commands=['reward_pool'])
def reward_pool(message):
    pool = get_reward_pool()
    bot.reply_to(message, json.dumps({"rewardPool": pool}))

@bot.message_handler(commands=['start'])
def start(message):
    bot.reply_to(message, "💰 CER Staking Bot готов")

if __name__ == '__main__':
    print("Бот запущен")
    bot.infinity_polling()
