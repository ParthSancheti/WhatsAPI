const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

// Wrap the bot in an async function so it can 'await' the Chrome path
async function startBot() {
    // 1. Wait for Puppeteer to actually find the Chrome path
    const browserPath = await puppeteer.executablePath();
    console.log("Chrome locked in at:", browserPath);

    // 2. Boot the WhatsApp Client
    const client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            executablePath: browserPath,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        }
    });

    client.on('qr', (qr) => {
        qrcode.generate(qr, { small: true });
        console.log("\n>>> SCAN THE QR CODE ABOVE WITH YOUR PHONE <<<\n");
    });

    client.on('ready', () => {
        console.log('WhatsApp Bot is locked in and ready!');
    });

    app.post('/send', async (req, res) => {
        const { number, message } = req.body;
        const chatId = number + "@c.us";
        
        try {
            await client.sendMessage(chatId, message);
            console.log(`Message sent to ${number}`);
            res.status(200).send({ status: 'Success' });
        } catch (error) {
            console.error(`Error sending to ${number}:`, error);
            res.status(500).send({ error: 'Failed to send' });
        }
    });

    client.initialize();
}

// Start the engine
startBot();

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));