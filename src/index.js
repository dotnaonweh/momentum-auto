import { SuiClient } from "@mysten/sui.js/client";
import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui.js/cryptography";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { simpleTrade } from "./services/TradeSerivce.js";
import { getPoolByName } from "./enum/PoolType.js";
import chalk from "chalk";
import { printAuthorInfo } from "./utils/Util.js";
import { sleepRandomSeconds } from "./utils/TimeUtil.js";
import { getAccountsInfo, showAccountInfo } from "./services/AccountService.js";

// Get the directory path of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, "data", "config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

const client = new SuiClient({ url: "https://fullnode.mainnet.sui.io:443" });

// Swap sequence to follow - adjusted for WAL and STSUI swap directions
const swapSequence = [
  { name: "SUI_USDC", amount: 45, isReverse: false }, // SUI to USDC - 45 SUI
  { name: "USDC_SUI", amount: 0, isReverse: true }, // USDC to SUI - all USDC
  { name: "WAL_SUI", amount: 45, isReverse: false }, // WAL to SUI - 45 SUI (but we'll swap SUI->WAL)
  { name: "SUI_WAL", amount: 0, isReverse: true }, // SUI to WAL - all SUI (but we'll swap WAL->SUI)
  { name: "STSUI_SUI", amount: 45, isReverse: false }, // STSUI to SUI - 45 SUI (but we'll swap SUI->STSUI)
  { name: "SUI_STSUI", amount: 0, isReverse: true }, // SUI to STSUI - all SUI (but we'll swap STSUI->SUI)
];

// Function to execute with retry for network errors
async function executeWithRetry(fn, retries = 3, delay = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (
        (error.message.includes("502") ||
          error.message.includes("network") ||
          error.message.includes("timeout") ||
          error.message.includes("connection")) &&
        i < retries - 1
      ) {
        console.log(
          chalk.yellow(
            `⚠️ Network error, retrying in ${delay / 1000} seconds... (${
              i + 1
            }/${retries})`
          )
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

// Sleep between cycles (shorter wait - 30 seconds)
async function sleepBetweenCycles() {
  const seconds = 30;
  const ms = seconds * 1000;
  console.log(
    chalk.cyan(
      `🕒 Waiting ${seconds} seconds before starting the next cycle...`
    )
  );
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSwapCycle(keypair, cycleNumber, totalCycles) {
  console.log(
    chalk.magenta(
      `\n🔄 Starting swap cycle ${cycleNumber}/${totalCycles} for address:`
    ),
    chalk.white(keypair.toSuiAddress())
  );
  console.log(chalk.gray("----------------------------------------"));

  // Execute each swap in sequence
  for (let i = 0; i < swapSequence.length; i++) {
    const swap = swapSequence[i];

    console.log(
      chalk.cyan(
        `\n💱 Starting swap ${i + 1}/${swapSequence.length}: ${chalk.white(
          swap.name
        )}`
      )
    );

    try {
      // Get the pool for this swap
      const pool = getPoolByName(swap.name);

      // Special case for WAL-SUI and STSUI-SUI swaps due to pool token order
      let actualIsReverse = swap.isReverse;

      // Both WAL and STSUI pools have reversed token order compared to their names
      if (swap.name === "WAL_SUI" || swap.name === "STSUI_SUI") {
        // For WAL to SUI or STSUI to SUI, token order is already correct in the pool
        console.log(
          chalk.yellow(`ℹ️ Adjusting swap direction for ${swap.name}`)
        );
        actualIsReverse = true;
      } else if (swap.name === "SUI_WAL" || swap.name === "SUI_STSUI") {
        // For SUI to WAL or SUI to STSUI, we need to adjust for correct token order
        console.log(
          chalk.yellow(`ℹ️ Adjusting swap direction for ${swap.name}`)
        );
        actualIsReverse = false;
      }

      // Execute the swap with retry for network errors
      const success = await executeWithRetry(
        () => simpleTrade(client, keypair, pool, swap.amount, actualIsReverse),
        3,
        8000
      );

      if (success) {
        console.log(
          chalk.green(`✅ Swap ${i + 1} completed successfully: ${swap.name}`)
        );
      } else {
        console.log(chalk.yellow(`⚠️ Swap ${i + 1} failed: ${swap.name}`));
      }
    } catch (error) {
      console.log(chalk.red(`❌ Error during swap ${i + 1}: ${error.message}`));
    }

    // Wait between swaps unless it's the last one
    if (i < swapSequence.length - 1) {
      console.log(chalk.cyan(`⏳ Waiting before the next swap...`));
      await sleepRandomSeconds();
    }
  }

  console.log(
    chalk.green(
      `\n✅ Swap cycle ${cycleNumber}/${totalCycles} completed successfully!`
    )
  );
}

async function main() {
  printAuthorInfo();

  const accountsInfo = await getAccountsInfo(client, config.accounts);
  await showAccountInfo(accountsInfo);

  // Process all accounts
  for (
    let accountIndex = 0;
    accountIndex < config.accounts.length;
    accountIndex++
  ) {
    const account = config.accounts[accountIndex];
    const suiPrivateKey = account.suiPrivateKey;
    const { schema, secretKey } = decodeSuiPrivateKey(suiPrivateKey);
    const keypair = Ed25519Keypair.fromSecretKey(secretKey);

    console.log(chalk.gray("----------------------------------------"));
    console.log(
      chalk.magenta(
        `👤 Processing account ${accountIndex + 1}/${config.accounts.length}:`
      ),
      chalk.white(keypair.toSuiAddress())
    );
    console.log(chalk.blue("🔁 Will run 5 complete swap cycles"));

    // Run 5 complete swap cycles for this account
    const totalCycles = 5;
    for (let cycle = 1; cycle <= totalCycles; cycle++) {
      await runSwapCycle(keypair, cycle, totalCycles);

      // Wait between cycles unless it's the last one
      if (cycle < totalCycles) {
        await sleepBetweenCycles();
      }
    }

    console.log(
      chalk.green(
        `✅ All processing completed for account ${
          accountIndex + 1
        }: ${keypair.toSuiAddress()}`
      )
    );

    // Wait between accounts unless it's the last one
    if (accountIndex < config.accounts.length - 1) {
      console.log(
        chalk.cyan(`⏳ Waiting before moving to the next account...`)
      );
      await sleepBetweenCycles();
    }
  }

  console.log(chalk.gray("\n----------------------------------------"));
  console.log(chalk.green(`🎉 All accounts processed successfully!`));
  console.log(chalk.blue("Thank you for using. Goodbye!"));
}

main().catch((error) => {
  console.error(chalk.red(`❌ Fatal error: ${error.message}`));
});
