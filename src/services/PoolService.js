import { TransactionBlock } from "@mysten/sui.js/transactions";
import { estimateGasCostAndSet } from "../utils/TransactionUtil.js";
import { CoinType } from "../enum/CoinType.js";

const packageId =
  "0x70285592c97965e811e0c6f98dccc3a9c2b4ad854b3594faab9597ada267b860";

async function getPositionNFT(client, keypair) {
  const address = keypair.toSuiAddress();
  const positionType = `${packageId}::position::Position`;

  try {
    const objects = await client.getOwnedObjects({
      owner: address,
      filter: {
        StructType: positionType,
      },
    });

    if (objects.data.length === 0) {
      throw new Error("Position NFT not found");
    }

    // Return the objectId of the first Position NFT found
    return objects.data[0].data.objectId;
  } catch (error) {
    console.error("Failed to get Position NFT:", error);
    throw error;
  }
}

// Get suitable gas object
// todo: merge all sui object directly
async function getSuitableGasObject(client, keypair) {
  const address = keypair.toSuiAddress();
  try {
    const objects = await client.getOwnedObjects({
      owner: address,
      filter: {
        StructType: "0x2::coin::Coin<0x2::sui::SUI>",
      },
    });

    if (objects.data.length === 0) {
      throw new Error("No available gas object found");
    }

    // // Get detailed information for each object
    // const gasObjects = await Promise.all(
    //     objects.data.map(async (obj) => {
    //         const details = await client.getObject({
    //             id: obj.data.objectId,
    //             options: { showContent: true }
    //         });
    //         return {
    //             objectId: obj.data.objectId,
    //             balance: details.data?.content?.fields?.balance || '0',
    //             digest: details.data.digest
    //         };
    //     })
    // );
    console.log(objects.data);
    // // Select the object with the largest balance
    // const suitableGas = gasObjects.reduce((max, current) => {
    //     return BigInt(current.balance) > BigInt(max.balance) ? current : max;
    // });
    //
    // console.log('Selected gas object:', suitableGas);
    return objects.data[0];
  } catch (error) {
    console.error("Failed to get gas object:", error);
    throw error;
  }
}

export async function claimPendingYield(client, keypair) {
  const tx = new TransactionBlock();

  // Get Position NFT
  const positionNFTId = await getPositionNFT(client, keypair);

  // Get suitable gas object
  const gasObject = await getSuitableGasObject(client, keypair);

  tx.setGasPayment([gasObject.data]);

  const poolObject = tx.object(
    "0x455cf8d2ac91e7cb883f515874af750ed3cd18195c970b7a2d46235ac2b0c388"
  );
  const lpObject = tx.object(positionNFTId);
  const clockObject = tx.object(
    "0x0000000000000000000000000000000000000000000000000000000000000006"
  );
  const adminObject = tx.object(
    "0x2375a0b1ec12010aaea3b2545acfa2ad34cfbba03ce4b59f4c39e1e25eed1b2a"
  );
  const recipientAddress = tx.pure(keypair.toSuiAddress());

  // First reward call
  const reward1 = tx.moveCall({
    target: `${packageId}::collect::reward`,
    typeArguments: [CoinType.SUI, CoinType.USDC, CoinType.SUI],
    arguments: [poolObject, lpObject, clockObject, adminObject],
  });

  // Second reward call
  const reward2 = tx.moveCall({
    target: `${packageId}::collect::reward`,
    typeArguments: [CoinType.SUI, CoinType.USDC, CoinType.USDC],
    arguments: [poolObject, lpObject, clockObject, adminObject],
  });

  // First TransferObjects call
  tx.transferObjects([reward1[0], reward2[0]], recipientAddress);

  // fee call
  const fee = tx.moveCall({
    target: `${packageId}::collect::fee`,
    typeArguments: [CoinType.SUI, CoinType.USDC],
    arguments: [poolObject, lpObject, clockObject, adminObject],
  });

  // Second TransferObjects call
  tx.transferObjects([fee[0], fee[1]], recipientAddress);
  // todo: remove set gas manually
  tx.setSender(keypair.toSuiAddress());
  await estimateGasCostAndSet(client, tx);

  try {
    const result = await client.signAndExecuteTransactionBlock({
      signer: keypair,
      transactionBlock: tx,
    });
    console.log("✅ Claim pool fee successfully:", result);
  } catch (error) {
    console.error("❌ Failed to claim pool fee:", error);
  }
}
