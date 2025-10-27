export function abbreviateAddress(address: string) {
  return `${address.substring(0, 5)}...${address.substring(36)}`;
}

export function abbreviateTxnId(txnId: string) {
  return `${txnId.substring(0, 5)}...${txnId.substring(62)}`;
}

export function explorerAddress(address: string) {
  return `https://explorer.hiro.so/address/${address}?chain=testnet`;
}

// Cache for STX balances to avoid rate limiting
const balanceCache = new Map<string, { balance: number; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

export async function getStxBalance(address: string) {
  // Check cache first
  const cached = balanceCache.get(address);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.balance;
  }

  try {
    const baseUrl = "https://api.testnet.hiro.so";
    const url = `${baseUrl}/extended/v1/address/${address}/stx`;

    const response = await fetch(url).then((res) => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return res.json();
    });
    const balance = parseInt(response.balance);
    
    // Update cache
    balanceCache.set(address, { balance, timestamp: Date.now() });
    
    return balance;
  } catch (error) {
    console.error("Error fetching STX balance:", error);
    // Return cached value if available, even if expired
    if (cached) {
      return cached.balance;
    }
    // Return 0 as fallback
    return 0;
  }
}

// Convert a raw STX amount to a human readable format by respecting the 6 decimal places
export function formatStx(amount: number) {
  return parseFloat((amount / 10 ** 6).toFixed(2));
}

// Convert a human readable STX balance to the raw amount
export function parseStx(amount: number) {
  return amount * 10 ** 6;
}
