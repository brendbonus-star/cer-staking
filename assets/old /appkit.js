import { AppKit, Network, transferJetton } from 'https://unpkg.com/@ton/appkit@0.0.1-alpha.5/dist/index.mjs';

const appKit = new AppKit({
    network: Network.mainnet(),
    apiKey: 'd72cd242de2de30bfad0b95f4789fa866255fb4b80aeb00040749d25ac69ebdb'
});

let connector = null;

export async function initAppKit() {
    connector = await appKit.connectors.init();
    return connector;
}

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
