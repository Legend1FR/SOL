const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const http = require('http'); // 👈 Add this line

// Replace with your Telegram bot token
const token = '7564788306:AAHO8fXpp2TSyTg0SMhrRGxIupkLSEwLsvQ'; // YOUR_TELEGRAM_BOT_TOKEN Updated
const bot = new TelegramBot(token, { polling: true });

// CoinMarketCap API Configuration
const COINMARKETCAP_API_KEY = 'd2442a28-fe25-4589-8b9a-aa864395e595'; // 👈 REPLACE WITH YOUR ACTUAL COINMARKETCAP API KEY
// Example endpoint - You'll likely need to adjust this and potentially use multiple endpoints
// This endpoint lists cryptocurrencies. You'll need to filter for Solana platform tokens
// and then potentially fetch more details for each.
const COINMARKETCAP_LISTINGS_API = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest';
// You might also need an endpoint to get metadata or map tokens to Solana platform
// const COINMARKETCAP_MAP_API = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/map';

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeMessage = `🚀 *Solana Gem Finder Bot (CMC Edition)* 🚀

I'll help you find potential Solana tokens using CoinMarketCap data with these criteria:

• Liquidity: $10K+ (Note: CMC might not provide DEX liquidity directly)
• Market Cap: $350K+
• Token Age: 24-48h max (Note: CMC provides 'date_added')
• 24h Buys/Sells: (Note: CMC might not provide this granular DEX data)
• Hourly Txns: (Note: CMC might not provide this granular DEX data)
• FDV: Under $900K

Use /analyze to find gems or /help for more info.
*Disclaimer*: Data from CoinMarketCap might differ from DEX-specific aggregators. Some criteria might be harder to match precisely.`;

    bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpMessage = `🔍 *How to Use This Bot (CMC Edition)* 🔍

1. Use /analyze to scan for Solana tokens based on CoinMarketCap data.
2. I'll show you tokens matching available criteria.
3. *Important*: CoinMarketCap data is more general. For DEX-specific details (like exact liquidity on Raydium, recent buy/sell counts), you'll still need to check tools like DexScreener, Birdeye, or Rugcheck.

*Remember*: Always do your own research and manage risk!`;

    bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/analyze/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        await bot.sendMessage(chatId, '🔎 Scanning for potential Solana gems using CoinMarketCap... This may take a moment.');

        // Get Solana tokens from CoinMarketCap
        // You might need to fetch a large list and then filter by platform,
        // or use a specific endpoint if CMC offers one for platform tokens.
        const response = await axios.get(COINMARKETCAP_LISTINGS_API, {
            headers: {
                'X-CMC_PRO_API_KEY': COINMARKETCAP_API_KEY
            },
            params: {
                // sort: 'date_added', // Sort by date added to find newer tokens
                // limit: 200, // Fetch a decent number to filter
                // aux: 'platform,date_added,circulating_supply,total_supply,max_supply,tags', // Request additional data
                // You might need to filter for 'solana-platform' tokens client-side if not directly supported
                // Or use a different endpoint if available for specific platforms
                // For example, if you get all tokens, you'll need to iterate and check token.platform.slug === 'solana'
            }
        });
        
        if (!response.data || !response.data.data) {
            console.error('Invalid response structure from CoinMarketCap:', response.data);
            await bot.sendMessage(chatId, '⚠️ Error fetching token data: Invalid response from CoinMarketCap. Please try again later.');
            return;
        }
        
        // CMC returns an array of tokens in response.data.data
        const allTokens = response.data.data;

        // Filter tokens based on criteria
        // IMPORTANT: Field names and data availability will differ significantly from DexScreener
        const filteredTokens = allTokens.filter(token => {
            // 1. Check if it's a Solana platform token (example)
            // This depends on how CMC structures platform data.
            // You might need to check token.platform.name === 'Solana' or token.platform.token_address
            const isSolanaToken = token.platform && token.platform.slug === 'solana'; // Adjust based on actual CMC response
            if (!isSolanaToken) return false;

            const quoteUSD = token.quote?.USD;
            if (!quoteUSD) return false; // Essential price data missing

            // Liquidity: CMC typically shows overall market liquidity, not specific DEX pool liquidity.
            // This criterion might be hard to match directly. You might look at 24h volume as a proxy.
            const volume24h = quoteUSD.volume_24h || 0;
            // For "Liquidity >= 10000", we might use volume as a loose proxy or acknowledge this is a limitation.
            // Let's assume for now we're checking volume instead of DEX liquidity.
            const hasSufficientActivity = volume24h >= 10000; // Adjust this threshold

            const marketCap = quoteUSD.market_cap || 0;
            const fdv = quoteUSD.fully_diluted_market_cap || 0;
            
            const dateAdded = new Date(token.date_added);
            const now = new Date();
            const ageHours = (now.getTime() - dateAdded.getTime()) / (1000 * 60 * 60);

            // 24h Buys/Sells & Hourly Txns: CMC generally does NOT provide this granular DEX transaction data.
            // You will likely have to remove these criteria or find proxies.
            // For this example, we'll comment them out.
            // const txns24hBuys = ...; // Not available
            // const txns24hSells = ...; // Not available
            // const hourlyTxns = ...; // Not available

            return hasSufficientActivity && // Using volume as a proxy for liquidity/activity
                marketCap >= 350000 &&
                ageHours >= 24 && ageHours <= 48 &&
                // txns24h.buys >= 100 && // Not available from CMC
                // txns24h.sells >= 70 && // Not available from CMC
                // hourlyTxns >= 100 && // Not available from CMC
                fdv <= 900000 &&
                token.platform.token_address; // Ensure it has a token address on Solana
        });

        if (filteredTokens.length === 0) {
            await bot.sendMessage(chatId, 'No tokens matching all available criteria found using CoinMarketCap. Some criteria (like specific DEX liquidity, buy/sell counts) are not available. Try again later or adjust criteria.');
            return;
        }

        // Sort by market cap or date added (adjust as needed)
        filteredTokens.sort((a, b) => (b.quote.USD.market_cap || 0) - (a.quote.USD.market_cap || 0));

        const topTokens = filteredTokens.slice(0, 5);

        await bot.sendMessage(chatId, `Found *${filteredTokens.length}* potential Solana tokens via CoinMarketCap. Displaying top *${topTokens.length}*:
(Note: Some criteria like DEX liquidity and buy/sell counts are not directly available from CMC)`, { parse_mode: 'Markdown' });

        for (const cmcToken of topTokens) {
            const message = formatTokenMessageCMC(cmcToken); // Use a new formatting function
            await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

            const solanaTokenAddress = cmcToken.platform.token_address;

            const options = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '🔍 Rugcheck', url: `http://rugcheck.xyz/tokens/${solanaTokenAddress}` },
                            { text: '📊 CoinMarketCap', url: `https://coinmarketcap.com/currencies/${cmcToken.slug}/` },
                            { text: '📈 DexScreener (if listed)', url: `https://dexscreener.com/solana/${solanaTokenAddress}` }
                        ],
                        [
                            { text: '💬 Check TG (Manual)', callback_data: `checktg_manual_${cmcToken.symbol}` }
                            // { text: '🔄 Next Batch', callback_data: '/analyze_next_batch_cmc' }
                        ]
                    ]
                }
            };
            await bot.sendMessage(chatId, 'Quick checks & actions:', options);
        }

    } catch (error) {
        console.error('Error in /analyze command with CoinMarketCap:', error.response ? error.response.data : error.message);
        await bot.sendMessage(chatId, '⚠️ Error fetching or processing token data from CoinMarketCap. Please try again later.');
    }
});

// Handler for "Check TG" button (simplified for CMC)
bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const data = callbackQuery.data;

    if (data.startsWith('checktg_manual_')) {
        const symbol = data.split('_')[2];
        await bot.answerCallbackQuery(callbackQuery.id, { text: `Search for ${symbol} community manually.` });
        await bot.sendMessage(chatId, `For ${symbol}, please search for their Telegram group or community links on their CoinMarketCap page or official website.`);
    } else if (data.startsWith('checktg_')) { // Keep old DexScreener logic if needed elsewhere
        const symbol = data.split('_')[1];
        await handleCheckTg(chatId, symbol);
    }
    // ... (handle other callbacks like analyze_next_batch if you implement them)
    else {
        await bot.answerCallbackQuery(callbackQuery.id);
    }
});

// Original handleCheckTg for DexScreener (can be kept if you plan to switch between APIs)
async function handleCheckTg(chatId, symbol) {
    // ... (implementation from your original code)
    try {
        await bot.sendMessage(chatId, `Searching for Telegram group for ${symbol} (via placeholder)...`);
        const telegramLink = await findTelegramGroup(symbol);
        if (telegramLink) {
            await bot.sendMessage(chatId, `Join the ${symbol} Telegram group: ${telegramLink}`);
        } else {
            await bot.sendMessage(chatId, `Couldn't find a Telegram group for ${symbol} via automated search.
Check their website or DexScreener/CoinMarketCap page for community links.`);
        }
    } catch (error) {
        console.error(`Error searching for Telegram group for ${symbol}:`, error);
        await bot.sendMessage(chatId, 'Error searching for Telegram group.');
    }
}


// New formatting function for CoinMarketCap data
function formatTokenMessageCMC(cmcToken) {
    const quoteUSD = cmcToken.quote.USD;
    const dateAdded = new Date(cmcToken.date_added);
    const now = new Date();
    const ageHours = ((now.getTime() - dateAdded.getTime()) / (1000 * 60 * 60)).toFixed(1);
    const solanaTokenAddress = cmcToken.platform?.token_address || 'N/A';

    return `✨ *${cmcToken.name} (${cmcToken.symbol})* ✨
Token Address (Solana): \`${solanaTokenAddress}\`

📊 *Price*: $${quoteUSD.price ? parseFloat(quoteUSD.price).toFixed(6) : 'N/A'}
💰 *Market Cap*: $${(quoteUSD.market_cap || 0).toLocaleString()}
🏦 *Fully Diluted Market Cap (FDV)*: $${(quoteUSD.fully_diluted_market_cap || 0).toLocaleString()}
🔄 *24h Volume*: $${(quoteUSD.volume_24h || 0).toLocaleString()}
⏳ *Date Added to CMC*: ${dateAdded.toLocaleDateString()} (${ageHours} hours ago)
💎 *Circulating Supply*: ${(cmcToken.circulating_supply || 0).toLocaleString()} ${cmcToken.symbol}
📦 *Total Supply*: ${(cmcToken.total_supply || 0).toLocaleString()} ${cmcToken.symbol}
${cmcToken.max_supply ? `🔒 *Max Supply*: ${cmcToken.max_supply.toLocaleString()} ${cmcToken.symbol}` : ''}

[CoinMarketCap Page](https://coinmarketcap.com/currencies/${cmcToken.slug}/)
[Rugcheck (Solana Address)](http://rugcheck.xyz/tokens/${solanaTokenAddress})`;
}

// Placeholder findTelegramGroup function (remains the same)
async function findTelegramGroup(symbol) {
    console.log(`Placeholder: findTelegramGroup called for ${symbol}`);
    return null;
}

console.log('Bot is running...');

// Graceful shutdown
process.once('SIGINT', () => {
    bot.stopPolling({ cancel: true }).then(() => {
        console.log('Bot polling stopped by SIGINT');
        if (server) server.close(() => console.log('HTTP server closed'));
    });
});
process.once('SIGTERM', () => {
    bot.stopPolling({ cancel: true }).then(() => {
        console.log('Bot polling stopped by SIGTERM');
        if (server) server.close(() => console.log('HTTP server closed'));
    });
});

// Create a simple HTTP server to satisfy Render's port binding requirement
const PORT = process.env.PORT || 3000; // Render provides the PORT environment variable
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Telegram Bot is active. Polling for updates.\n');
});

server.listen(PORT, () => {
    console.log(`HTTP server listening on port ${PORT} for health checks.`);
    console.log('Telegram Bot polling has been initiated.'); // Confirm bot polling starts after server
});
