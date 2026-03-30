import express from 'express';
import cors from 'cors';
import { beginCell, Address } from '@ton/ton';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const TONCENTER_API_KEY = 'd72cd242de2de30bfad0b95f4789fa866255fb4b80aeb00040749d25ac69ebdb';
const TONCENTER_URL = 'https://toncenter.com/api/v2/jsonRPC';

// Функция конвертации адреса
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

// Прокси для TON Center
app.post('/api/toncenter', async (req, res) => {
    try {
        const response = await fetch(TONCENTER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': TONCENTER_API_KEY
            },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Данные пула (можно расширить позже)
app.get('/contract-data', (req, res) => {
    res.json({
        rewardPool: 0,
        totalStaked: 0,
        rate30: 822,
        rate90: 2466,
        rate180: 4932,
        rate365: 10000
    });
});

// Создание payload для Jetton transfer
app.post('/create-payload', async (req, res) => {
    try {
        const { amountNano, comment, destination, responseAddress } = req.body;

        if (!amountNano || !comment || !destination || !responseAddress) {
            return res.status(400).json({ success: false, error: 'Missing fields' });
        }

        let destRaw = destination;
        if (destination === 'EQDChXJt60bhVjLmBE6xGxZKYJvkJrB2F7CGANsojF-lY3Lk') {
            destRaw = '0:c285726deb46e15632e6044eb11b164a609be426b07617b08600db288c5fa563';
        }
        
        const responseRaw = toRaw(responseAddress);
        const destAddr = Address.parseRaw(destRaw);
        const responseAddr = Address.parseRaw(responseRaw);

        const forwardPayload = beginCell()
            .storeUint(0, 32)
            .storeStringTail(comment)
            .endCell();

        const transferBody = beginCell()
            .storeUint(0xf8a7ea5, 32)
            .storeUint(0, 64)
            .storeCoins(BigInt(amountNano))
            .storeAddress(destAddr)
            .storeAddress(responseAddr)
            .storeUint(0, 1)
            .storeCoins(1)
            .storeUint(1, 1)
            .storeRef(forwardPayload)
            .endCell();

        const payload = transferBody.toBoc().toString('base64');
        res.json({ success: true, payload });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'AppKit Proxy' });
});

app.listen(PORT, () => {
    console.log(`Server on port ${PORT}`);
});
