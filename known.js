/*
 * Plainsign known-address list.
 *
 * Only add an address after checking it against the project's official docs
 * AND a block explorer. A wrong entry teaches users to trust a bad contract.
 *
 * Last verified on-chain 2026-10-30, on every chain listed for each entry:
 * - tokens: name, symbol and decimals read from the contract
 * - routers / marketplaces: the contract's own factory, version, owner or
 *   signing-domain name matches the project
 * Do not use 'all' for chains: list only chains where the address was checked.
 *
 * chains: list of chain IDs where the address means this.
 * Chain IDs: 1 Ethereum, 10 Optimism, 56 BNB Chain, 100 Gnosis, 137 Polygon,
 * 8453 Base, 42161 Arbitrum One, 43114 Avalanche.
 */
(function (global) {
  'use strict';

  // Chains where the multi-chain contracts below were checked on-chain.
  const VERIFIED_CHAINS = [1, 10, 56, 137, 8453, 42161, 43114];

  global.PLAINSIGN_KNOWN = [
    // ---------- Ethereum tokens ----------
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', name: 'USD Coin', symbol: 'USDC', decimals: 6, chains: [1] },
    { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', name: 'Tether USD', symbol: 'USDT', decimals: 6, chains: [1] },
    { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', name: 'Wrapped Ether', symbol: 'WETH', decimals: 18, chains: [1] },
    { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', name: 'Dai', symbol: 'DAI', decimals: 18, chains: [1] },
    { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', name: 'Wrapped BTC', symbol: 'WBTC', decimals: 8, chains: [1] },
    { address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', name: 'Coinbase Wrapped BTC', symbol: 'cbBTC', decimals: 8, chains: [1, 8453] },
    { address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84', name: 'Lido Staked Ether', symbol: 'stETH', decimals: 18, chains: [1] },
    { address: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0', name: 'Wrapped stETH', symbol: 'wstETH', decimals: 18, chains: [1] },
    { address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', name: 'Chainlink', symbol: 'LINK', decimals: 18, chains: [1] },
    { address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', name: 'Uniswap', symbol: 'UNI', decimals: 18, chains: [1] },
    { address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', name: 'Aave', symbol: 'AAVE', decimals: 18, chains: [1] },
    { address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933', name: 'Pepe', symbol: 'PEPE', decimals: 18, chains: [1] },

    // ---------- Base ----------
    { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', name: 'USD Coin', symbol: 'USDC', decimals: 6, chains: [8453] },
    { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', name: 'Dai', symbol: 'DAI', decimals: 18, chains: [8453] },
    { address: '0x4200000000000000000000000000000000000006', name: 'Wrapped Ether', symbol: 'WETH', decimals: 18, chains: [10, 8453] },
    { address: '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43', name: 'Aerodrome Router', chains: [8453] },

    // ---------- Arbitrum One ----------
    { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', name: 'USD Coin', symbol: 'USDC', decimals: 6, chains: [42161] },
    { address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', name: 'Bridged USDC', symbol: 'USDC.e', decimals: 6, chains: [42161] },
    { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', name: 'Tether USD (USDT0)', symbol: 'USDT0', decimals: 6, chains: [42161] },
    { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', name: 'Wrapped Ether', symbol: 'WETH', decimals: 18, chains: [42161] },
    { address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', name: 'Wrapped BTC', symbol: 'WBTC', decimals: 8, chains: [42161] },
    { address: '0x912CE59144191C1204E64559FE8253a0e49E6548', name: 'Arbitrum', symbol: 'ARB', decimals: 18, chains: [42161] },
    { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', name: 'Dai', symbol: 'DAI', decimals: 18, chains: [10, 42161] },

    // ---------- Optimism ----------
    { address: '0x0b2C639c533813f4Aa9D7837Caf62653d097Ff85', name: 'USD Coin', symbol: 'USDC', decimals: 6, chains: [10] },
    { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', name: 'Tether USD', symbol: 'USDT', decimals: 6, chains: [10] },
    { address: '0x4200000000000000000000000000000000000042', name: 'Optimism', symbol: 'OP', decimals: 18, chains: [10] },

    // ---------- Polygon ----------
    { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', name: 'USD Coin', symbol: 'USDC', decimals: 6, chains: [137] },
    { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', name: 'Bridged USDC', symbol: 'USDC.e', decimals: 6, chains: [137] },
    { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', name: 'Tether USD (USDT0)', symbol: 'USDT0', decimals: 6, chains: [137] },
    { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', name: 'Wrapped Ether', symbol: 'WETH', decimals: 18, chains: [137] },
    { address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', name: 'Wrapped POL', symbol: 'WPOL', decimals: 18, chains: [137] },
    { address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', name: 'Dai', symbol: 'DAI', decimals: 18, chains: [137] },

    // ---------- BNB Chain ----------
    { address: '0x55d398326f99059fF775485246999027B3197955', name: 'Tether USD', symbol: 'USDT', decimals: 18, chains: [56] },
    { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', name: 'USD Coin', symbol: 'USDC', decimals: 18, chains: [56] },
    { address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', name: 'Wrapped BNB', symbol: 'WBNB', decimals: 18, chains: [56] },
    { address: '0x10ED43C718714eb63d5aA57B78B54704E256024E', name: 'PancakeSwap Router v2', chains: [56] },
    { address: '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4', name: 'PancakeSwap Smart Router', chains: [56] },

    // ---------- Avalanche ----------
    { address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', name: 'USD Coin', symbol: 'USDC', decimals: 6, chains: [43114] },
    { address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', name: 'Tether USD', symbol: 'USDT', decimals: 6, chains: [43114] },
    { address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', name: 'Wrapped AVAX', symbol: 'WAVAX', decimals: 18, chains: [43114] },

    // ---------- NFT collections (Ethereum) ----------
    { address: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D', name: 'Bored Ape Yacht Club', nft: true, chains: [1] },
    { address: '0x60E4d786628Fea6478F785A6d7e704777c86a7c6', name: 'Mutant Ape Yacht Club', nft: true, chains: [1] },
    { address: '0xED5AF388653567Af2F388E6224dC7C4b3241C544', name: 'Azuki', nft: true, chains: [1] },
    { address: '0xBd3531dA5CF5857e7CfAA92426877b022e612cf8', name: 'Pudgy Penguins', nft: true, chains: [1] },

    // ---------- DEX routers, aggregators and approval contracts ----------
    { address: '0x000000000022D473030F116dDEE9F6B43aC78BA3', name: 'Uniswap Permit2', chains: VERIFIED_CHAINS },
    { address: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD', name: 'Uniswap Universal Router', chains: [1] },
    { address: '0xEf1c6E67703c7BD7107eed8303Fbe6EC2554BF6B', name: 'Uniswap Universal Router (old)', chains: [1] },
    { address: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', name: 'Uniswap V2 Router', chains: [1] },
    { address: '0xE592427A0AEce92De3Edee1F18E0157C05861564', name: 'Uniswap V3 Router', chains: [1, 10, 137, 42161] },
    { address: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', name: 'Uniswap V3 Router 2', chains: [1, 10, 137, 42161] },
    { address: '0x1111111254EEB25477B68fb85Ed929f73A960582', name: '1inch Router v5', chains: VERIFIED_CHAINS },
    { address: '0x111111125421cA6dc452d289314280a0f8842A65', name: '1inch Router v6', chains: VERIFIED_CHAINS },
    { address: '0xDef1C0ded9bec7F1a1670819833240f027b25EfF', name: '0x Exchange Proxy', chains: [1] },
    { address: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57', name: 'ParaSwap Augustus v5', chains: [1, 10, 56, 137, 42161, 43114] },
    { address: '0x6A000F20005980200259B80c5102003040001068', name: 'ParaSwap Augustus v6.2', chains: VERIFIED_CHAINS },
    { address: '0xC92E8bdf79f0507f65a392b0ab4667716BFE0110', name: 'CoW Protocol Vault Relayer', chains: [1, 100, 42161, 8453] },
    { address: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2', name: 'Aave V3 Pool', chains: [1] },

    // ---------- NFT marketplaces ----------
    { address: '0x00000000006c3852cbEf3e08E8dF289169EdE581', name: 'OpenSea Seaport 1.1', chains: VERIFIED_CHAINS },
    { address: '0x00000000000001ad428e4906aE43D8F9852d0dD6', name: 'OpenSea Seaport 1.4', chains: VERIFIED_CHAINS },
    { address: '0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC', name: 'OpenSea Seaport 1.5', chains: VERIFIED_CHAINS },
    { address: '0x0000000000000068F116a894984e2DB1123eB395', name: 'OpenSea Seaport 1.6', chains: VERIFIED_CHAINS },
    { address: '0x1E0049783F008A0085193E00003D00cd54003c71', name: 'OpenSea Conduit', chains: VERIFIED_CHAINS },
    { address: '0x000000000000Ad05Ccc4F10045630fb830B95127', name: 'Blur Exchange', chains: [1] },
    { address: '0x0000000000A39bb272e79075ade125fd351887Ac', name: 'Blur Pool', decimals: 18, chains: [1] },
  ];
})(typeof window !== 'undefined' ? window : globalThis);
