import express from 'express';
import cors from 'cors';
import { TonClient, Address, beginCell } from '@ton/ton';

const app = express();
app.use(cors());
app.use(express.json());

const STAKING_ADDRESS = "EQBLEMocvp-FS-jfhEKAQ2261_ZwJRvUKmaHHhZXIizLJQvs";
const JETTON_MASTER = "EQCeFJOkajBxztRloikZ9iUHhqnymZoX3pgxY47bbVlQuA3G";
const API_KEY = "d72cd242de2de30bfad0b95f4789fa866255fb4b80aeb00040749d25ac69ebdb";

// Получение адреса Jetton-кошелька пользователя
async function getJettonWallet(userAddress) {
    try {
        const client = new TonClient({
            endpoint: 'https://toncenter.com/api/v2/jsonRPC',
            apiKey: API_KEY
        });
        const result = await client.runMethod(
            JETTON_MASTER,
            'get_wallet_address',
            [{ type: 'slice', value: Address.parse(userAddress) }]
        );
        return result.stack[0].value.toString();
    } catch (e) {
        console.error('Error getting jetton wallet:', e);
        return null;
    }
}

// Эндпоинт для стейкинга
app.post('/stake', async (req, res) => {
    const { userAddress, amount, days } = req.body;
    
    if (!userAddress || !amount || !days) {
        return res.status(400).json({ error: 'Missing parameters' });
    }
    
    try {
        const jettonWallet = await getJettonWallet(userAddress);
        if (!jettonWallet) {
            return res.status(404).json({ error: 'Jetton wallet not found' });
        }
        
        const amountInNano = BigInt(Math.floor(amount * 1e9));
        const forwardTonAmount = 50000000n; // 0.05 TON
        
        // Forward payload для комментария (срок)
        const forwardPayload = beginCell()
            .storeUint(0, 32)
            .storeStringTail(`${days}`)
            .endCell();
        
        // Тело Jetton Transfer
        const body = beginCell()
            .storeUint(0xf8a7ea5, 32)
            .storeUint(0, 64)
            .storeCoins(amountInNano)
            .storeAddress(Address.parse(STAKING_ADDRESS))
            .storeAddress(Address.parse(userAddress))
            .storeBit(0)
            .storeCoins(forwardTonAmount)
            .storeBit(1)
            .storeRef(forwardPayload)
            .endCell();
        
        const transaction = {
            validUntil: Math.floor(Date.now() / 1000) + 600,
            messages: [{
                address: jettonWallet,
                amount: "50000000",
                payload: body.toBoc().toString("base64")
            }]
        };
        
        res.json({ transaction });
    } catch (e) {
        console.error('Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Эндпоинт для получения пула
app.get('/reward_pool', async (req, res) => {
    try {
        const client = new TonClient({
            endpoint: 'https://toncenter.com/api/v2/jsonRPC',
            apiKey: API_KEY
        });
        const result = await client.runMethod(
            STAKING_ADDRESS,
            'getRewardPool',
            []
        );
        const pool = Number(result.stack[0].value) / 1e9;
        res.json({ rewardPool: pool });
    } catch (e) {
        console.error('Error getting reward pool:', e);
        res.json({ rewardPool: 0 });
    }
});

// Эндпоинт для проверки баланса пользователя (опционально)
app.get('/balance/:address', async (req, res) => {
    try {
        const url = `https://tonapi.io/v2/accounts/${req.params.address}/jettons?jetton_master=${JETTON_MASTER}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data && data.balances && data.balances.length > 0) {
            const balance = parseInt(data.balances[0].balance);
            res.json({ balance: balance / 1e9 });
        } else {
            res.json({ balance: 0 });
        }
    } catch (e) {
        res.json({ balance: 0 });
    }
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});