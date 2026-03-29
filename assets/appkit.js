import { AppKit, Network, transferJetton, getBalance } from 'https://unpkg.com/@ton/appkit@0.0.1-alpha.5/dist/index.mjs';

const appKit = new AppKit({
    network: Network.mainnet(),
    apiKey: 'ваш-ключ-от-toncenter'
});

export async function stakeCer(userAddress, amount, period) {
    const result = await transferJetton(appKit, {
        from: userAddress,
        to: 'EQDChXJt60bhVjLmBE6xGxZKYJvkJrB2F7CGANsojF-lY3Lk',
        amount: amount,
        jettonMaster: 'EQCeFJOkajBxztRloikZ9iUHhqnymZoX3pgxY47bbVlQuA3G',
        comment: period
    });
    return result;
}
