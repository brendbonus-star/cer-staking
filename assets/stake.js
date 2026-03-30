// Контракты
const STAKING_CONTRACT = "EQDChXJt60bhVjLmBE6xGxZKYJvkJrB2F7CGANsojF-lY3Lk";
const JETTON_MASTER = "EQCeFJOkajBxztRloikZ9iUHhqnymZoX3pgxY47bbVlQuA3G";
const PROXY_SERVER = "https://cerstaking.bothost.tech";

// Состояние
let tonConnectUI = null;
let walletAddress = null;
let userJettonWallet = null;
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

// Конвертация raw → user-friendly (bounceable)
function toUserFriendly(raw) {
    if (!raw) return null;
    if (raw.startsWith('0:')) {
        return 'EQ' + raw.slice(2);
    }
    return raw;
}

// Получение Jetton-кошелька
async function getJettonWallet(address) {
    try {
        const response = await fetch(`https://tonapi.io/v2/accounts/${address}/jettons?jetton_master=${JETTON_MASTER}`);
        const data = await response.json();
        if (data && data.balances && data.balances.length > 0) {
            return data.balances[0].wallet_address.address;
        }
        return null;
    } catch (error) {
        log("Ошибка получения Jetton-кошелька: " + error.message);
        return null;
    }
}

// Получение баланса CER
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

// Стейкинг (исправленная отправка)
async function stake(amount, period) {
    if (!tonConnectUI || !tonConnectUI.connected) {
        alert("Подключите кошелёк");
        return false;
    }
    
    if (!userJettonWallet) {
        alert("Jetton-кошелёк не найден");
        return false;
    }
    
    const amountNano = (amount * 1e9).toString();
    const jettonWalletAddress = toUserFriendly(userJettonWallet);
    const responseAddress = toUserFriendly(walletAddress);
    
    log(`Стейкинг: ${amount} CER на ${period} дней`);
    log(`Jetton-кошелёк: ${jettonWalletAddress}`);
    
    try {
        const response = await fetch(`${PROXY_SERVER}/create-payload`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                amountNano: amountNano,
                comment: period.toString(),
                destination: STAKING_CONTRACT,
                responseAddress: responseAddress
            })
        });
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error);
        }
        
        const transaction = {
            validUntil: Math.floor(Date.now() / 1000) + 300,
            messages: [{
                address: jettonWalletAddress,
                amount: "0",
                payload: data.payload
            }]
        };
        
        const result = await tonConnectUI.sendTransaction(transaction);
        log("✅ Транзакция отправлена!");
        alert("Стейкинг успешно отправлен!");
        return true;
        
    } catch (error) {
        log("❌ Ошибка: " + error.message);
        alert("Ошибка: " + error.message);
        return false;
    }
}

// Инициализация TonConnect
function initTonConnect() {
    tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
        manifestUrl: "https://brendbonus-star.github.io/cer-staking/tonconnect-manifest.json",
        buttonRootId: "connect-btn"
    });
    
    tonConnectUI.onStatusChange(async (wallet) => {
        if (wallet) {
            walletAddress = wallet.account.address;
            log("✅ Кошелёк подключен: " + walletAddress);
            document.getElementById("wallet-status").innerHTML = "✅ Кошелёк подключен";
            document.getElementById("wallet-address").innerHTML = walletAddress;
            
            userJettonWallet = await getJettonWallet(walletAddress);
            if (userJettonWallet) {
                log("✅ Jetton-кошелёк: " + userJettonWallet);
            } else {
                log("❌ Jetton-кошелёк CER не найден");
            }
            
            await fetchBalance();
            document.getElementById("admin-panel").style.display = "block";
        } else {
            walletAddress = null;
            userJettonWallet = null;
            log("🔌 Кошелёк отключен");
            document.getElementById("wallet-status").innerHTML = "⚡ Кошелёк не подключен";
            document.getElementById("wallet-address").innerHTML = "";
            document.getElementById("cer-balance").innerText = "0";
            document.getElementById("admin-panel").style.display = "none";
        }
    });
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

document.getElementById("unstake-btn").onclick = async () => {
    if (!tonConnectUI || !tonConnectUI.connected) {
        alert("Подключите кошелёк");
        return;
    }
    alert("Функция unstake в разработке");
};

document.getElementById("add-reward").onclick = async () => {
    const amount = parseFloat(document.getElementById("pool-amount").value);
    if (!amount || amount <= 0) {
        alert("Введите сумму");
        return;
    }
    alert("Функция пополнения пула в разработке");
};

document.getElementById("amount").addEventListener("input", calculateProfit);
document.getElementById("lock-days").addEventListener("change", calculateProfit);

// Запуск
initTonConnect();
fetchPoolData();
setInterval(() => {
    if (walletAddress) fetchBalance();
    fetchPoolData();
}, 30000);
