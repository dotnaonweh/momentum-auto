import { CoinType } from "../enum/CoinType.js";

const decimals = {
  [CoinType.SUI]: 9,
  [CoinType.USDC]: 6,
  [CoinType.USDT]: 6,
  [CoinType.WAL]: 8,
  [CoinType.STSUI]: 9,
};

/**
 * Get recommended gas configuration and set it to tx
 * @param client
 * @param {TransactionBlock} tx
 */
export async function estimateGasCostAndSet(client, tx) {
  // Dry run to estimate gas usage
  const dryRunResult = await client.dryRunTransactionBlock({
    transactionBlock: await tx.build({ client }),
  });

  const gasUsed = dryRunResult.effects.gasUsed;
  const gasPrice = await client.getReferenceGasPrice();

  // Recommended budget: usually advised to multiply by a buffer, e.g. × 1.2
  const gasBudget =
    ((BigInt(gasUsed.computationCost) +
      BigInt(gasUsed.storageCost) -
      BigInt(gasUsed.storageRebate)) *
      120n) /
    100n;

  // Set back to tx
  tx.setGasPrice(gasPrice);
  tx.setGasBudget(gasBudget);
}

export async function getCoinObjects(client, keypair, coinAddress) {
  const objects = await client.getCoins({
    owner: keypair.toSuiAddress(),
    coinType: coinAddress,
  });

  if (objects.data.length === 0) {
    console.error("No related coin objects for this address");
    throw new Error("No related coin objects for this address");
  }

  return objects.data;
}

export async function getCoinBalance(client, keypair, coinAddress) {
  const coinObjects = await getCoinObjects(client, keypair, coinAddress);
  return coinObjects.reduce((acc, it) => acc + BigInt(it.balance), 0n);
}

export async function getFormatCoinBalance(client, keypair, coinAddress) {
  const balance = await getCoinBalance(client, keypair, coinAddress);
  return formatAmount(balance, decimals[coinAddress]);
}

export function formatBalanceChange(balanceChanges, sourceCoin, targetCoin) {
  const sourceCoinAmount = BigInt(
    Math.abs(
      balanceChanges.filter((it) => it.coinType === sourceCoin)[0].amount
    )
  );
  const targetCoinAmount = BigInt(
    Math.abs(
      balanceChanges.filter((it) => it.coinType === targetCoin)[0].amount
    )
  );
  return [
    formatAmount(sourceCoinAmount, decimals[sourceCoin]),
    formatAmount(targetCoinAmount, decimals[targetCoin]),
  ];
}

function formatAmount(amount, decimals) {
  const amt = BigInt(amount);
  const factor = 10n ** BigInt(decimals);
  const whole = amt / factor;
  const fraction = amt % factor;

  if (fraction === 0n) return whole.toString();

  const fracStr = fraction
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}
