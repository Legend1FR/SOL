const axios = require('axios');
const http = require('http');
const url = require('url'); // For parsing URL and query parameters

// CoinMarketCap API Configuration
const COINMARKETCAP_API_KEY = 'd2442a28-fe25-4589-8b9a-aa864395e595'; // 👈 استبدل هذا بمفتاح API الخاص بك من CoinMarketCap
const COINMARKETCAP_LISTINGS_API = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest';

// Refactor the analysis logic into a standalone function
async function analyzeTokens() {
    try {
        console.log('🔎 Scanning for potential Solana gems using CoinMarketCap...');

        const response = await axios.get(COINMARKETCAP_LISTINGS_API, {
            headers: {
                'X-CMC_PRO_API_KEY': COINMARKETCAP_API_KEY
            },
            params: {
                // sort: 'date_added', // Sort by date added to find newer tokens
                // limit: 200, // Fetch a decent number to filter
                // aux: 'platform,date_added,circulating_supply,total_supply,max_supply,tags', // Request additional data
            }
        });
        
        if (!response.data || !response.data.data) {
            console.error('Invalid response structure from CoinMarketCap:', response.data);
            return { error: 'Invalid response from CoinMarketCap.' };
        }
        
        const allTokens = response.data.data;

        const filteredTokens = allTokens.filter(token => {
            const isSolanaToken = token.platform && token.platform.slug === 'solana';
            if (!isSolanaToken) return false;

            const quoteUSD = token.quote?.USD;
            if (!quoteUSD) return false;

            const volume24h = quoteUSD.volume_24h || 0;
            const hasSufficientActivity = volume24h >= 10000;

            const marketCap = quoteUSD.market_cap || 0;
            const fdv = quoteUSD.fully_diluted_market_cap || 0;
            
            const dateAdded = new Date(token.date_added);
            const now = new Date();
            const ageHours = (now.getTime() - dateAdded.getTime()) / (1000 * 60 * 60);

            return hasSufficientActivity &&
                marketCap >= 350000 &&
                ageHours >= 24 && ageHours <= 48 &&
                fdv <= 900000 &&
                token.platform.token_address;
        });

        if (filteredTokens.length === 0) {
            return { message: 'No tokens matching all available criteria found using CoinMarketCap.' };
        }

        filteredTokens.sort((a, b) => (b.quote.USD.market_cap || 0) - (a.quote.USD.market_cap || 0));
        const topTokens = filteredTokens.slice(0, 5); // Get top 5 or fewer

        // Format tokens for web display
        return topTokens.map(token => formatTokenDataForWeb(token));

    } catch (error) {
        console.error('Error in analyzeTokens function:', error.response ? error.response.data : error.message);
        return { error: 'Error fetching or processing token data from CoinMarketCap.' };
    }
}

// Modify formatting function to return structured data for the web
function formatTokenDataForWeb(cmcToken) {
    const quoteUSD = cmcToken.quote.USD;
    const dateAdded = new Date(cmcToken.date_added);
    const now = new Date();
    const ageHours = ((now.getTime() - dateAdded.getTime()) / (1000 * 60 * 60)).toFixed(1);
    const solanaTokenAddress = cmcToken.platform?.token_address || 'N/A';

    return {
        name: cmcToken.name,
        symbol: cmcToken.symbol,
        tokenAddress: solanaTokenAddress,
        price: quoteUSD.price ? parseFloat(quoteUSD.price).toFixed(6) : 'N/A',
        marketCap: (quoteUSD.market_cap || 0).toLocaleString(),
        fdv: (quoteUSD.fully_diluted_market_cap || 0).toLocaleString(),
        volume24h: (quoteUSD.volume_24h || 0).toLocaleString(),
        dateAdded: dateAdded.toLocaleDateString(),
        ageHours: ageHours,
        circulatingSupply: (cmcToken.circulating_supply || 0).toLocaleString(),
        totalSupply: (cmcToken.total_supply || 0).toLocaleString(),
        maxSupply: cmcToken.max_supply ? cmcToken.max_supply.toLocaleString() : null,
        cmcLink: `https://coinmarketcap.com/currencies/${cmcToken.slug}/`,
        rugcheckLink: `http://rugcheck.xyz/tokens/${solanaTokenAddress}`,
        dexscreenerLink: `https://dexscreener.com/solana/${solanaTokenAddress}` // Added DexScreener link
    };
}

// --- Frontend HTML ---
const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Solana Gem Finder</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; background-color: #f0f2f5; color: #1c1e21; display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; }
        .container { background-color: #ffffff; padding: 25px; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 100%; max-width: 800px; }
        h1 { color: #1877f2; text-align: center; margin-bottom: 20px; font-size: 28px; }
        p.description { text-align: center; color: #606770; margin-bottom: 25px; font-size: 16px; }
        button {
            background-color: #1877f2; color: white; padding: 12px 20px; border: none;
            border-radius: 6px; cursor: pointer; font-size: 17px; display: block; margin: 20px auto;
            transition: background-color 0.3s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        button:hover { background-color: #166fe5; }
        button:disabled { background-color: #bcc0c4; cursor: not-allowed; }
        #results { margin-top: 25px; }
        .token { border: 1px solid #dddfe2; padding: 20px; margin-bottom: 20px; border-radius: 8px; background-color: #f7f8fa; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .token h2 { margin-top: 0; color: #050505; font-size: 22px; margin-bottom: 10px; }
        .token p { margin: 8px 0; color: #333; font-size: 15px; line-height: 1.6; }
        .token p strong { color: #1c1e21; }
        .token-links a { color: #1877f2; text-decoration: none; margin-right: 15px; font-weight: 500; }
        .token-links a:hover { text-decoration: underline; }
        .loading, .error, .message { text-align: center; font-size: 18px; color: #606770; padding: 15px; border-radius: 6px; margin-top: 20px; }
        .loading { background-color: #e7f3ff; border: 1px solid #cce0ff; }
        .error { background-color: #ffebe8; border: 1px solid #ffc9c4; color: #c92a2a; }
        .message { background-color: #e6f7ff; border: 1px solid #b3e0ff; }
        .token-address { font-family: 'Courier New', Courier, monospace; background-color: #e9ecef; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Solana Gem Finder (CMC Edition)</h1>
        <p class="description">
            اضغط على الزر أدناه للبحث عن العملات الواعدة على شبكة سولانا بناءً على معايير محددة باستخدام بيانات CoinMarketCap.
        </p>
        <button id="analyzeButton">🚀 ابدأ التحليل</button>
        <div id="loading" class="loading" style="display:none;">⏳ جارٍ البحث عن العملات... الرجاء الانتظار...</div>
        <div id="error" class="error" style="display:none;"></div>
        <div id="message" class="message" style="display:none;"></div>
        <div id="results"></div>
    </div>

    <script>
        document.getElementById('analyzeButton').addEventListener('click', async () => {
            const resultsDiv = document.getElementById('results');
            const loadingDiv = document.getElementById('loading');
            const errorDiv = document.getElementById('error');
            const messageDiv = document.getElementById('message');
            const analyzeButton = document.getElementById('analyzeButton');
            
            resultsDiv.innerHTML = ''; // Clear previous results
            errorDiv.style.display = 'none'; // Clear previous errors
            messageDiv.style.display = 'none'; // Clear previous messages
            loadingDiv.style.display = 'block'; // Show loading indicator
            analyzeButton.disabled = true;

            try {
                const response = await fetch('/api/analyze');
                if (!response.ok) {
                    const errData = await response.json().catch(() => ({error: 'Failed to parse error response'}));
                    throw new Error(errData.error || \`HTTP error! status: \${response.status}\`);
                }
                const data = await response.json();
                
                loadingDiv.style.display = 'none';
                analyzeButton.disabled = false;

                if (data.error) {
                    errorDiv.textContent = 'حدث خطأ: ' + data.error;
                    errorDiv.style.display = 'block';
                    return;
                }
                if (data.message) { // For messages like "No tokens found"
                    messageDiv.textContent = data.message;
                    messageDiv.style.display = 'block';
                    return;
                }

                if (data && data.length > 0) {
                    data.forEach(token => {
                        const tokenElement = document.createElement('div');
                        tokenElement.className = 'token';
                        tokenElement.innerHTML = \\\`
                            <h2>\${token.name} (\${token.symbol})</h2>
                            <p><strong>العنوان (Solana):</strong> <span class="token-address">\${token.tokenAddress}</span></p>
                            <p><strong>السعر:</strong> $\${token.price}</p>
                            <p><strong>القيمة السوقية:</strong> $\${token.marketCap}</p>
                            <p><strong>FDV (القيمة المخففة بالكامل):</strong> $\${token.fdv}</p>
                            <p><strong>حجم التداول (24 ساعة):</strong> $\${token.volume24h}</p>
                            <p><strong>تاريخ الإضافة لـ CMC:</strong> \${token.dateAdded} (منذ \${token.ageHours} ساعة)</p>
                            <p><strong>العرض المتداول:</strong> \${token.circulatingSupply} \${token.symbol}</p>
                            <p><strong>إجمالي العرض:</strong> \${token.totalSupply} \${token.symbol}</p>
                            \${token.maxSupply ? \\\`<p><strong>أقصى عرض:</strong> \${token.maxSupply} \${token.symbol}</p>\\\` : ''}
                            <p class="token-links">
                                <a href="\${token.cmcLink}" target="_blank" rel="noopener noreferrer">CoinMarketCap</a> | 
                                <a href="\${token.rugcheckLink}" target="_blank" rel="noopener noreferrer">Rugcheck</a> |
                                <a href="\${token.dexscreenerLink}" target="_blank" rel="noopener noreferrer">DexScreener</a>
                            </p>
                        \\\`;
                        resultsDiv.appendChild(tokenElement);
                    });
                } else {
                    messageDiv.textContent = 'لم يتم العثور على عملات تطابق المعايير المحددة.';
                    messageDiv.style.display = 'block';
                }
            } catch (err) {
                console.error('Fetch error:', err);
                loadingDiv.style.display = 'none';
                analyzeButton.disabled = false;
                errorDiv.textContent = 'حدث خطأ أثناء جلب البيانات: ' + err.message + '. حاول مرة أخرى.';
                errorDiv.style.display = 'block';
            }
        });
    </script>
</body>
</html>
`;

// Create HTTP server
const PORT = process.env.PORT || 3000;
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);

    if (parsedUrl.pathname === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(htmlContent);
    } else if (parsedUrl.pathname === '/api/analyze' && req.method === 'GET') {
        try {
            const analysisResults = await analyzeTokens();
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(analysisResults));
        } catch (error) {
            console.error("Error in /api/analyze endpoint:", error);
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Internal server error during analysis.' }));
        }
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Page Not Found - الصفحة غير موجودة');
    }
});

server.listen(PORT, () => {
    console.log(`HTTP server listening on port ${PORT}. Open http://localhost:${PORT}`);
});

// Graceful shutdown
function shutdown(signal) {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
    });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

console.log('Web server is running...');
