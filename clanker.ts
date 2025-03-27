import fetch from 'node-fetch';

export interface DeployParams {
  name: string;
  symbol: string;
  image: string;
  requestorAddress: string;
  requestKey: string;
  requestorFid?: number;
}

export async function deployClankerToken(params: DeployParams): Promise<string | null> {
  try {
    const response = await fetch('https://www.clanker.world/api/tokens/deploy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLANKER_API_KEY as string,
      },
      body: JSON.stringify(params),
    });
    const data = await response.json();
    if (data.success && data.contract_address) {
      console.log(`Clanker token deployed at: ${data.contract_address}`);
      return data.contract_address;
    } else {
      console.error('Clanker deployment failed:', data.error || 'Unknown error');
      return null;
    }
  } catch (e) {
    console.error('Error deploying Clanker token:', e);
    return null;
  }
}