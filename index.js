const express = require('express');
const cors = require('cors');
const TonWeb = require('tonweb');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Эндпоинт для создания JettonTransfer payload
app.post('/create-payload', async (req, res) => {
    try {
        const { jettonWallet, destination, amountNano, responseAddress, comment } = req.body;
        
        console.log('📥 Получен запрос:', { jettonWallet, destination, amountNano, responseAddress, comment });
        
        // Парсим адреса
        const jettonWalletAddr = new TonWeb.Address(jettonWallet);
        const destAddr = new TonWeb.Address(destination);
        const responseAddr = new TonWeb.Address(responseAddress);
        
        // Создаём тело перевода
        const transferBody = new TonWeb.boc.Cell();
        transferBody.bits.writeUint(0xf8a7ea5, 32); // op transfer
        transferBody.bits.writeUint(0, 64); // query_id
        transferBody.bits.writeCoins(amountNano); // amount
        transferBody.bits.writeAddress(destAddr); // destination
        transferBody.bits.writeAddress(responseAddr); // response_destination
        transferBody.bits.writeBit(0); // custom_payload null
        transferBody.bits.writeCoins(1); // forward_amount
        
        // Добавляем комментарий
        const commentCell = new TonWeb.boc.Cell();
        commentCell.bits.writeUint(0, 32);
        commentCell.bits.writeString(comment);
        transferBody.bits.writeBit(1);
        transferBody.bits.writeRef(commentCell);
        
        // Кодируем в base64
        const boc = transferBody.toBoc();
        const payload = TonWeb.utils.bytesToBase64(boc);
        
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