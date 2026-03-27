import express from 'express';
import cors from 'cors';
import { Address, Cell, beginCell } from '@ton/ton';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Конвертация адреса из 0:... в EQ формат
function toRawAddress(address) {
    if (!address) return address;
    if (address.startsWith('0:')) {
        return 'EQ' + address.slice(2);
    }
    return address;
}

// Создание JettonTransfer payload через @ton/ton
app.post('/create-payload', async (req, res) => {
    try {
        const { jettonWallet, destination, amountNano, responseAddress, comment } = req.body;
        
        console.log('📥 Получен запрос:', { jettonWallet, destination, amountNano, responseAddress, comment });
        
        // Парсим адреса
        const jettonWalletAddr = Address.parse(toRawAddress(jettonWallet));
        const destAddr = Address.parse(toRawAddress(destination));
        const responseAddr = Address.parse(toRawAddress(responseAddress));
        
        // Создаём комментарий в отдельной ячейке
        const commentCell = beginCell()
            .storeUint(0, 32)
            .storeStringTail(comment)
            .endCell();
        
        // Создаём тело перевода (transfer) с op 0xf8a7ea5
        const transferBody = beginCell()
            .storeUint(0xf8a7ea5, 32)      // op: transfer
            .storeUint(0, 64)              // query_id: 0
            .storeCoins(BigInt(amountNano)) // amount в нано
            .storeAddress(destAddr)        // destination
            .storeAddress(responseAddr)     // response_destination
            .storeBit(0)                   // custom_payload: null
            .storeCoins(1)                 // forward_amount: 1 нано (минимально для комментария)
            .storeBit(1)                   // forward_payload присутствует
            .storeRef(commentCell)         // ссылка на ячейку с комментарием
            .endCell();
        
        // Кодируем в base64
        const boc = transferBody.toBoc();
        const payload = boc.toString('base64');
        
        console.log('✅ Payload создан, длина:', payload.length);
        
        res.json({ success: true, payload });
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Эндпоинт для проверки работы сервера
app.get('/ping', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
