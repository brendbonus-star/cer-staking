import express from 'express';
import cors from 'cors';
import { beginCell } from '@ton/ton';

const app = express();
const PORT = process.env.PORT || 80;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('CER Staking Backend is running');
});

app.get('/ping', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

app.post('/create-payload', async (req, res) => {
    try {
        const { amountNano, comment } = req.body;

        console.log('📥 Получен запрос:', { amountNano, comment });

        if (!amountNano || !comment) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: amountNano, comment' 
            });
        }

        const allowedComments = ['30', '90', '180', '365'];
        if (!allowedComments.includes(comment)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid comment. Allowed: 30, 90, 180, 365' 
            });
        }

        const messageBody = beginCell()
            .storeUint(0, 32)
            .storeStringTail(comment)
            .endCell();

        const boc = messageBody.toBoc();
        const payload = boc.toString('base64');

        console.log('✅ Payload создан:', { comment, amountNano, payloadLength: payload.length });

        res.json({ success: true, payload });

    } catch (error) {
        console.error('❌ Ошибка:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
