import telebot
import json
import requests
import os
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv("BOT_TOKEN")
STAKING_ADDRESS = "EQBLEMocvp-FS-jfhEKAQ2261_ZwJRvUKmaHHhZXIizLJQvs"

bot = telebot.TeleBot(TOKEN)

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

@bot.message_handler(commands=['reward_pool'])
def reward_pool(message):
    pool = get_reward_pool()
    bot.reply_to(message, json.dumps({"rewardPool": pool}))

if __name__ == '__main__':
    bot.infinity_polling()
