import telebot
import json
import requests

TOKEN = "8092131927:AAGiC6iL7-xeEuNr3vDAGx-UeGauATEt1K0"
STAKING_ADDRESS = "EQBLEMocvp-FS-jfhEKAQ2261_ZwJRvUKmaHHhZXIizLJQvs"
JETTON_MASTER = "EQCeFJOkajBxztRloikZ9iUHhqnymZoX3pgxY47bbVlQuA3G"

bot = telebot.TeleBot(TOKEN)

def get_reward_pool():
    try:
        url = f"https://tonscan.org/api/v1/address/{STAKING_ADDRESS}/jettons"
        response = requests.get(url, timeout=10)
        data = response.json()
        if data and "jettons" in data:
            for jetton in data["jettons"]:
                if jetton.get("master") == JETTON_MASTER:
                    return int(float(jetton.get("balance", 0)))
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
    bot.polling()