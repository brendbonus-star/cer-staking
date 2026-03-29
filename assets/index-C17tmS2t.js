(async function() {
    const stakingContractRaw = "0:c285726deb46e15632e6044eb11b164a609be426b07617b08600db288c5fa563";
    const stakingContractUserFriendly = "EQDChXJt60bhVjLmBE6xGxZKYJvkJrB2F7CGANsojF-lY3Lk";
    const jettonMaster = "EQCeFJOkajBxztRloikZ9iUHhqnymZoX3pgxY47bbVlQuA3G";
    const apiUrl = "https://cer-staking-legkiy.amvera.io";
    
    let tonConnect;
    let walletAddress;
    let userJettonWallet;
    let selectedPeriod = 30;
    
    function toUserFriendly(raw) {
        if (!raw) return null;
        if (raw.startsWith('0:')) {
            return 'UQ' + raw.slice(2);
        }
        return raw;
    }
    
    async function getJettonWallet(address) {
        try {
            const response = await fetch(`${apiUrl}/jetton-wallet/${address}`);
            const data = await response.json();
            return data.wallet;
        } catch (error) {
            console.error("Ошибка получения jettonWallet:", error);
            return null;
        }
    }
    
    async function getContractData() {
        try {
            const response = await fetch(`${apiUrl}/contract-data`);
            const data = await response.json();
            document.getElementById("rewardPool").innerText = formatAmount(data.rewardPool);
            document.getElementById("totalStaked").innerText = formatAmount(data.totalStaked);
            document.getElementById("rate30").innerText = (data.rate30 / 100).toFixed(2) + "%";
            document.getElementById("rate90").innerText = (data.rate90 / 100).toFixed(2) + "%";
            document.getElementById("rate180").innerText = (data.rate180 / 100).toFixed(2) + "%";
            document.getElementById("rate365").innerText = (data.rate365 / 100).toFixed(2) + "%";
            return data;
        } catch (error) {
            console.error("Ошибка загрузки данных:", error);
        }
    }
    
    function formatAmount(amount) {
        if (!amount) return "0 CER";
        return (amount / 1e9).toFixed(2) + " CER";
    }
    
    async function getBalance(address) {
        try {
            const response = await fetch(`${apiUrl}/balance/${address}`);
            const data = await response.json();
            document.getElementById("cerBalance").innerText = formatAmount(data.balance);
            return data.balance;
        } catch (error) {
            console.error("Ошибка загрузки баланса:", error);
        }
    }
    
    async function createStake(amount, period) {
        try {
            const amountNano = (amount * 1e9).toString();
            const comment = period.toString();
            
            const response = await fetch(`${apiUrl}/create-payload`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    amountNano: amountNano,
                    comment: comment,
                    destination: stakingContractUserFriendly,
                    responseAddress: toUserFriendly(walletAddress)
                })
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error);
            }
            
            const jettonWalletAddress = toUserFriendly(userJettonWallet);
            
            const transaction = {
                validUntil: Date.now() + 5 * 60 * 1000,
                messages: [{
                    address: jettonWalletAddress,
                    amount: "0",
                    payload: data.payload
                }]
            };
            
            const result = await tonConnect.sendTransaction(transaction);
            console.log("Транзакция отправлена:", result);
            return result;
            
        } catch (error) {
            console.error("Ошибка стейкинга:", error);
            throw error;
        }
    }
    
    tonConnect = new TonConnect({
        manifestUrl: window.location.origin + "/tonconnect-manifest.json"
    });
    
    document.getElementById("connectBtn").onclick = async () => {
        try {
            const wallets = await tonConnect.getWallets();
            if (wallets.length === 0) {
                alert("Установите кошелёк (Tonkeeper, Wallet)");
                return;
            }
            
            const wallet = await tonConnect.connect();
            walletAddress = wallet.account.address;
            userJettonWallet = await getJettonWallet(walletAddress);
            
            document.getElementById("connectBtn").style.display = "none";
            document.getElementById("walletInfo").style.display = "block";
            
            await getBalance(walletAddress);
            document.getElementById("status").innerText = "✅ Кошелёк подключён";
            setTimeout(() => {
                document.getElementById("status").innerText = "";
            }, 2000);
        } catch (error) {
            console.error(error);
            document.getElementById("status").innerText = "❌ Ошибка подключения";
        }
    };
    
    document.querySelectorAll(".period-btn").forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll(".period-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            selectedPeriod = parseInt(btn.dataset.days);
        };
    });
    
    document.getElementById("stakeBtn").onclick = async () => {
        const amount = parseFloat(document.getElementById("stakeAmount").value);
        if (!amount || amount <= 0) {
            alert("Введите сумму стейка");
            return;
        }
        
        document.getElementById("stakeBtn").disabled = true;
        document.getElementById("stakeBtn").innerText = "⏳ Отправка...";
        
        try {
            await createStake(amount, selectedPeriod);
            document.getElementById("status").className = "success";
            document.getElementById("status").innerText = "✅ Стейк успешно создан!";
            await getBalance(walletAddress);
            await getContractData();
        } catch (error) {
            document.getElementById("status").className = "error";
            document.getElementById("status").innerText = "❌ Ошибка: " + error.message;
        } finally {
            document.getElementById("stakeBtn").disabled = false;
            document.getElementById("stakeBtn").innerText = "📈 Стейк";
            setTimeout(() => {
                document.getElementById("status").innerText = "";
            }, 3000);
        }
    };
    
    getContractData();
    setInterval(() => {
        if (walletAddress) getBalance(walletAddress);
        getContractData();
    }, 10000);
})();
