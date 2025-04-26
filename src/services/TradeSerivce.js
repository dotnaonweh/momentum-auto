import { TransactionBlock } from "@mysten/sui.js/transactions";
import { CoinType, getTokenNameByAddress } from "../enum/CoinType.js";
import {
  formatBalanceChange,
  getCoinObjects,
  getCoinBalance,
} from "../utils/TransactionUtil.js";
import { PoolType } from "../enum/PoolType.js";
import { sleepRandomSeconds } from "../utils/TimeUtil.js";
import chalk from "chalk";
import { formatToBeijingTime } from "../utils/DateUtil.js";
import { getLeaderboardInfo } from "../api/api.js";

// Single swap without automatic reversal
export async function simpleTrade(
  client,
  keypair,
  pool,
  amount,
  isReverse = false
) {
  try {
    let swapAmount;
    const sourceCoin = isReverse ? pool.tokenB : pool.tokenA;

    if (amount) {
      // If amount is specified, use it
      const balance = await getCoinBalance(client, keypair, sourceCoin);
      const decimals = getTokenDecimals(sourceCoin);
      const amountWithDecimal = BigInt(amount * 10 ** decimals);

      if (balance < amountWithDecimal) {
        throw new Error(
          chalk.red(
            `❌ Insufficient ${getTokenNameByAddress(
              sourceCoin
            )} balance. Available: ${balance}, Required: ${amountWithDecimal}`
          )
        );
      }
      swapAmount = amountWithDecimal;
    } else {
      // If no amount specified, use maximum available balance with optimized logic
      const balance = await getCoinBalance(client, keypair, sourceCoin);

      // Different handling based on token type
      if (sourceCoin === CoinType.SUI) {
        // For SUI, leave 10% for gas
        swapAmount = (balance * 90n) / 100n;
      } else if (sourceCoin === CoinType.USDC) {
        // For USDC (6 decimals), try to use all except 0.01 USDC
        const minLeftover = BigInt(10000); // 0.01 USDC
        swapAmount = balance > minLeftover ? balance - minLeftover : 0n;
      } else if (sourceCoin === CoinType.WAL) {
        // For WAL (8 decimals), try to use all except 0.001 WAL
        const minLeftover = BigInt(100000); // 0.001 WAL
        swapAmount = balance > minLeftover ? balance - minLeftover : 0n;
      } else if (sourceCoin === CoinType.STSUI) {
        // For STSUI (9 decimals), try to use all except 0.0001 STSUI
        const minLeftover = BigInt(100000); // 0.0001 STSUI
        swapAmount = balance > minLeftover ? balance - minLeftover : 0n;
      } else {
        // For other tokens, use 99% to minimize leftover
        swapAmount = (balance * 99n) / 100n;
      }

      console.log(
        chalk.blue(
          `ℹ️ Using ${swapAmount} out of ${balance} ${getTokenNameByAddress(
            sourceCoin
          )} (maximum available)`
        )
      );
    }

    if (swapAmount <= 0n) {
      throw new Error(
        chalk.red(`❌ Swap amount is zero or negative: ${swapAmount}`)
      );
    }

    const result = await executeTrade(
      client,
      keypair,
      pool,
      swapAmount,
      isReverse
    );
    return result;
  } catch (error) {
    console.log(chalk.red(`❌ Error during trade: ${error.message}`));
    return false;
  }
}

// Helper function to get token decimals
function getTokenDecimals(coinType) {
  switch (coinType) {
    case CoinType.SUI:
    case CoinType.STSUI:
      return 9;
    case CoinType.USDC:
    case CoinType.USDT:
      return 6;
    case CoinType.WAL:
      return 8;
    default:
      return 9; // Default to 9 decimals if unknown
  }
}

async function calculateSwapAmount(client, keypair, pool, isReverse) {
  const sourceCoin = isReverse ? pool.tokenB : pool.tokenA;
  const coinObjects = await getCoinObjects(client, keypair, sourceCoin);
  let amount = coinObjects.reduce((acc, it) => acc + BigInt(it.balance), 0n);
  return amount;
}

async function mergeSourceCoins(
  client,
  keypair,
  sourceTokenAddress,
  tx,
  amount
) {
  const coins = await getCoinObjects(client, keypair, sourceTokenAddress);
  if (coins.length > 1) {
    tx.mergeCoins(
      tx.object(coins[0].coinObjectId),
      coins.slice(1).map((it) => tx.object(it.coinObjectId))
    );
  }

  return tx.splitCoins(tx.object(coins[0].coinObjectId), [amount]);
}

export async function executeTrade(client, keypair, pool, amount, isReverse) {
  const sourceCoin = isReverse ? pool.tokenB : pool.tokenA;
  const targetCoin = isReverse ? pool.tokenA : pool.tokenB;

  console.log(
    chalk.blue(
      `🔄 Swapping ${amount} ${getTokenNameByAddress(
        sourceCoin
      )} to ${getTokenNameByAddress(targetCoin)}...`
    )
  );

  const tx = new TransactionBlock();

  // ==== Inputs ====
  const splitAmount = tx.pure.u64(amount);

  const sharedPool = tx.sharedObjectRef({
    objectId: pool.packageId,
    initialSharedVersion: pool.initialSharedVersion,
    mutable: true,
  });
  const isReverseObj = tx.pure.bool(!isReverse);
  const simulate = tx.pure.bool(true);
  const quantity = tx.pure.u64(amount);
  const poolParameter = tx.pure.u128(
    isReverse ? pool.reverseParameter : pool.parameter
  );

  const clock = tx.sharedObjectRef({
    objectId:
      "0x0000000000000000000000000000000000000000000000000000000000000006",
    initialSharedVersion: 1,
    mutable: false,
  });
  const market = tx.sharedObjectRef({
    objectId:
      "0x2375a0b1ec12010aaea3b2545acfa2ad34cfbba03ce4b59f4c39e1e25eed1b2a",
    initialSharedVersion: 499761252,
    mutable: false,
  });
  const revertOnSlippage = tx.pure.bool(!isReverse);
  const recipient = tx.pure.address(keypair.toSuiAddress());
  const refund = tx.pure.address(keypair.toSuiAddress());

  // ==== Transactions ====
  let splitResult;
  if (sourceCoin === CoinType.SUI) {
    splitResult = tx.splitCoins(tx.gas, [amount]);
  } else {
    splitResult = await mergeSourceCoins(
      client,
      keypair,
      sourceCoin,
      tx,
      splitAmount
    );
  }
  // flash_swap
  const [coinOut, coinDebt, coinReceived] = tx.moveCall({
    target:
      "0x70285592c97965e811e0c6f98dccc3a9c2b4ad854b3594faab9597ada267b860::trade::flash_swap",
    typeArguments: [pool.tokenA, pool.tokenB],
    arguments: [
      sharedPool,
      isReverseObj,
      simulate,
      quantity,
      poolParameter,
      clock,
      market,
    ],
  });

  // destroy_zero
  tx.moveCall({
    target: "0x2::balance::destroy_zero",
    typeArguments: [sourceCoin],
    arguments: [isReverse ? coinDebt : coinOut],
  });

  // 4 coin::zero
  const result4 = tx.moveCall({
    target: "0x2::coin::zero",
    typeArguments: [targetCoin],
  });

  // 5 swap_receipt_debts
  const result5 = tx.moveCall({
    target:
      "0x70285592c97965e811e0c6f98dccc3a9c2b4ad854b3594faab9597ada267b860::trade::swap_receipt_debts",
    arguments: [coinReceived],
  });

  // 6 coin::split source coin
  const result6 = tx.moveCall({
    target: "0x2::coin::split",
    typeArguments: [sourceCoin],
    arguments: [splitResult[0], isReverse ? result5[1] : result5[0]],
  });

  // 7 into_balance (target coin)
  const balanceTarget = tx.moveCall({
    target: "0x2::coin::into_balance",
    typeArguments: [pool.tokenA],
    arguments: [isReverse ? result4[0] : result6],
  });

  // 8 into_balance (source coin)
  const balanceSource = tx.moveCall({
    target: "0x2::coin::into_balance",
    typeArguments: [pool.tokenB],
    arguments: [isReverse ? result6 : result4[0]],
  });

  // 9 repay_flash_swap
  tx.moveCall({
    target:
      "0x70285592c97965e811e0c6f98dccc3a9c2b4ad854b3594faab9597ada267b860::trade::repay_flash_swap",
    typeArguments: [pool.tokenA, pool.tokenB],
    arguments: [sharedPool, coinReceived, balanceTarget, balanceSource, market],
  });

  // 10 slippage_check
  tx.moveCall({
    target:
      "0x8add2f0f8bc9748687639d7eb59b2172ba09a0172d9e63c029e23a7dbdb6abe6::slippage_check::assert_slippage",
    typeArguments: [pool.tokenA, pool.tokenB],
    arguments: [sharedPool, poolParameter, revertOnSlippage],
  });

  // coin::from_balance (target)
  const [coinToTransfer] = tx.moveCall({
    target: "0x2::coin::from_balance",
    typeArguments: [targetCoin],
    arguments: [isReverse ? coinOut : coinDebt],
  });

  // Transfer coin to recipient
  tx.transferObjects([splitResult], recipient);

  // coin::value
  const [coinValue] = tx.moveCall({
    target: "0x2::coin::value",
    typeArguments: [targetCoin],
    arguments: [coinToTransfer],
  });

  // Transfer value object
  tx.transferObjects([coinToTransfer], refund);

  // ==== Done ====
  try {
    const result = await client.signAndExecuteTransactionBlock({
      signer: keypair,
      transactionBlock: tx,
      options: {
        showEffects: true,
        showBalanceChanges: true,
      },
    });

    if (result.effects?.status.status !== "success") {
      throw new Error(`${result.effects?.status.error}`);
    }

    console.log(
      chalk.green(
        `✅ Transaction successful! Hash: ${chalk.white(result.digest)}`
      )
    );

    // Try to display balance changes if available
    try {
      if (result.balanceChanges && result.balanceChanges.length >= 2) {
        // Find the source and target coin balance changes
        const sourceChange = result.balanceChanges.find(
          (bc) => bc.coinType === sourceCoin
        );
        const targetChange = result.balanceChanges.find(
          (bc) => bc.coinType === targetCoin
        );

        if (sourceChange && targetChange) {
          const sourceAmount = Math.abs(Number(sourceChange.amount));
          const targetAmount = Math.abs(Number(targetChange.amount));

          console.log(
            chalk.blue(
              `💰 Sent: ${sourceAmount} ${getTokenNameByAddress(sourceCoin)}`
            )
          );
          console.log(
            chalk.blue(
              `💰 Received: ${targetAmount} ${getTokenNameByAddress(
                targetCoin
              )}`
            )
          );
        }
      }
    } catch (formatError) {
      console.log(
        chalk.yellow(
          `⚠️ Could not format balance changes, but transaction was successful`
        )
      );
    }

    return true;
  } catch (error) {
    console.log(
      chalk.red(
        `❌ Transaction failed! From ${chalk.cyan(
          getTokenNameByAddress(sourceCoin)
        )} to ${chalk.cyan(
          getTokenNameByAddress(targetCoin)
        )} | Error: ${chalk.white(error.message)}`
      )
    );
    return false;
  }
}

export async function getLatestFlashSwapTime(client, address) {
  const targetPackage =
    "0x70285592c97965e811e0c6f98dccc3a9c2b4ad854b3594faab9597ada267b860";
  const targetModule = "trade";
  const targetFunction = "flash_swap";

  const txs = await client.queryTransactionBlocks({
    filter: { FromAddress: address },
    order: "descending",
    limit: 50,
  });

  const txDetails = await client.multiGetTransactionBlocks({
    digests: txs.data.map((it) => it.digest),
    options: { showInput: true },
  });

  for (const txDetail of txDetails) {
    const transactionCommands =
      txDetail.transaction.data.transaction.transactions;

    const hasFlashSwap = transactionCommands.some((command) => {
      // Check if MoveCall exists and matches package, module and function
      return (
        command.MoveCall &&
        command.MoveCall.package === targetPackage &&
        command.MoveCall.module === targetModule &&
        command.MoveCall.function === targetFunction
      );
    });

    if (hasFlashSwap) {
      return formatToBeijingTime(Number(txDetail.timestampMs));
    }
  }

  return null;
}

export async function getTradeVolume(address) {
  const leaderBoardInfo = await getLeaderboardInfo(address);
  if (!leaderBoardInfo && !leaderBoardInfo.userData) {
    return "Unknown";
  }
  return leaderBoardInfo.userData.volume;
}
