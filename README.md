# Momentum Trading Bot

A customized automated trading bot that operates on the Sui network through the [Momentum](https://app.mmt.finance/leaderboard) platform. This bot supports multi-account management and automated trade execution with customized trading pairs and cycles.

*This project is a modified version of [fcmfcm1999/momentum](https://github.com/fcmfcm1999/momentum/tree/main) with additional features and customizations.*

## Features

- 🔄 Automated trading with multiple swap pairs
- 💱 Support for SUI/USDC, SUI/WAL, SUI/STSUI trading pairs
- ⚡ Automatic retry mechanism for network errors
- 🔁 Configurable daily trading cycles (default: 5 cycles)
- 📊 Detailed balance and transaction reporting
- ⏱️ Random waiting periods between trades to avoid detection

## Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/momentum-bot.git
cd momentum-bot
```

2. Install dependencies
```bash
npm install
```

## Configuration

Configure your account in `src/data/config.json`:

```json
{
  "shuffleAccounts": false,
  "shuffleTokenPairs": false,
  "accounts": [
    {
      "nickname": "Your Account Name",
      "suiPrivateKey": "your_sui_private_key_here"
    }
  ]
}
```

## Swap Flow

The bot follows this predefined swap sequence in each cycle:

1. SUI → USDC (3 SUI)
2. USDC → SUI (maximum available)
3. SUI → WAL (3 SUI)
4. WAL → SUI (maximum available)
5. SUI → STSUI (3 SUI)
6. STSUI → SUI (maximum available)

Each cycle completes all these swaps in sequence, with configurable amounts.

## Usage

Run the bot with:

```bash
node src/index.js
```

The bot will:
1. Display your account information
2. Run 5 complete swap cycles
3. Handle network errors with automatic retries
4. Wait 5-15 minutes between cycles

## Customization

### Changing Swap Amounts

Modify the `swapSequence` array in `index.js` to adjust the amounts:

```javascript
const swapSequence = [
    { name: "SUI_USDC", amount: 3, isReverse: false },  // Change 3 to your desired amount
    { name: "USDC_SUI", amount: 0, isReverse: true },   // 0 means use maximum available
    // Other pairs...
];
```

### Changing Number of Cycles

To run a different number of cycles, change the `totalCycles` constant in `index.js`:

```javascript
const totalCycles = 5; // Change to your desired number of cycles
```

## Project Structure

```
📦src
 ┣ 📂api
 ┃ ┗ 📜api.js
 ┣ 📂data
 ┃ ┗ 📜config.json
 ┣ 📂enum
 ┃ ┣ 📜CoinType.js
 ┃ ┗ 📜PoolType.js
 ┣ 📂image
 ┃ ┗ 📜preview.jpg
 ┣ 📂services
 ┃ ┣ 📜AccountService.js
 ┃ ┣ 📜PoolService.js
 ┃ ┗ 📜TradeSerivce.js
 ┣ 📂utils
 ┃ ┣ 📜DateUtil.js
 ┃ ┣ 📜TimeUtil.js
 ┃ ┣ 📜TransactionUtil.js
 ┃ ┗ 📜Util.js
 ┗ 📜index.js
```

## Advanced Features

### Network Error Handling

The bot includes a retry mechanism for network errors:

```javascript
async function executeWithRetry(fn, retries = 3, delay = 5000) {
    // Retry logic for network errors
}
```

### Minimizing Token Leftovers

The bot is optimized to use maximum available balances for reverse swaps while keeping minimal leftovers:

- For USDC: Leaves only 0.01 USDC
- For WAL: Leaves only 0.001 WAL
- For STSUI: Leaves only 0.0001 STSUI

## Credits

This project is based on the [Momentum Trading Bot by fcmfcm1999](https://github.com/fcmfcm1999/momentum/tree/main), with significant customizations to support additional trading pairs and automated trading cycles.

## Disclaimer

This project is for educational purposes only. Use at your own risk. The developers are not responsible for any financial losses incurred through the use of this software.
