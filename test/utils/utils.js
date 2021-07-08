// simulate mulDiv solidity precision math library function with BN
const mulDivBNv07 = (x, y, z) => {
  let a = x.div(z); // truncate
  let b = x.mod(z); // x = a * z + b
  let c = y.div(z); // truncate
  let d = y.mod(z); // y = c * z + d
  return a.mul(c).mul(z).add(a.mul(d)).add(b.mul(c)).add(b.mul(d).div(z));
};

const mulDivBN = (x, y, z) => x.mul(y).div(z);

const advanceTime = (time) => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [time],
        id: new Date().getTime(),
      },
      (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      }
    );
  });
};

const advanceBlock = () => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_mine",
        id: new Date().getTime(),
      },
      (err, result) => {
        if (err) {
          return reject(err);
        }
        const newBlockHash = web3.eth.getBlock("latest").hash;

        return resolve(newBlockHash);
      }
    );
  });
};

const advanceTimeAndBlock = async (time) => {
  await advanceTime(time);
  await advanceBlock();

  return Promise.resolve(web3.eth.getBlock("latest"));
};

module.exports = { mulDivBN, advanceTimeAndBlock };
