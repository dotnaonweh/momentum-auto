# Momentum Trading Bot

A customized automated trading bot that operates on the Sui network through the [Momentum](https://app.mmt.finance/leaderboard) platform. This bot supports multi-account management and automated trade execution with customized trading pairs and cycles.

*This project is a modified version of [fcmfcm1999/momentum](https://github.com/fcmfcm1999/momentum/tree/main) with additional features and customizations.*

## Features

- 🔄 Automated trading with multiple swap pairs
- 💱 Support for SUI/USDC, SUI/WAL, SUI/STSUI trading pairs
- ⚡ Automatic retry mechanism for network errors
- 🔁 Configurable daily trading cycles (default: 5 cycles)
- 👥 Support for multiple accounts in a single run
- 📊 Detailed balance and transaction reporting
- ⏱️ Random waiting periods between trades to avoid detection

## Installation

1. Clone the repository
```bash
git clone https://github.com/dotnaonweh/momentum-auto.git
cd momentum-auto
```

2. Install dependencies
```bash
npm install
```

## Configuration

Configure your accounts in `src/data/config.json`:

```json
{
  "shuffleAccounts": false,
  "shuffleTokenPairs": false,
  "accounts": [
    {
      "nickname": "Account 1",
      "suiPrivateKey": "your_first_private_key_here"
    },
    {
      "nickname": "Account 2",
      "suiPrivateKey": "your_second_private_key_here"
    }
  ]
}
```

## Swap Flow

The bot follows this predefined swap sequence in each cycle:

1. SUI → USDC (45 SUI)
2. USDC → SUI (maximum available)
3. SUI → WAL (45 SUI)
4. WAL → SUI (maximum available)
5. SUI → STSUI (45 SUI)
6. STSUI → SUI (maximum available)

Each cycle completes all these swaps in sequence, with configurable amounts.

## Usage

Run the bot with:

```bash
node src/index.js
```

The bot will:
1. Display account information for all configured accounts
2. For each account:
   - Run 5 complete swap cycles
   - Handle network errors with automatic retries
   - Wait 30 seconds between cycles
3. Process all accounts sequentially

## Customization

### Changing Swap Amounts

Modify the `swapSequence` array in `index.js` to adjust the amounts:

```javascript
const swapSequence = [
    { name: "SUI_USDC", amount: 45, isReverse: false },  // Change 45 to your desired amount
    { name: "USDC_SUI", amount: 0, isReverse: true },    // 0 means use maximum available
    // Other pairs...
];
```

### Changing Number of Cycles

To run a different number of cycles, change the `totalCycles` constant in `index.js`:

```javascript
const totalCycles = 5; // Change to your desired number of cycles
```

### Adjusting Wait Times

You can modify the waiting periods between swaps and cycles:

```javascript
// For time between cycles
async function sleepBetweenCycles() {
    const seconds = 30; // Change this value to adjust wait time
    // Rest of the function...
}

// For random wait between swaps
// Edit src/utils/TimeUtil.js
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

### Multiple Account Support

The bot can process multiple accounts sequentially:
- Runs through the complete cycle for the first account
- Moves to the next account and repeats the process
- Includes wait times between account switches

## Credits

This project is based on the [Momentum Trading Bot by fcmfcm1999](https://github.com/fcmfcm1999/momentum/tree/main), with significant customizations to support additional trading pairs, automated trading cycles, and multi-account management.

## Disclaimer

This project is for educational purposes only. Use at your own risk. The developers are not responsible for any financial losses incurred through the use of this software.
