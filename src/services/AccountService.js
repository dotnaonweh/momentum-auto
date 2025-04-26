import { getFormatCoinBalance } from "../utils/TransactionUtil.js";
import { CoinType } from "../enum/CoinType.js";
import { getLatestFlashSwapTime } from "./TradeSerivce.js";
import chalk from "chalk";
import { decodeSuiPrivateKey } from "@mysten/sui.js/cryptography";
import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import Table from "cli-table3";

export const getAccountsInfo = async (client, accounts) => {
  const accountsInfo = [];

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const { secretKey } = decodeSuiPrivateKey(account.suiPrivateKey);
    const keypair = Ed25519Keypair.fromSecretKey(secretKey);
    const address = keypair.toSuiAddress();

    const lastSwapTime = await getLatestFlashSwapTime(client, address);
    const suiBalance = await getFormatCoinBalance(
      client,
      keypair,
      CoinType.SUI
    );
    const usdcBalance = await getFormatCoinBalance(
      client,
      keypair,
      CoinType.USDC
    );
    const walBalance = await getFormatCoinBalance(
      client,
      keypair,
      CoinType.WAL
    );
    const stsuiBalance = await getFormatCoinBalance(
      client,
      keypair,
      CoinType.STSUI
    );

    const formattedTime = lastSwapTime ? lastSwapTime : "No record";

    accountsInfo.push([
      i + 1,
      account.nickname || "Not set",
      address,
      suiBalance,
      usdcBalance,
      walBalance,
      stsuiBalance,
      formattedTime,
    ]);
  }
  return accountsInfo;
};

export const showAccountInfo = (accountsInfo) => {
  const table = new Table({
    head: [
      "No.",
      "Note",
      "Address",
      "SUI",
      "USDC",
      "WAL",
      "STSUI",
      "Last Swap Time",
    ],
    style: {
      head: ["cyan"],
      border: ["gray"],
    },
    colWidths: [5, 10, 65, 10, 10, 10, 10, 25],
    chars: {
      top: "─",
      "top-mid": "┬",
      "top-left": "┌",
      "top-right": "┐",
      bottom: "─",
      "bottom-mid": "┴",
      "bottom-left": "└",
      "bottom-right": "┘",
      left: "│",
      "left-mid": "",
      mid: "",
      "mid-mid": "",
      right: "│",
      "right-mid": "",
      middle: "│",
    },
    wordWrap: true,
  });

  table.push(...accountsInfo);
  console.log(table.toString());
};
