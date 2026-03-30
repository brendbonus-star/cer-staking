// Импорт AppKit
import { TonConnectUI } from 'https://unpkg.com/@tonconnect/ui@2.3.1/dist/tonconnect-ui.min.js';
import { AppKit, Network, transferJetton } from 'https://esm.sh/@ton/appkit@0.0.1-alpha.5';

// Контракты
const STAKING_CONTRACT = "EQDChXJt60bhVjLmBE6xGxZKYJvkJrB2F7CGANsojF-lY3Lk";
const JETTON_MASTER = "EQCeFJOkajBxztRloikZ9iUHhqnymZoX3pgxY47bbVlQuA3G";
const PROXY_SERVER = "https://cerstaking.bothost.tech";

// Состояние
let walletAddress = null;
let cerBalance = 0;
let selectedPeriod = 30;

// Логирование
function log(msg) {
    const logArea = document.getElementById("log-area");
    const time = new Date().toLocaleTimeString();
    logArea.innerHTML += `<div>[${time}] ${msg}</div>`;
    logArea.scrollTop = logArea.scrollHeight;
    console.log(msg);
}

// Получение баланса CER пользователя
async function fetchBalance() {
    if (!walletAddress) return;
    try {
        const response = await fetch(`https://tonapi.io/v2/accounts/${walletAddress}/jettons?jetton_master=${JETTON_MASTER}`);
        const data = await response.json();
        if (data && data.balances && data.balances.length > 0) {
            cerBalance = parseInt(data.balances[0].balance) / 1e9;
        } else {
            cerBalance = 0;
        }
        document.getElementById("cer-balance").innerText = cerBalance.toFixed(2);
    } catch (error) {
        log("Ошибка баланса: " + error.message);
    }
}

// Получение данных пула
async function fetchPoolData() {
    try {
        const response = await fetch(`${PROXY_SERVER}/contract-data`);
        const data = await response.json();
        document.getElementById("rewardPool").innerText = (data.rewardPool / 1e9).toFixed(2);
        document.getElementById("totalStaked").innerText = (data.totalStaked / 1e9).toFixed(2);
        document.getElementById("rate30").innerText = (data.rate30 / 100).toFixed(2) + "%";
        document.getElementById("rate90").innerText = (data.rate90 / 100).toFixed(2) + "%";
        document.getElementById("rate180").innerText = (data.rate180 / 100).toFixed(2) + "%";
        document.getElementById("rate365").innerText = (data.rate365 / 100).toFixed(2) + "%";
        
        const poolStatus = document.getElementById("pool-status-text");
        if (data.rewardPool > 0) {
            poolStatus.innerHTML = "✅ Активен";
            poolStatus.className = "status-active";
        } else {
            poolStatus.innerHTML = "❌ Неактивен";
            poolStatus.className = "status-inactive";
        }
    } catch (error) {
        log("Ошибка загрузки пула: " + error.message);
    }
}

// Расчёт дохода
function calculateProfit() {
    const amount = parseFloat(document.getElementById("amount").value) || 0;
    const days = parseInt(document.getElementById("lock-days").value);
    const rates = {30: 822, 90: 2466, 180: 4932, 365: 10000};
    const profit = (amount * rates[days] / 10000).toFixed(2);
    document.getElementById("profit-display").innerText = profit;
    
    const maxHint = document.getElementById("max-hint");
    maxHint.innerHTML = `Максимум: ${cerBalance.toFixed(2)} CER`;
    
    const warning = document.getElementById("warning");
    const stakeBtn = document.getElementById("stake-btn");
    if (amount > cerBalance) {
        warning.innerHTML = "⚠️ Сумма превышает баланс";
        stakeBtn.disabled = true;
    } else {
        warning.innerHTML = "";
        stakeBtn.disabled = false;
    }
}

// Инициализация AppKit
let appKit;
let tonConnectUI;

async function initAppKit() {
    tonConnectUI = new TonConnectUI({
        manifestUrl: "https://brendbonus-star.github.io/cer-staking/tonconnect-manifest.json",
        buttonRootId: "connect-btn"
    });
    
    // Ждём подключения
    tonConnectUI.onStatusChange(async (wallet) => {
        if (wallet) {
            walletAddress = wallet.account.address;
            log("✅ Кошелёк подключен: " + walletAddress);
            document.getElementById("wallet-status").innerHTML = "✅ Кошелёк подключен";
            document.getElementById("wallet-address").innerHTML = walletAddress;
            
            // Инициализируем AppKit после подключения
            appKit = new AppKit({
                networks: [Network.mainnet()],
                connectors: [{
                    getProvider: () => tonConnectUI,
                    name: 'TonConnect',
                    type: 'injected'
                }],
                apiKey: 'd72cd242de2de30bfad0b95f4789fa866255fb4b80aeb00040749d25ac69ebdb',
                apiBaseUrl: PROXY_SERVER
            });
            
            await fetchBalance();
            document.getElementById("admin-panel").style.display = "block";
        } else {
            walletAddress = null;
            appKit = null;
            log("🔌 Кошелёк отключен");
            document.getElementById("wallet-status").innerHTML = "⚡ Кошелёк не подключен";
            document.getElementById("wallet-address").innerHTML = "";
            document.getElementById("cer-balance").innerText = "0";
            document.getElementById("admin-panel").style.display = "none";
        }
    });
}

// Стейкинг через AppKit
async function stake(amount, period) {
    if (!appKit || !walletAddress) {
        alert("Подключите кошелёк");
        return false;
    }
    
    log(`Стейкинг: ${amount} CER на ${period} дней`);
    
    try {
        const result = await transferJetton(appKit, {
            from: walletAddress,
            to: STAKING_CONTRACT,
            amount: amount.toString(),
            jettonMaster: JETTON_MASTER,
            comment: period.toString()
        });
        
        log("✅ Транзакция отправлена!");
        alert("Стейкинг успешно отправлен!");
        return true;
        
    } catch (error) {
        log("❌ Ошибка: " + error.message);
        alert("Ошибка: " + error.message);
        return false;
    }
}

// Обработчики
document.getElementById("stake-btn").onclick = async () => {
    const amount = parseFloat(document.getElementById("amount").value);
    const period = document.getElementById("lock-days").value;
    if (!amount || amount <= 0) {
        alert("Введите сумму");
        return;
    }
    if (amount > cerBalance) {
        alert("Недостаточно CER");
        return;
    }
    await stake(amount, period);
};

document.getElementById("amount").addEventListener("input", calculateProfit);
document.getElementById("lock-days").addEventListener("change", calculateProfit);

// Запуск
initAppKit();
fetchPoolData();
setInterval(() => {
    if (walletAddress) fetchBalance();
    fetchPoolData();
}, 30000);
