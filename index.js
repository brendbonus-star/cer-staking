import express from 'express';
import cors from 'cors';
import { Address, beginCell } from '@ton/ton';

const app = express();
const PORT = process.env.PORT || 3000;

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
        const { jettonWallet, destination, amountNano, responseAddress, comment } = req.body;
        
        console.log('📥 Получен запрос:', { jettonWallet, destination, amountNano, responseAddress, comment });
        
        // Парсим адреса напрямую (они уже в формате EQ/UQ)
        const destAddr = Address.parse(destination);
        const responseAddr = Address.parse(responseAddress);
        
        const commentCell = beginCell()
            .storeUint(0, 32)
            .storeStringTail(comment)
            .endCell();
        
        const transferBody = beginCell()
            .storeUint(0xf8a7ea5, 32)
            .storeUint(0, 64)
            .storeCoins(BigInt(amountNano))
            .storeAddress(destAddr)
            .storeAddress(responseAddr)
            .storeBit(0)
            .storeCoins(1)
            .storeBit(1)
            .storeRef(commentCell)
            .endCell();
        
        const boc = transferBody.toBoc();
        const payload = boc.toString('base64');
        
        console.log('✅ Payload создан, длина:', payload.length);
        
        res.json({ success: true, payload });
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
