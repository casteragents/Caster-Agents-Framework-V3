Below is a well-structured and comprehensive `README.md` for your "caster-agent-ts" project, designed to be posted on GitHub. It provides an overview of the project, setup instructions, usage details, and other essential information to help users understand and utilize the agent effectively.

---

# Caster Agent TS

Caster Agent TS is a TypeScript-based automated agent for the [Farcaster](https://www.farcaster.xyz/) decentralized social network. It monitors mentions of a specific account (`@casterapp`), processes commands, interacts with users by sending `$BALD` tokens, deploys custom "Clanker" token contracts, and maintains user rankings. The agent integrates with various services, including the Neynar API for Farcaster interactions, OpenAI for generating responses, and Ethereum smart contracts on the Base blockchain for token and NFT operations.

## Features

- **Mention Monitoring:** Continuously checks for new mentions of `@casterapp` on Farcaster.
- **NFT Ownership Check:** Verifies if the mentioning user holds a Caster ID NFT to determine eligibility for rewards.
- **Token Transfer:** Sends 100 `$BALD` tokens to eligible users and updates their balances.
- **Clanker Token Deployment:** Deploys custom "Clanker" token contracts upon user request via the Clanker API.
- **Rankings Management:** Tracks and updates user rankings based on `$BALD` token balances.
- **Automated Posting:** Posts messages to a specified Farcaster channel every 20 minutes to engage users.
- **OpenAI Integration:** Generates context-aware responses using OpenAI's API.
- **Cast Management:** Deletes the oldest cast when a new one is posted to maintain a clean feed.

## Prerequisites

To run this project, you need:

- **Node.js** (v14 or later)
- **TypeScript**
- A **Farcaster account** with a signer UUID
- API keys for:
  - **Neynar** (for Farcaster API access)
  - **OpenAI** (for response generation)
  - **Clanker** (for token deployment; requires a Clanker account)
- An **Ethereum wallet** with a private key for transaction signing
- Access to the **Base blockchain** (mainnet by default)
- Sufficient **ETH** (for gas fees) and **$BALD tokens** in the agent's wallet

## Installation

Follow these steps to set up the project:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/caster-agent-ts.git
   cd caster-agent-ts
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**  
   Create a `.env` file in the root directory (see the [Configuration](#configuration) section below).

*Optional:* For better performance in production, compile the TypeScript code to JavaScript:
```bash
npx tsc
node dist/index.js
```
However, the default `npm start` command uses `ts-node` for simplicity.

## Configuration

Create a `.env` file in the project root with the following variables:

```env
FARCASTER_SIGNER_UUID=your_farcaster_signer_uuid
NEYNAR_API_KEY=your_neynar_api_key
OPENAI_API_KEY=your_openai_api_key
TOKEN_ADDRESS=address_of_bald_token_contract
AGENT_PRIVATE_KEY=your_ethereum_private_key
FID=your_farcaster_fid
CHANNEL=channel_to_post_to
CLANKER_API_KEY=your_clanker_api_key
NFT_ADDRESS=address_of_caster_id_nft_contract
```

### Environment Variables Explained

- **`FARCASTER_SIGNER_UUID`**: UUID of your Farcaster signer (obtained from Farcaster).
- **`NEYNAR_API_KEY`**: API key for Neynar services (from [Neynar](https://neynar.com/)).
- **`OPENAI_API_KEY`**: API key for OpenAI (from [OpenAI](https://openai.com/)).
- **`TOKEN_ADDRESS`**: Ethereum address of the `$BALD` token contract on Base.
- **`AGENT_PRIVATE_KEY`**: Private key of the Ethereum wallet used by the agent.
- **`FID`**: Your Farcaster user ID (numeric).
- **`CHANNEL`**: The Farcaster channel to post updates to (e.g., `bald`).
- **`CLANKER_API_KEY`**: API key for Clanker token deployment (from [Clanker](https://www.clanker.world/)).
- **`NFT_ADDRESS`**: Ethereum address of the Caster ID NFT contract on Base.

### Important Notes

- **Funding:** Ensure the agent's Ethereum wallet has sufficient ETH for gas fees and `$BALD` tokens to distribute.
- **Network:** The agent uses the Base mainnet (`https://mainnet.base.org`). For testnet use, update the provider URL in `index.ts` and use testnet contract addresses.
- **API Quotas:** Verify you have sufficient credits/quotas for Neynar, OpenAI, and Clanker APIs.
- **Security Warning:** Keep your `.env` file secure and never share it. Protect the server running the agent to prevent private key exposure.

## Usage

Start the agent with:

```bash
npm start
```

### What Happens When You Run It?

- The agent monitors mentions of `@casterapp` and processes them:
  - If the user holds a Caster ID NFT:
    - Sends 100 `$BALD` tokens for a standard mention.
    - Deploys a Clanker token and sends 100 `$BALD` if the mention includes "deploy clanker".
  - If not, it replies with instructions to acquire a Caster ID NFT.
- Posts to the configured channel every 20 minutes to encourage interaction.
- Updates `balances.json` and `rankings.json` files with user data.
- Deletes the oldest cast when a new one is posted to keep the feed clean.

### Displaying Rankings

The agent updates `rankings.json` with user rankings. To display them:
- Host `rankings.html` on a web server alongside `rankings.json`.
- Ensure `rankings.json` is accessible at `/rankings.json` (adjust the fetch URL in `rankings.html` if needed).
- Example hosting options:
  - Use a static site host like GitHub Pages or Vercel.
  - Run a simple server (e.g., with Express.js) to serve both files.

**Note:** The provided `rankings.html` is styled and fetches rankings dynamically. Check a live example at [rankings.mrcasterbaldman.space](https://rankings.mrcasterbaldman.space).

### Additional Notes

- **Cast Deletion:** Older casts are deleted irreversibly to manage feed size. Ensure this aligns with your use case.
- **Posting Frequency:** Adjust the 20-minute channel posting interval in `index.ts` if needed to comply with rate limits or community guidelines.
- **Error Handling:** The agent retries on network errors and delays on failures but may require manual intervention for persistent issues.
- **Storage:** Ensure the runtime environment supports persistent file writes for `processed_ids.txt`, `balances.json`, and `rankings.json`.

## Architecture

The project is organized as follows:

- **`index.ts`**: Core logic for monitoring mentions, processing them, and posting to the channel.
- **`clanker.ts`**: Function to deploy Clanker tokens via the Clanker API.
- **`openai.ts`**: Function to generate responses using OpenAI.
- **`rankings.html`**: Static HTML file to display rankings by fetching `rankings.json`.
- **`processed_ids.txt`**: Tracks processed mention hashes to avoid duplicates.
- **`balances.json`**: Stores user `$BALD` balances.
- **`rankings.json`**: Stores user rankings for display.

### Technologies Used

- **Neynar API**: For Farcaster interactions.
- **Ethers.js**: For Base blockchain operations.
- **Node Fetch**: For HTTP requests.
- **ts-node**: For running TypeScript directly.

## Contributing

Contributions are welcome! To contribute:

1. Fork the repository.
2. Make your changes in a feature branch.
3. Submit a pull request with a clear description of your updates.

Please ensure your code follows the project's TypeScript standards and include tests where applicable.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact

For questions or support:
- Open an issue on the [GitHub repository](https://github.com/yourusername/caster-agent-ts).
- Contact [your contact information] (replace with your preferred contact method).

---

### Final Notes
Replace `yourusername` in the clone URL and contact section with your actual GitHub username. This README provides everything needed to understand, set up, and run the "caster-agent-ts" project, making it accessible to both users and potential contributors on GitHub. Enjoy deploying your Farcaster agent!