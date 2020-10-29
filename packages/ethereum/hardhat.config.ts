// load env variables
require('dotenv').config()
// load hardhat plugins
import 'hardhat-typechain'
import '@nomiclabs/hardhat-truffle5'
import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-solhint'

import { HardhatUserConfig, task, types } from 'hardhat/config'
import { NODE_SEEDS, BOOTSTRAP_SEEDS } from '@hoprnet/hopr-demo-seeds'
import Web3 from 'web3'
import { mapValues } from 'lodash'
import { MigrationOptions, getRpcOptions } from './scripts/utils/networks'

const { PRIVATE_KEY, INFURA, MATIC_VIGIL, ETHERSCAN } = process.env

const publicNetworks: HardhatUserConfig['networks'] = mapValues(
  getRpcOptions({ infura: INFURA, maticvigil: MATIC_VIGIL }),
  (config) =>
    ({
      chainId: config.chainId,
      url: config.httpUrl,
      gasMultiplier: 1.1,
      accounts: [PRIVATE_KEY]
    } as HardhatUserConfig['networks']['hardhat'])
)

const devSeeds = NODE_SEEDS.concat(BOOTSTRAP_SEEDS).map((privateKey) => ({
  privateKey,
  balance: Web3.utils.toWei('10000', 'ether')
}))

const hardhatConfig: HardhatUserConfig = {
  defaultNetwork: 'localhost',
  networks: {
    hardhat: {
      accounts: devSeeds
    },
    localhost: {
      url: 'http://localhost:8545',
      accounts: devSeeds.map(({ privateKey }) => privateKey)
    },
    ...publicNetworks
  },
  solidity: {
    version: '0.6.6',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './hardhat/cache',
    artifacts: './hardhat/artifacts'
  },
  typechain: {
    outDir: './types',
    target: 'truffle-v5'
  },
  etherscan: {
    apiKey: ETHERSCAN
  }
}

// create our own migration task since there isn't one implemented
// see https://github.com/nomiclabs/hardhat/issues/381
task('migrate', 'Migrate contracts', async (...args: any[]) => {
  // lazy load this as it breaks hardhat due to '@openzeppelin/test-helpers'
  // also required because we need to build typechain first
  return (await import('./scripts/migrate')).default(args[0], args[1], args[2])
})
  .addOptionalParam<MigrationOptions['shouldVerify']>(
    'shouldVerify',
    'Try to verify contracts using etherscan',
    false,
    types.boolean
  )
  .addOptionalParam<MigrationOptions['mintUsing']>(
    'mintUsing',
    'Mint using "minter" or "faucet"',
    'minter',
    types.string
  )
  .addOptionalParam<MigrationOptions['revokeRoles']>(
    'revokeRoles',
    'Revoke admin roles from deployer',
    false,
    types.boolean
  )

task('fund', 'Fund demo accounts', async (...args: any[]) => {
  return (await import('./scripts/fund')).default(args[0], args[1], args[2])
})
  .addParam<string>('address', 'HoprToken contract address', undefined, types.string)
  .addOptionalParam<string>('amount', 'Amount of HOPR to fund', Web3.utils.toWei('1000000', 'ether'), types.string)
  .addOptionalParam<string[]>('accounts', 'Accounts to fund', [], types.json)

export default hardhatConfig
