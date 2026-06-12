const express = require('express');
const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');

// ---> PASTE YOUR MONGODB URL HERE <---
const MONGODB_URI = "mongodb+srv://parthsancheti5_db_user:QAFiwE6UbV1l7VxT@cluster0.nkozhdg.mongodb.net/?appName=Cluster0";

const app = express();
app.use(express.json());

// Boot Sequence
async function startCloudBot() {
    console.log("Connecting to Cloud Memory (MongoDB)...");
    await mongoose.connect(MONGODB_URI);
    console.log("Database connected!");

    const store = new MongoStore({ mongoose: mongoose });

    const client = new Client({
        authStrategy: new RemoteAuth({
            store: store,
            backupSyncIntervalMs: 300000 // Syncs session to database every 5 minutes
        }),
        puppeteer: {
            // These arguments are strictly required for Render's cloud servers
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        }
    });

    client.on('qr', (qr) => {
        qrcode.generate(qr, { small: true });
        console.log("\n>>> CLOUD QR: SCAN THIS WITH YOUR PHONE <<<\n");
    });

    client.on('remote_session_saved', () => {
        console.log('Session safely stored in MongoDB! The bot will now survive server restarts.');
    });

    client.on('ready', () => {
        console.log('WhatsApp Bot is locked in and ready for commands!');
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

startCloudBot();

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));