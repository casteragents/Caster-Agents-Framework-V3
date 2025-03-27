#!/usr/bin/env ts-node

import * as dotenv from 'dotenv';
import axios from 'axios';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';

dotenv.config();

// Neynar API base URL
const API_BASE_URL = 'https://api.neynar.com/v2/farcaster';

// Load credentials from environment variables
const API_KEY = process.env.NEYNAR_API_KEY;
const SIGNER_UUID = process.env.FARCASTER_SIGNER_UUID;
const FID = process.env.FID;

if (!API_KEY || !SIGNER_UUID || !FID) {
    console.error('Error: Please set NEYNAR_API_KEY, FARCASTER_SIGNER_UUID, and FID in your .env file.');
    process.exit(1);
}

const apiKey: string = API_KEY;
const signerUuid: string = SIGNER_UUID;
const agentFid: number = parseInt(FID, 10);

const neynarClient = new NeynarAPIClient(apiKey);

// Define interfaces
interface Cast {
    hash: string;
    timestamp: string; // ISO format (e.g., "2023-10-01T12:00:00Z")
}

interface FeedResponse {
    casts: Cast[];
    next?: { cursor: string | null };
}

/**
 * Fetch the latest casts to detect new ones
 */
async function fetchLatestCasts(fid: number, limit: number = 10): Promise<Cast[]> {
    const casts: Cast[] = [];
    let cursor: string | undefined = undefined;
    const batchSize = 10;
    const delayMs = 100; // Fast delay to match agent's speed

    do {
        try {
            const response = await neynarClient.fetchCastsForUser(fid, { limit: batchSize, cursor });
            if (!response.casts || !Array.isArray(response.casts)) {
                console.error('Error: Invalid casts response from API.');
                break;
            }
            casts.push(...response.casts);
            cursor = response.next?.cursor ?? undefined; // Handle null safely
            if (casts.length >= limit) break;
            if (cursor) await new Promise(resolve => setTimeout(resolve, delayMs));
        } catch (error) {
            console.error('Error fetching latest casts:', error);
            break;
        }
    } while (cursor);

    return casts;
}

/**
 * Fetch the oldest cast to delete
 */
async function fetchOldestCast(fid: number): Promise<Cast | null> {
    const casts: Cast[] = [];
    let cursor: string | undefined = undefined;
    const batchSize = 100;
    const maxCasts = 500; // Cap to avoid over-fetching
    const delayMs = 100; // Fast delay to match agent's speed

    do {
        try {
            const response = await neynarClient.fetchCastsForUser(fid, { limit: batchSize, cursor });
            if (!response.casts || !Array.isArray(response.casts)) {
                console.error('Error: Invalid casts response from API.');
                break;
            }
            casts.push(...response.casts);
            cursor = response.next?.cursor ?? undefined; // Handle null safely
            if (casts.length >= maxCasts) break;
            if (cursor) await new Promise(resolve => setTimeout(resolve, delayMs));
        } catch (error) {
            console.error('Error fetching casts for deletion:', error);
            break;
        }
    } while (cursor);

    if (casts.length === 0) return null;

    // Sort by timestamp (oldest first)
    casts.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return casts[0]; // Return the oldest cast
}

/**
 * Delete a single cast
 */
async function deleteCast(signerUuid: string, targetHash: string): Promise<boolean> {
    const url: string = `${API_BASE_URL}/cast`;
    try {
        await axios.delete(url, {
            headers: {
                'x-api-key': apiKey,
                'content-type': 'application/json'
            },
            data: {
                signer_uuid: signerUuid,
                target_hash: targetHash
            }
        });
        return true;
    } catch (error) {
        console.error(`Failed to delete cast ${targetHash}:`, error);
        return false;
    }
}

/**
 * Main function to monitor new casts and delete the oldest one
 */
async function main() {
    console.log('Starting cast deletion monitor for FID:', agentFid);

    let latestCastTimestamp: string | null = null;

    // Initial fetch to set the baseline timestamp
    const initialCasts = await fetchLatestCasts(agentFid);
    if (initialCasts.length > 0) {
        latestCastTimestamp = initialCasts[0].timestamp; // Newest cast timestamp
        console.log('Initial latest cast timestamp:', latestCastTimestamp);
    }

    // Monitor for new casts every 5 seconds
    while (true) {
        try {
            const casts = await fetchLatestCasts(agentFid);
            if (casts.length === 0) {
                console.log('No casts found, retrying...');
                await new Promise(resolve => setTimeout(resolve, 5000));
                continue;
            }

            // Check for a new cast by comparing timestamps
            const newestCast = casts[0];
            if (latestCastTimestamp && new Date(newestCast.timestamp) > new Date(latestCastTimestamp)) {
                console.log('New cast detected:', newestCast.hash, 'Timestamp:', newestCast.timestamp);

                // Update the latest timestamp
                latestCastTimestamp = newestCast.timestamp;

                // Delete the oldest cast
                const oldestCast = await fetchOldestCast(agentFid);
                if (oldestCast) {
                    const success = await deleteCast(signerUuid, oldestCast.hash);
                    if (success) {
                        console.log(`Deleted oldest cast: ${oldestCast.hash}`);
                    } else {
                        console.log(`Failed to delete oldest cast: ${oldestCast.hash}`);
                    }
                } else {
                    console.log('No casts available to delete.');
                }
            }

            // Wait 5 seconds to match agent's mention processing speed
            await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (error) {
            console.error('Error in monitoring loop:', error);
            await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute on error
        }
    }
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});