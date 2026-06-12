const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());

// Initialize WhatsApp Web with Puppeteer settings for the cloud
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    // This logs the QR code to the Render console
    qrcode.generate(qr, { small: true });
    console.log("SCAN THE QR CODE ABOVE WITH YOUR PHONE");
});

client.on('ready', () => {
    console.log('WhatsApp Bot is locked in and ready!');
});

// The endpoint Google Apps Script will talk to
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

// Render uses the process.env.PORT variable
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));