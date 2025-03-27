import fetch from 'node-fetch';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { config } from 'dotenv';
import fs from 'fs';
import { ethers } from 'ethers';
import { deployClankerToken } from './clanker';
import { generateOpenAIResponse } from './openai';

config();

const neynarClient = new NeynarAPIClient(process.env.NEYNAR_API_KEY as string);
const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
const wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY as string, provider);
const tokenContract = new ethers.Contract(
  process.env.TOKEN_ADDRESS as string,
  [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
  ],
  wallet
);
const nftContract = new ethers.Contract(
  process.env.NFT_ADDRESS as string,
  ['function balanceOf(address owner) view returns (uint256)'],
  provider
);

const processedIdsFile = 'processed_ids.txt';
const balancesFile = 'balances.json';
const rankingsFile = 'rankings.json';

interface Notification {
  type: string;
  cast?: {
    hash: string;
    text: string;
    author: {
      fid: number;
      username: string;
      verifications?: string[];
      custody_address: string;
    };
  };
}

interface Ranking {
  fid: string;
  username: string;
  balance: number;
}

function loadBalancesDB(): Record<string, number> {
  if (fs.existsSync(balancesFile)) {
    return JSON.parse(fs.readFileSync(balancesFile, 'utf8'));
  }
  return {};
}

function saveBalancesDB(balances: Record<string, number>) {
  fs.writeFileSync(balancesFile, JSON.stringify(balances, null, 2));
}

function loadRankingsDB(): Ranking[] {
  if (fs.existsSync(rankingsFile)) {
    return JSON.parse(fs.readFileSync(rankingsFile, 'utf8'));
  }
  return [];
}

function saveRankingsDB(rankings: Ranking[]) {
  fs.writeFileSync(rankingsFile, JSON.stringify(rankings, null, 2));
}

async function updateRankings(fid: string, username: string, balance: number) {
  let rankings = loadRankingsDB();
  const existing = rankings.find((r) => r.fid === fid);
  if (existing) {
    existing.balance = balance;
  } else {
    rankings.push({ fid, username, balance });
  }
  rankings.sort((a, b) => b.balance - a.balance);
  saveRankingsDB(rankings);
}

async function loadAgentBalances() {
  const ethBalance = await provider.getBalance(wallet.address);
  const tokenBalance = await tokenContract.balanceOf(wallet.address);
  console.log(`Agent ETH Balance: ${ethers.formatEther(ethBalance)} ETH`);
  console.log(`Agent $BALD Balance: ${ethers.formatEther(tokenBalance)} $BALD`);
}

async function getMentions(fid: number, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      console.log('Fetching notifications...');
      const response = await neynarClient.fetchAllNotifications(fid, { type: 'mentions' });
      const notifications = response.notifications || [];
      const processedIds = fs.existsSync(processedIdsFile)
        ? fs.readFileSync(processedIdsFile, 'utf8').split('\n').filter(Boolean)
        : [];
      const mentions = notifications
        .filter(
          (n: Notification) =>
            n.type === 'mention' &&
            n.cast &&
            n.cast.hash &&
            !processedIds.includes(n.cast.hash)
        )
        .map((n: Notification) => ({
          cast: n.cast!,
          author: n.cast!.author,
          text: n.cast!.text,
          hash: n.cast!.hash,
        }));
      console.log(`Found ${mentions.length} new mentions`);
      return mentions;
    } catch (e: any) {
      if (e.code === 'EAI_AGAIN' && attempt < retries - 1) {
        console.log(`DNS error, retrying in 5 seconds... (Attempt ${attempt + 1})`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        console.error('Error fetching mentions:', e);
        return [];
      }
    }
  }
  return [];
}

async function checkNFTOwnership(address: string): Promise<boolean> {
  try {
    const balance = await nftContract.balanceOf(address);
    return balance > 0;
  } catch (e) {
    console.error('Error checking NFT ownership:', e);
    return false;
  }
}

async function sendTokens(toAddress: string, fid: string, username: string): Promise<string | null> {
  try {
    const amount = ethers.parseEther('100');
    const balance = await tokenContract.balanceOf(wallet.address);
    if (balance < amount) {
      console.error(`Insufficient $BALD balance: ${ethers.formatEther(balance)} $BALD`);
      return null;
    }
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice;
    if (!gasPrice) return null;
    const tx = await tokenContract.transfer(toAddress, amount, {
      gasPrice: gasPrice * BigInt(2),
      gasLimit: 100000,
    });
    console.log(`Sending 100 $BALD to ${toAddress} - TX: https://basescan.org/tx/${tx.hash}`);

    const balances = loadBalancesDB();
    const newBalance = (balances[fid] || 0) + 100;
    balances[fid] = newBalance;
    saveBalancesDB(balances);
    await updateRankings(fid, username, newBalance);

    return tx.hash;
  } catch (e) {
    console.error('Token transfer failed:', e);
    return null;
  }
}

async function postToFarcaster(text: string, parentHash: string) {
  try {
    const cast = await neynarClient.publishCast(
      process.env.FARCASTER_SIGNER_UUID as string,
      text,
      { replyTo: parentHash }
    );
    console.log(`Posted reply: ${text}`);
    return cast;
  } catch (e) {
    console.error('Error posting to Farcaster:', e);
  }
}

async function processMention(mention: any) {
  const castText = mention.text.toLowerCase();
  const toAddress = mention.author.verifications?.[0] || mention.author.custody_address;
  const username = mention.author.username;
  const fid = mention.author.fid.toString();

  const hasNFT = await checkNFTOwnership(toAddress);

  if (!hasNFT) {
    const prompt = `Generate a concise reply for @${username} who mentioned me on Farcaster. Inform them: "Make sure your Warplet holds Caster ID to receive your $BALD tokens. Go to MrCasterbaldman.Space and verify your Caster Account to be eligible for all ecosystem perks. Check your rankings on Rankings.MrCasterbaldman.Space."`;
    const replyText = await generateOpenAIResponse(prompt);
    await postToFarcaster(replyText, mention.hash);
    return;
  }

  if (castText.includes('deploy clanker')) {
    console.log(`Deploying Clanker token for @${username}...`);
    const params = {
      name: 'Custom Clanker',
      symbol: 'CLK',
      image: 'https://example.com/clanker.png',
      requestorAddress: toAddress,
      requestKey: 'clanker_' + Date.now() + Math.random().toString(36).substring(2, 15),
      requestorFid: mention.author.fid,
    };
    const contractAddress = await deployClankerToken(params);
    if (contractAddress) {
      const txHash = await sendTokens(toAddress, fid, username);
      if (txHash) {
        const balances = loadBalancesDB();
        const currentBalance = balances[fid] || 100;
        const rankings = loadRankingsDB();
        const rank = rankings.findIndex((r) => r.fid === fid) + 1 || 1;
        const replyText = `Hey @${username}, your Clanker token is deployed at https://dexscreener.com/base/${contractAddress}! I’ve sent you 100 $BALD (TX: https://basescan.org/tx/${txHash}). Your balance is now ${currentBalance} $BALD, and your ranking is ${rank}. Check it out at rankings.mrcasterbaldman.space!`;
        await postToFarcaster(replyText, mention.hash);
      }
    }
  } else {
    const txHash = await sendTokens(toAddress, fid, username);
    if (txHash) {
      const balances = loadBalancesDB();
      const currentBalance = balances[fid] || 100;
      const rankings = loadRankingsDB();
      const rank = rankings.findIndex((r) => r.fid === fid) + 1 || 1;
      const prompt = `Generate a concise reply for @${username} who mentioned me on Farcaster with: "${mention.text}". Inform them I’ve sent 100 $BALD (TX: https://basescan.org/tx/${txHash}), their total balance is now ${currentBalance} $BALD, and their ranking is ${rank}. Encourage them to check their ranking on rankings.mrcasterbaldman.space.`;
      const replyText = await generateOpenAIResponse(prompt);
      await postToFarcaster(replyText, mention.hash);
    }
  }
}

async function postToChannel() {
  const prompt = `Generate a concise message for Mr. Caster Baldman to post to the ${process.env.CHANNEL} channel on Farcaster. Encourage users to mention @casterapp to receive $BALD tokens and check their rankings on rankings.mrcasterbaldman.space.`;
  const text = await generateOpenAIResponse(prompt);
  await neynarClient.publishCast(process.env.FARCASTER_SIGNER_UUID as string, text);
  console.log(`Posted to ${process.env.CHANNEL}: ${text}`);
}

async function main() {
  const fid = parseInt(process.env.FID as string, 10);
  await loadAgentBalances();

  console.log('Mr. Caster Baldman is online, monitoring @casterapp mentions...');

  // Post to channel every 20 minutes
  setInterval(postToChannel, 20 * 60 * 1000);

  while (true) {
    try {
      const mentions = await getMentions(fid);
      if (mentions.length > 0) {
        for (const mention of mentions) {
          await processMention(mention);
          fs.appendFileSync(processedIdsFile, `${mention.hash}\n`);
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 10000));
    } catch (e) {
      console.error('Main loop error:', e);
      await new Promise((resolve) => setTimeout(resolve, 60000));
    }
  }
}

main().catch((e) => console.error('Fatal error:', e));