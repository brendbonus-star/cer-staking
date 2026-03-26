async function parseJettonTransfer(tx) {
    // Проверяем, что это входящая Jetton-транзакция
    if (!tx.in_msg?.source || !tx.in_msg?.msg_data?.body) return null;
    
    // Проверяем, что тело транзакции не пустое
    if (!tx.in_msg.msg_data.body || tx.in_msg.msg_data.body.length === 0) return null;
    
    try {
        const bodyCell = Cell.fromBoc(Buffer.from(tx.in_msg.msg_data.body, 'base64'))[0];
        const slice = bodyCell.beginParse();
        
        // Проверяем, что в slice достаточно битов для чтения opcode
        if (slice.bits.length < 32) return null;
        
        const op = slice.loadUint(32);
        
        // opcode transfer_notification = 0x7362d09c
        if (op !== 0x7362d09c) return null;
        
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
        console.log('Skipping non-Jetton transaction');
        return null;
    }
}
