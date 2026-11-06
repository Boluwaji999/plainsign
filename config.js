/*
 * Plainsign settings. Everything you may want to tune lives here, so the
 * limit, the tiers and the token can change without touching other files.
 */
(function (global) {
  'use strict';

  global.PLAINSIGN_CONFIG = {
    // Detailed amber/red reports a non-holder gets per day. Green results and
    // the red/amber verdict itself are never limited.
    freeDailyReports: 3,

    token: {
      symbol: 'PLAIN', // placeholder ticker: change before launch
      address: null, // set to the token contract address on launch day
      decimals: 18,
      chainId: 4663,
      chainName: 'Robinhood Chain',
      // If you change this URL, also update connect-src in index.html's
      // Content-Security-Policy, or the browser will block the request.
      rpcUrl: 'https://rpc.mainnet.chain.robinhood.com',
      buyUrl: null, // launchpad / DEX page for the token, set on launch day
    },

    // Minimum holdings (whole tokens) per tier, highest tier first.
    tiers: [
      { id: 'vault', name: 'Vault', min: 250000 },
      { id: 'shield', name: 'Shield', min: 50000 },
      { id: 'guard', name: 'Guard', min: 10000 },
    ],

    // How often a connected wallet's balance is re-read.
    recheckMinutes: 10,
  };
})(typeof window !== 'undefined' ? window : globalThis);
