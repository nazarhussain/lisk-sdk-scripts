const genesisBlock = require("../config/devnet/genesis_block.json");
const genesisConfig = require("../config/devnet/config.json");
const { getNetworkIdentifier } = require("@liskhq/lisk-cryptography");
const api = require("../api_clients");

const sleep = async ms => new Promise(resolve => setTimeout(resolve, ms));

const networkIdentifier = getNetworkIdentifier(
  Buffer.from(genesisBlock.header.id, "hex"),
  genesisConfig.genesisConfig.communityIdentifier
);

const getLastBlock = async () =>
  (
    await api.http.blocks.blocksGet(
      (await api.http.node.nodeInfoGet()).data.height
    )
  ).data[0];

const waitForBlock = async ({ height, heightOffset, condition }) => {
  let lastBlock = await getLastBlock();
  const targetHeight = height || lastBlock.header.height + heightOffset;
  const matcher =
    condition || ((tipOfChain) => tipOfChain.header.height < targetHeight);

  while (matcher(lastBlock)) {
    console.info(
      `Current Height: ${lastBlock.header.height}, Target Height: ${targetHeight}`
    );
    await sleep(1000);
    lastBlock = await getLastBlock();
  }

  return lastBlock;
};

module.exports = {
  getLastBlock,
  waitForBlock,
  networkIdentifier,
  sleep,
};
