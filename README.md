# Plainsign

**Read it before you sign it.** Paste a wallet signature request, transaction, or message and Plainsign explains it in plain English, with a clear risk level: low risk, check carefully, or could drain your wallet.

The page has three tabs:

1. **Explain a request:** decodes signatures and transactions and flags drain patterns. High-risk results also say what to do if you already signed.
2. **I already signed it:** a step-by-step emergency guide covering revoking, moving funds to a new wallet, sweeper bots, recovery scams, and reporting. You can link to it directly at `/#signed`.
3. **Unlock more:** connect a wallet to unlock holder tiers (`/#unlock`).

- 100% client-side: no backend, no API keys, no tracking
- A Content-Security-Policy blocks every network request except the token-balance check, so nothing you paste can leave the page
- Plain HTML, CSS and JavaScript with no build step and no dependencies

## Free limit and holder tiers

| | Free | Guard | Shield | Vault |
|---|---|---|---|---|
| Red/amber/green verdict and main reason | Always | Always | Always | Always |
| Detailed amber/red reports | 3 per day | Unlimited | Unlimited | Unlimited |
| Address-poisoning protection, custom rules | | | Extension (soon) | Extension (soon) |
| Multi-wallet watch, early access | | | | Extension (soon) |

How the limit works:
- Only **new amber or red** reports count. Green results, built-in examples, and re-checking the same request never count.
- Once the limit is reached, users still see the verdict and the main reason. Only the full breakdown is locked.
- The count resets each day and is stored only in the user's browser.

How holdings are checked:
- The user connects a wallet, and the site reads `balanceOf(address)` on the token contract through the public RPC.
- Only the wallet address is sent. Plainsign never asks for a signature or transaction.
- The balance is re-read every 10 minutes, and a wallet's tier is dropped if its tokens are sold.
- These are client-side checks, so a technical user could bypass them. That's acceptable: the gated features are extras, and the safety verdict is always free.

### Launch day checklist (all in `config.js`)
1. Set `token.address` to the token contract address, and `token.symbol` to the real ticker.
2. Set `token.buyUrl` to the launchpad or DEX page.
3. Check `token.decimals` (usually 18).
4. Adjust the `tiers` amounts and `freeDailyReports` if needed.
5. If you change `rpcUrl`, also update `connect-src` in `index.html`'s Content-Security-Policy.
6. Confirm Robinhood Chain's chain ID and RPC URL against Robinhood's official docs.

## What it detects

| Input | Examples of what it catches |
|---|---|
| Permit2 signatures | Unknown spender, unlimited amounts, many tokens bundled together, permissions that never expire |
| EIP-2612 / DAI permits | Gasless approvals to unknown spenders |
| Seaport (OpenSea) orders | "0 ETH listings", NFTs sent to someone else, orders that stay open for years |
| Blur orders | Selling for nothing, bulk orders with hidden contents |
| Token approvals (`approve`, `increaseAllowance`) | Unlimited approvals and unknown spenders; zero-amount revokes are shown as safe |
| `setApprovalForAll` | Collection-wide NFT approvals to unknown operators |
| EIP-7702 delegations | Account takeover, including chain ID 0 (all networks) |
| `eth_sign` / raw hashes | Blind signing |
| `wallet_sendCalls` batches | Every step checked, so a bad step can't hide among good ones |
| Sign-In with Ethereum | Recognised as a login; flags a URI that points to a different domain |
| Plain text | Mentions of seed phrases, approvals or transfers |

## Run locally

Use any static file server, for example:

```
python -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` directly from disk may be blocked by the security policy, so use a server.

## Launch for free (GitHub Pages)

1. Create a free GitHub account and a new **public** repository, for example `plainsign`.
2. Upload these files: `index.html`, `style.css`, `config.js`, `known.js`, `decoder.js`, `access.js`, `app.js`, `effects.js`, `bg3d.js`, `scroll.js`, `README.md`.
3. Go to **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then click Save.
4. After about a minute the site is live at `https://<your-username>.github.io/plainsign/`.

### Custom domain (the only cost)

1. Buy a domain from any registrar.
2. In **Settings → Pages → Custom domain**, enter your domain and click Save.
3. At your registrar, add the DNS records that GitHub shows you (a `CNAME` for `www`, or the four `A` records for the bare domain).
4. Once DNS is working, tick **Enforce HTTPS**.

## Project files

| File | Purpose |
|---|---|
| `config.js` | Settings: free daily limit, tier amounts, token address, chain and RPC |
| `access.js` | Daily limit counter, wallet connection and token-balance check |
| `known.js` | Known tokens, routers and marketplaces on Ethereum, Base, Arbitrum, Optimism, Polygon, BNB Chain and Avalanche, each tagged with the chains it applies to |
| `decoder.js` | The engine: parsing, decoding and risk rules. No DOM code, so the browser extension can reuse it |
| `app.js` | Page logic: tabs, results, locked view, unlock tab, built-in examples |
| `effects.js` | Visual effects: glass header, scroll reveals, count-ups, card spotlight, animated hero demo. Purely decorative; respects reduced motion |
| `bg3d.js` | The 3D background: a calm WebGL wave of fine lines along the bottom of the screen. Scrolling glides forward over it. No libraries |
| `scroll.js` | Scroll-linked motion: progress bar, pinned "How it works" story, hero parallax, word-by-word headlines, building cards. Purely decorative; switched off for reduced motion |
| `index.html`, `style.css` | The page itself |

To recognise more contracts, add them to `known.js`. **Check every address against the project's official docs and a block explorer first:** a wrong entry teaches users to trust a bad contract. To decode more functions, add their selectors to `SELECTORS` in `decoder.js`.

## Roadmap

1. **Now:** website (this repo)
2. **Next:** browser extension for Firefox and Edge (both free to publish) that intercepts requests automatically before the wallet popup
3. **Later:** Chrome Web Store ($5 one-time), community-maintained address lists, more protocol decoders

## Disclaimer

Beta software. A low-risk result is not a guarantee. When in doubt, reject the request.
