import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const TONCENTER_API_KEY = 'd72cd242de2de30bfad0b95f4789fa866255fb4b80aeb00040749d25ac69ebdb';
const TONCENTER_URL = 'https://toncenter.com/api/v2/jsonRPC';

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

app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'AppKit Proxy' });
});

app.listen(PORT, () => {
    console.log(`Server on port ${PORT}`);
});
