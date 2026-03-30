import express from 'express';
import cors from 'cors';
import { beginCell, Address } from '@ton/ton';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

function toRaw(addr) {
    if (!addr) return null;
    if (addr.startsWith('0:')) return addr;
    if (addr.startsWith('EQ') || addr.startsWith('UQ')) {
        const hex = addr.slice(2);
        if (hex.length === 64) return '0:' + hex;
        if (hex.length === 63) return '0:' + 'c' + hex.slice(1);
        return '0:' + hex;
    }
    return addr;
}

let contractData = {
    rewardPool: 0,
    totalStaked: 0,
    rate30: 822,
    rate90: 2466,
    rate180: 4932,
    rate365: 10000
};

async function updateContractData() {
    try {
        const response = await fetch('https://tonapi.io/v2/accounts/EQDChXJt60bhVjLmBE6xGxZKYJvkJrB2F7CGANsojF-lY3Lk/jettons');
        if (response.ok) {
            const data = await response.json();
            if (data.balances && data.balances.length > 0) {
                const cerJetton = data.balances.find(b => b.jetton?.symbol === 'CER');
                if (cerJetton) {
                    contractData.rewardPool = parseInt(cerJetton.balance);
                }
            }
        }
    } catch (error) {
        console.error('Error updating contract data:', error.message);
    }
}

app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'CER Staking API' });
});

app.get('/ping', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/contract-data', (req, res) => {
    res.json(contractData);
});

app.post('/api/stake', async (req, res) => {
    try {
        const { userAddress, amount, period, jettonMaster, stakingContract } = req.body;

        if (!userAddress || !amount || !period) {
            return res.status(400).json({ success: false, error: 'Missing fields' });
        }

        // Получаем Jetton-кошелёк пользователя
        const jettonWalletResponse = await fetch(`https://tonapi.io/v2/accounts/${userAddress}/jettons?jetton_master=${jettonMaster}`);
        const jettonData = await jettonWalletResponse.json();
        
        if (!jettonData.balances || jettonData.balances.length === 0) {
            return res.status(400).json({ success: false, error: 'Jetton wallet not found' });
        }
        
        const jettonWallet = jettonData.balances[0].wallet_address.address;
        const amountNano = (amount * 1e9).toString();
        
        // Формируем forward_payload с комментарием
        const forwardPayload = beginCell()
            .storeUint(0, 32)
            .storeStringTail(period.toString())
            .endCell();
        
        // Формируем тело Jetton transfer
        const transferBody = beginCell()
            .storeUint(0xf8a7ea5, 32)
            .storeUint(0, 64)
            .storeCoins(BigInt(amountNano))
            .storeAddress(Address.parseRaw(toRaw(stakingContract)))
            .storeAddress(Address.parseRaw(toRaw(userAddress)))
            .storeUint(0, 1)
            .storeCoins(1)
            .storeUint(1, 1)
            .storeRef(forwardPayload)
            .endCell();
        
        const payload = transferBody.toBoc().toString('base64');
        
        res.json({
            success: true,
            messages: [{
                address: jettonWallet,
                amount: "0",
                payload: payload
            }]
        });
        
    } catch (error) {
        console.error('Stake error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server on port ${PORT}`);
    updateContractData();
    setInterval(updateContractData, 30000);
});
