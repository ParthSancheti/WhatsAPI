const express = require('express');
const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error("> FATAL: MONGODB_URI environment variable is not set.");
    process.exit(1);
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- MULTI-ACCOUNT SETTINGS ---
// Start with ONE account to confirm the pipeline works on Render's RAM.
// Once Code1 reaches CONNECTED & ACTIVE, add 'Code2' back — but two Chrome
// instances need ~1GB+, so you'll likely need a paid instance for both.
const ACCOUNTS = ['Code1']; // ['Code1', 'Code2'];
const clients = new Map();
const qrHtmlMap = new Map();
const statusMap = new Map();

// Default UI State
ACCOUNTS.forEach(acc => {
    statusMap.set(acc, 'BOOTING SYSTEM...');
    qrHtmlMap.set(acc, '<div style="color: yellow; padding: 30px;">[ INITIALIZING... ]</div>');
});

// --- COMMAND LINE CONTROL DASHBOARD ---
app.get('/', (req, res) => {
    let grids = ACCOUNTS.map(acc => `
        <div style="border: 1px solid #0f0; padding: 15px; background: #000; width: 300px;">
            <h3 style="margin: 0 0 10px 0; color: #fff;">> ACCOUNT: [ ${acc} ]</h3>
            <div style="margin-bottom: 10px;">STATUS: <span style="color: cyan;">${statusMap.get(acc)}</span></div>
            <div style="background: #111; padding: 10px; text-align: center; border: 1px dashed #333;">
                ${qrHtmlMap.get(acc)}
            </div>
            <form method="POST" action="/logout/${acc}" style="margin-top: 12px;" onsubmit="return confirm('Logout ${acc}? You will need to re-scan the QR to link again.');">
                <button type="submit" style="width: 100%; padding: 8px; background: #100; color: #f55; border: 1px solid #f55; font-family: inherit; font-weight: bold; cursor: pointer; text-shadow: 0 0 4px #f55;">[ LOGOUT ${acc} ]</button>
            </form>
        </div>
    `).join('');

    res.send(`
        <html>
        <head>
            <title>UNSTUCK ENGINE HUB</title>
            <meta http-equiv="refresh" content="3"> <style>
                body { background-color: #050505; color: #0f0; font-family: 'Courier New', Courier, monospace; padding: 20px; }
                h1 { border-bottom: 2px solid #0f0; padding-bottom: 10px; text-shadow: 0 0 5px #0f0; }
                .container { display: flex; gap: 20px; flex-wrap: wrap; margin-top: 20px; }
            </style>
        </head>
        <body>
            <h1>>_ UNSTUCK ENGINE: MULTI-NODE COMMAND HUB</h1>
            <p>> SYSTEM LIVE. AUTO-REFRESHING DATA...</p>
            <div class="container">
                ${grids}
            </div>
        </body>
        </html>
    `);
});

// --- BOOT THE BOTS ---
async function startMultiBot() {
    console.log("> Connecting to Cloud Memory...");
    await mongoose.connect(MONGODB_URI);
    const store = new MongoStore({ mongoose: mongoose });
    console.log("> Database Connected.");

    // We know EXACTLY where Chrome is because of our Dockerfile!
    const browserPath = '/usr/bin/google-chrome-stable';

    for (const account of ACCOUNTS) {
        console.log(`> Booting Node: ${account}...`);
        
        const client = new Client({
            authStrategy: new RemoteAuth({
                clientId: account, 
                store: store,
                backupSyncIntervalMs: 300000 
            }),
            puppeteer: {
                executablePath: browserPath,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
            }
        });

        client.on('qr', async (qr) => {
            statusMap.set(account, 'AWAITING SCAN');
            try {
                const qrImage = await qrcode.toDataURL(qr);
                qrHtmlMap.set(account, `<img src="${qrImage}" style="width: 100%; border: 2px solid white; border-radius: 5px;" /><br><small style="color: white; margin-top:5px; display:block;">SCAN TO LINK</small>`);
            } catch (err) {
                console.error(`> [${account}] QR generation failed:`, err);
            }
        });

        client.on('remote_session_saved', () => {
            console.log(`> [${account}] Session permanently saved to MongoDB!`);
        });

        client.on('ready', () => {
            console.log(`> [${account}] IS LOCKED IN AND READY!`);
            statusMap.set(account, 'CONNECTED & ACTIVE');
            qrHtmlMap.set(account, '<div style="color: #0f0; font-weight: bold; font-size: 1.2em; padding: 40px 0;">[ LINKED ]</div>');
        });

        client.on('authenticated', () => {
            statusMap.set(account, 'AUTHENTICATING...');
            qrHtmlMap.set(account, '<div style="color: yellow; padding: 30px;">[ PROCESSING... ]</div>');
        });

        client.initialize();
        clients.set(account, client);
        
        // Wait 4 seconds before booting the next account to protect server RAM
        await new Promise(resolve => setTimeout(resolve, 4000));
    }
}

// --- APPS SCRIPT API ENDPOINT ---
app.post('/send', async (req, res) => {
    const { number, message, account } = req.body;
    
    // Default to Code1 if your Apps Script doesn't specify an account
    const targetAccount = account || 'Code1'; 
    const client = clients.get(targetAccount);

    if (!client || statusMap.get(targetAccount) !== 'CONNECTED & ACTIVE') {
        return res.status(400).send({ error: `Account ${targetAccount} is not linked or ready.` });
    }

    const chatId = number + "@c.us";
    
    try {
        await client.sendMessage(chatId, message);
        console.log(`> [${targetAccount}] Message sent to ${number}`);
        res.status(200).send({ status: 'Success', account: targetAccount });
    } catch (error) {
        console.error(`> [${targetAccount}] Error sending to ${number}:`, error);
        res.status(500).send({ error: 'Failed to send' });
    }
});

// --- LOGOUT ENDPOINT ---
app.post('/logout/:account', async (req, res) => {
    const account = req.params.account;
    const client = clients.get(account);

    if (!client) {
        return res.redirect('/');
    }

    try {
        statusMap.set(account, 'LOGGING OUT...');
        // logout() destroys the WhatsApp session (clears it from MongoDB too)
        await client.logout();
        console.log(`> [${account}] Logged out and session cleared.`);
    } catch (err) {
        console.error(`> [${account}] Logout error:`, err);
    }

    try {
        await client.destroy();
        await client.initialize(); // restart so a fresh QR is generated
    } catch (err) {
        console.error(`> [${account}] Re-init error:`, err);
    }

    statusMap.set(account, 'AWAITING SCAN');
    qrHtmlMap.set(account, '<div style="color: yellow; padding: 30px;">[ GENERATING NEW QR... ]</div>');
    res.redirect('/');
});

startMultiBot();

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`> Terminal Server running on port ${port}`));
