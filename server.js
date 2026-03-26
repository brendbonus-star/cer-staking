async function parseJettonTransfer(tx) {
    // Проверяем, что это входящая транзакция
    if (!tx.in_msg?.source || !tx.in_msg?.msg_data?.body) return null;
    
    // Проверяем, что тело транзакции не пустое
    if (!tx.in_msg.msg_data.body || tx.in_msg.msg_data.body.length === 0) return null;
    
    // Проверяем, что тело начинается с "te6cck" (BOC префикс)
    const bodyBase64 = tx.in_msg.msg_data.body;
    try {
        // Декодируем BOC в Cell
        const bocBuffer = Buffer.from(bodyBase64, 'base64');
        // Проверяем минимальный размер BOC
        if (bocBuffer.length < 10) return null;
        
        const cells = Cell.fromBoc(bocBuffer);
        if (cells.length === 0) return null;
        const bodyCell = cells[0];
        const slice = bodyCell.beginParse();
        
        // Проверяем, что в slice достаточно битов для чтения opcode
        if (slice.bits.length < 32) return null;
        
        const op = slice.loadUint(32);
        
        // opcode transfer_notification = 0x7362d09c
        if (op !== 0x7362d09c) return null;
        
        // Проверяем, что есть данные для queryId
        if (slice.bits.length < 96) return null;
        const queryId = slice.loadUintBig(64);
        const amount = slice.loadCoins();
        const from = slice.loadAddress();
        const maybeRef = slice.loadBit();
        const payload = maybeRef ? slice.loadRef() : slice;
        
        const comment = parseComment(payload);
        if (!comment) return null;
        
        return {
            from: from.toString(),
            amount: Number(amount) / 1e9,
            comment: comment
        };
    } catch (e) {
        // Если не удалось распарсить — пропускаем транзакцию
        return null;
    }
}
