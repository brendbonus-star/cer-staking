import { AppKit, Network, TonConnectConnector, transferJetton } from '@ton/appkit';

const STAKING_ADDRESS = "EQDChXJt60bhVjLmBE6xGxZKYJvkJrB2F7CGANsojF-lY3Lk";
const JETTON_MASTER = "EQCeFJOkajBxztRloikZ9iUHhqnymZoX3pgxY47bbVlQuA3G";
const PROXY_SERVER = "https://cerstaking.bothost.tech";

let appKit;
let walletAddress = null;
let jettonWallet = null;
let userBalance = 0;
let rewardPool = 0;

function addLog(msg) {
    const logDiv = document.getElementById('log-area');
    const time = new Date().toLocaleTimeString();
    logDiv.innerHTML += `<div>[${time}] ${msg}</div>`;
    logDiv.scrollTop = logDiv.scrollHeight;
    console.log(msg);
}

async function getUserJettonWallet(address) {
    try {
        addLog(`Запрос Jetton-кошелька...`);
        const url = `https://tonapi.io/v2/accounts/${address}/jettons?jetton_master=${JETTON_MASTER}`;
        const r = await fetch(url);
        const d = await r.json();
        if (d && d.balances && d.balances.length > 0) {
            jettonWallet = d.balances[0].wallet_address.address;
            addLog(`✅ Jetton-кошелек: ${jettonWallet}`);
            return parseInt(d.balances[0].balance) / 1e9;
        }
        jettonWallet = null;
        return 0;
    } catch(e) {
        addLog(`❌ Ошибка: ${e.message}`);
        jettonWallet = null;
        return 0;
    }
}

async function getRewardPool() {
    try {
        const r = await fetch(`https://tonapi.io/v2/accounts/${STAKING_ADDRESS}/jettons`);
        const d = await r.json();
        if (d && d.balances) {
            for (let j of d.balances) {
                if (j.jetton?.symbol === "CER") {
                    return parseInt(j.balance) / 1e9;
                }
            }
        }
        return 0;
    } catch(e) {
        return 0;
    }
}

async function updateData() {
    if (walletAddress) {
        userBalance = await getUserJettonWallet(walletAddress);
        document.getElementById('cer-balance').textContent = userBalance.toFixed(2);
    }
    rewardPool = await getRewardPool();
    const statusSpan = document.getElementById('pool-status-text');
    if (rewardPool > 0) {
        statusSpan.innerHTML = '✅ Активен';
        statusSpan.className = 'status-active';
    } else {
        statusSpan.innerHTML = '❌ Неактивен';
        statusSpan.className = 'status-inactive';
    }
    updateUI();
}

function updateUI() {
    const amount = parseFloat(document.getElementById('amount').value) || 0;
    const days = parseInt(document.getElementById('lock-days').value);
    const rates = {30: 822, 90: 2466, 180: 4932, 365: 10000};
    const rate = rates[days];
    const profit = (amount * rate / 10000).toFixed(2);
    document.getElementById('profit-display').textContent = profit;
    const maxByBalance = Math.min(userBalance, rewardPool);
    document.getElementById('max-hint').innerHTML = `Максимум: ${maxByBalance.toFixed(2)} CER`;
    const stakeBtn = document.getElementById('stake-btn');
    if (amount > maxByBalance || amount <= 0) {
        document.getElementById('warning').innerHTML = '⚠️ Сумма превышает лимит';
        stakeBtn.disabled = true;
    } else {
        document.getElementById('warning').innerHTML = '';
        stakeBtn.disabled = false;
    }
}

async function sendJettonTransaction(comment, amountNano) {
    addLog(`🚀 Отправка: ${comment}, ${amountNano} nano`);
    
    if (!appKit || !walletAddress) {
        alert('Кошелек не подключен');
        return false;
    }
    
    if (!jettonWallet) {
        alert('Jetton-кошелек не найден');
        return false;
    }
    
    try {
        const result = await transferJetton(appKit, {
            from: walletAddress,
            to: STAKING_ADDRESS,
            amount: amountNano,
            jettonMaster: JETTON_MASTER,
            comment: comment
        });
        
        addLog(`✅ Успешно!`);
        alert('Транзакция отправлена!');
        return true;
    } catch(e) {
        addLog(`❌ Ошибка: ${e.message}`);
        alert(`Ошибка: ${e.message}`);
        return false;
    }
}

document.getElementById('stake-btn').onclick = async () => {
    const amount = parseFloat(document.getElementById('amount').value);
    const days = document.getElementById('lock-days').value;
    if (!amount || amount <= 0) return alert('Введите сумму');
    if (amount > Math.min(userBalance, rewardPool)) return alert('Сумма превышает лимит');
    await sendJettonTransaction(days, Math.floor(amount * 1e9));
};

document.getElementById('unstake-btn').onclick = async () => {
    await sendJettonTransaction("0", 1);
};

document.getElementById('add-reward').onclick = async () => {
    const amount = document.getElementById('pool-amount').value;
    if (amount && parseFloat(amount) > 0) {
        await sendJettonTransaction("777", Math.floor(parseFloat(amount) * 1e9));
    } else {
        alert('Введите сумму');
    }
};

async function sendTonTransaction(comment) {
    if (!appKit || !walletAddress) return alert('Кошелек не подключен');
    try {
        await transferJetton(appKit, {
            from: walletAddress,
            to: STAKING_ADDRESS,
            amount: "50000000",
            jettonMaster: JETTON_MASTER,
            comment: comment
        });
        alert('Отправлено!');
    } catch(e) {
        alert(`Ошибка: ${e.message}`);
    }
}

document.getElementById('set-rate30').onclick = () => sendTonTransaction(`rate30:${document.getElementById('rate30').value}`);
document.getElementById('set-rate90').onclick = () => sendTonTransaction(`rate90:${document.getElementById('rate90').value}`);
document.getElementById('set-rate180').onclick = () => sendTonTransaction(`rate180:${document.getElementById('rate180').value}`);
document.getElementById('set-rate365').onclick = () => sendTonTransaction(`rate365:${document.getElementById('rate365').value}`);
document.getElementById('withdraw-pool').onclick = () => sendTonTransaction("778");
document.getElementById('emergency-withdraw-pool').onclick = () => sendTonTransaction("7777");

async function init() {
    addLog('🚀 Инициализация AppKit...');
    
    appKit = new AppKit({
        networks: {
            [Network.mainnet().chainId]: {
                apiClient: {
                    url: 'https://toncenter.com',
                    key: 'd72cd242de2de30bfad0b95f4789fa866255fb4b80aeb00040749d25ac69ebdb'
                }
            }
        },
        connectors: [
            new TonConnectConnector({
                tonConnectOptions: {
                    manifestUrl: 'https://raw.githubusercontent.com/brendbonus-star/cer-staking/main/tonconnect-manifest.json'
                }
            })
        ]
    });
    
    const connector = appKit.connectors[0];
    connector.onStatusChange(async (wallet) => {
        if (wallet) {
            walletAddress = wallet.account.address;
            addLog(`✅ Кошелек: ${walletAddress}`);
            document.getElementById('wallet-status').innerHTML = '✅ Кошелек подключен';
            document.getElementById('wallet-address').innerHTML = walletAddress;
            await updateData();
            document.getElementById('admin-panel').style.display = 'block';
        } else {
            walletAddress = null;
            addLog('🔌 Кошелек отключен');
            document.getElementById('wallet-status').innerHTML = '⚡ Кошелек не подключен';
            document.getElementById('admin-panel').style.display = 'none';
        }
    });
    
    await updateData();
    setInterval(updateData, 30000);
}

document.getElementById('lock-days').addEventListener('change', updateUI);
document.getElementById('amount').addEventListener('input', updateUI);
init();
