const {
  getPrivateAndPublicKeyFromPassphrase,
} = require("@liskhq/lisk-cryptography");
const { signTransaction, convertBeddowsToLSK, convertLSKToBeddows } = require("@liskhq/lisk-transactions");
const { codec } = require("@liskhq/lisk-codec");
const { objects } = require("@liskhq/lisk-utils");

const baseAssetSchema = {
  $id: 'lisk/base-transaction',
  type: 'object',
  required: ['moduleID', 'assetID', 'nonce', 'fee', 'senderPublicKey', 'asset'],
  properties: {
      moduleID: {
          dataType: 'uint32',
          fieldNumber: 1,
      },
      assetID: {
          dataType: 'uint32',
          fieldNumber: 2,
      },
      nonce: {
          dataType: 'uint64',
          fieldNumber: 3,
      },
      fee: {
          dataType: 'uint64',
          fieldNumber: 4,
      },
      senderPublicKey: {
          dataType: 'bytes',
          fieldNumber: 5,
      },
      asset: {
          dataType: 'bytes',
          fieldNumber: 6,
      },
      signatures: {
          type: 'array',
          items: {
              dataType: 'bytes',
          },
          fieldNumber: 7,
      },
  },
};

const transferAssetSchema = {
  $id: "lisk/transfer-asset",
  title: "Transfer transaction asset",
  type: "object",
  required: ["amount", "recipientAddress", "data"],
  properties: {
    amount: {
      dataType: "uint64",
      fieldNumber: 1,
    },
    recipientAddress: {
      dataType: "bytes",
      fieldNumber: 2,
      minLength: 20,
      maxLength: 20,
    },
    data: {
      dataType: "string",
      fieldNumber: 3,
      minLength: 0,
      maxLength: 64,
    },
  },
};

const getFullAssetSchema = (assetSchema) => objects.mergeDeep({}, baseAssetSchema, {
  properties: { asset: assetSchema },
})

const transfer = ({
  recipientAddress,
  amount,
  passphrase,
  fee,
  nonce,
  networkIdentifier,
}) => {
  const { publicKey } = getPrivateAndPublicKeyFromPassphrase(passphrase);

  const {id, ...rest} = signTransaction(
    transferAssetSchema,
    {
      moduleID: 2,
      assetID: 0,
      nonce: BigInt(nonce),
      fee: BigInt(fee),
      senderPublicKey: publicKey,
      asset: { amount: BigInt(amount), recipientAddress, data: "" },
    },
    networkIdentifier,
    passphrase
  );

  return [id, codec.toJSON(getFullAssetSchema(transferAssetSchema), rest)];
};

module.exports = {
  transfer,
  convertBeddowsToLSK,
  convertLSKToBeddows
};
