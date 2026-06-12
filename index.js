const express = require('express');
const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode'); // Replaced the terminal version with the image version
const puppeteer = require('puppeteer');

const MONGODB_URI = "mongodb+srv://parthsancheti5_db_user:QAFiwE6UbV1l7VxT@cluster0.nkozhdg.mongodb.net/?retryWrites=true&w=majority";

const app = express();
app.use(express.json());

// This holds the HTML we will show on your webpage
let qrHtml = "<h2 style='text-align:center; margin-top:50px; font-family:sans-serif;'>QR Code is generating... please refresh this page in 10 seconds.</h2>";

async function startCloudBot() {
    console.log("Connecting to Cloud Memory (MongoDB)...");
    await mongoose.connect(MONGODB_URI);
    console.log("Database connected!");

    const store = new MongoStore({ mongoose: mongoose });

    console.log("Booting Chrome in the Cloud...");
    const client = new Client({
        authStrategy: new RemoteAuth({
            store: store,
            backupSyncIntervalMs: 300000 
        }),
        puppeteer: {
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        }
    });

    client.on('qr', async (qr) => {
        console.log(">>> NEW QR CODE READY! Open your Render URL to see it. <<<");
        try {
            // Converts the QR data into a real image!
            const qrImage = await qrcode.toDataURL(qr);
            qrHtml = `
                <div style="text-align:center; margin-top:50px; font-family:sans-serif;">
                    <h2>Scan this with WhatsApp</h2>
                    <img src="${qrImage}" style="width:300px; height:300px; border:2px solid black; border-radius:10px; padding: 10px;" />
                    <p style="color: #666;">If it times out and expires, just refresh this page.</p>
                </div>
            `;
        } catch (err) {
            console.error("Failed to generate QR image", err);
        }
    });

    client.on('remote_session_saved', () => {
        console.log('✅ Session safely stored in MongoDB!');
    });

    client.on('ready', () => {
        console.log('🚀 WhatsApp Bot is locked in and ready for commands!');
        // Update the webpage so you know it worked
        qrHtml = "<h2 style='text-align:center; color:green; margin-top:50px; font-family:sans-serif;'>✅ Bot is successfully connected to your phone! You can close this page.</h2>";
    });

    // When you visit your Render URL, this serves the QR Code image
    app.get('/', (req, res) => {
        res.send(qrHtml);
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