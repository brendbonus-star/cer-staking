import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { TonClient, Address, beginCell, WalletContractV4, internal } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { initDb, getDb } from './db.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const client = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.API_KEY
});

let db;
let wallet;

// ===== ИНИЦИАЛИЗАЦИЯ =====
async function init() {
    db = await initDb();
    
    // Загружаем кошелек из сид-фразы
    const mnemonic = process.env.TRANSIT_MNEMONIC.split(' ');
    const key = await mnemonicToPrivateKey(mnemonic);
    wallet = WalletContractV4.create({ publicKey: key.publicKey, workchain: 0 });
    
    console.log('Transit wallet address:', wallet.address.toString());
    
    // Запускаем опрос транзакций
    setInterval(checkTransactions, 30000);
    await checkTransactions(); // сразу при старте
}

// ===== ПОЛУЧЕНИЕ КОММЕНТАРИЯ ИЗ FORWARD_PAYLOAD =====
function parseComment(cell) {
    try {
        const slice = cell.beginParse();
        const op = slice.loadUint(32);
        if (op !== 0) return null;
        return slice.loadStringTail();
    } catch (e) {
        return null;
    }
}

// ===== ПАРСИНГ JETTON-ТРАНЗАКЦИИ =====
async function parseJettonTransfer(tx) {
    // Проверяем, что это входящая Jetton-транзакция
    if (!tx.in_msg?.source || !tx.in_msg?.msg_data?.body) return null;
    
    // Проверяем, что сообщение пришло от Jetton-кошелька
    const jettonWallet = tx.in_msg.source;
    
    // Декодируем тело
    const bodyCell = Cell.fromBoc(Buffer.from(tx.in_msg.msg_data.body, 'base64'))[0];
    const slice = bodyCell.beginParse();
    const op = slice.loadUint(32);
    
    // opcode transfer_notification = 0x7362d09c
    if (op !== 0x7362d09c) return null;
    
    const queryId = slice.loadUint(64);
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
}

// ===== ВЫЗОВ КОНТРАКТА =====
async function callContract(method, params) {
    const seqno = await wallet.getSeqno(client);
    const transfer = await wallet.createTransfer({
        seqno,
        secretKey: key.secretKey,
        messages: [
            internal({
                to: process.env.CONTRACT_ADDRESS,
                value: '0.01',
                body: params.body,
                bounce: true
            })
        ]
    });
    await client.sendExternalMessage(transfer);
    return true;
}

// ===== ОБРАБОТКА КОММЕНТАРИЕВ =====
async function processComment(comment, from, amount) {
    const leaderAddress = process.env.LEADER_ADDRESS;
    
    // Стейкинг
    if (['30', '90', '180', '365'].includes(comment)) {
        const days = parseInt(comment);
        const body = beginCell()
            .storeUint(0, 32) // opcode для StakeData
            .storeAddress(Address.parse(from))
            .storeCoins(BigInt(Math.floor(amount * 1e9)))
            .storeUint(days, 32)
            .endCell();
        
        await callContract('stake', { body });
        console.log(`Stake: ${amount} CER for ${days} days from ${from}`);
    }
    
    // Unstake
    else if (comment === '0') {
        const body = beginCell().storeUint(0, 32).storeStringTail('unstake').endCell();
        await callContract('unstake', { body });
        console.log(`Unstake from ${from}`);
    }
    
    // Пополнение пула (только лидер)
    else if (comment === '777' && from === leaderAddress) {
        const body = beginCell().storeUint(0, 32).storeStringTail('addReward').endCell();
        await callContract('addReward', { body });
        console.log(`Reward pool increased by ${amount} CER`);
    }
    
    // Изменение ставки (только лидер)
    else if (comment.startsWith('rate') && from === leaderAddress) {
        const match = comment.match(/rate(\d+):(\d+)/);
        if (match) {
            const period = parseInt(match[1]);
            const newRate = parseInt(match[2]);
            const body = beginCell()
                .storeUint(0, 32)
                .storeStringTail(`setMaxRate:${newRate}`)
                .endCell();
            await callContract('setMaxRate', { body });
            console.log(`Rate for ${period} days changed to ${newRate}`);
        }
    }
    
    // Аварийный вывод
    else if (comment === '9999') {
        const body = beginCell().storeUint(0, 32).storeStringTail('emergencyWithdraw').endCell();
        await callContract('emergencyWithdraw', { body });
        console.log(`Emergency withdraw from ${from}`);
    }
    
    // Вывод пула (только лидер)
    else if (comment === '778' && from === leaderAddress) {
        const body = beginCell().storeUint(0, 32).storeStringTail('withdrawPool').endCell();
        await callContract('withdrawPool', { body });
        console.log(`Pool withdrawn by leader`);
    }
    
    // Аварийный вывод пула (только лидер)
    else if (comment === '7777' && from === leaderAddress) {
        const body = beginCell().storeUint(0, 32).storeStringTail('emergencyWithdrawPool').endCell();
        await callContract('emergencyWithdrawPool', { body });
        console.log(`Emergency pool withdraw by leader`);
    }
    
    else {
        console.log(`Unknown comment: ${comment} from ${from}`);
    }
}

// ===== ОПРОС ТРАНЗАКЦИЙ =====
async function checkTransactions() {
    try {
        const url = `https://toncenter.com/api/v2/getTransactions?address=${process.env.TRANSIT_ADDRESS}&limit=10&api_key=${process.env.API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.ok) return;
        
        for (const tx of data.result) {
            // Проверяем, не обрабатывали ли уже эту транзакцию
            const exists = await db.get('SELECT 1 FROM processed_txs WHERE tx_hash = ?', [tx.transaction_id.hash]);
            if (exists) continue;
            
            const jettonData = await parseJettonTransfer(tx);
            if (jettonData) {
                await processComment(jettonData.comment, jettonData.from, jettonData.amount);
            }
            
            // Отмечаем как обработанную
            await db.run('INSERT INTO processed_txs (tx_hash) VALUES (?)', [tx.transaction_id.hash]);
        }
    } catch (e) {
        console.error('Error checking transactions:', e);
    }
}

// ===== ЭНДПОИНТЫ ДЛЯ MINI APP =====
app.get('/reward_pool', async (req, res) => {
    try {
        const result = await client.runMethod(process.env.CONTRACT_ADDRESS, 'getRewardPool', []);
        const pool = Number(result.stack[0].value) / 1e9;
        res.json({ rewardPool: pool });
    } catch (e) {
        res.json({ rewardPool: 0 });
    }
});

app.get('/rates', async (req, res) => {
    try {
        const result30 = await client.runMethod(process.env.CONTRACT_ADDRESS, 'getRate30', []);
        const result90 = await client.runMethod(process.env.CONTRACT_ADDRESS, 'getRate90', []);
        const result180 = await client.runMethod(process.env.CONTRACT_ADDRESS, 'getRate180', []);
        const result365 = await client.runMethod(process.env.CONTRACT_ADDRESS, 'getRate365', []);
        res.json({
            rate30: Number(result30.stack[0].value),
            rate90: Number(result90.stack[0].value),
            rate180: Number(result180.stack[0].value),
            rate365: Number(result365.stack[0].value)
        });
    } catch (e) {
        res.json({ rate30: 0, rate90: 0, rate180: 0, rate365: 0 });
    }
});

app.get('/stake/:address/:id', async (req, res) => {
    // Возвращает данные конкретного стейка
    // TODO: реализовать
    res.json({});
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
    init();
});
