// helper_index.js - Simple Dice Helper Bot

import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';

const HELPER_BOT_TOKEN = process.env.HELPER_BOT_TOKEN;
// const ADMIN_ID = process.env.ADMIN_USER_ID_HELPER; // Optional

if (!HELPER_BOT_TOKEN) {
    console.error("FATAL ERROR: HELPER_BOT_TOKEN is not defined for the Dice Helper Bot.");
    process.exit(1);
}

const bot = new TelegramBot(HELPER_BOT_TOKEN, { polling: true });

console.log("Dice Helper Bot initializing...");

// Listen for a specific command, e.g., /roll
// This command can be issued by any user in a group where the helper bot is present.
bot.onText(/\/roll/i, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name || `User ${userId}`;

    // Generate a standard D6 roll
    const rollValue = Math.floor(Math.random() * 6) + 1;

    // The helper bot will send a message containing ONLY the roll value as text.
    // Your main casino bot will look for messages from this helper bot
    // and parse this number.
    bot.sendMessage(chatId, `${rollValue}`)
        .then(() => {
            console.log(`Dice Helper Bot: Sent roll value "${rollValue}" to chat ${chatId} for user ${username} (${userId})`);
        })
        .catch(err => {
            console.error(`Dice Helper Bot: Error sending roll message to chat ${chatId}:`, err.message);
        });
});

// Optional: A /start or /help command for the helper bot itself
bot.onText(/\/start|\/help/i, (msg) => {
    const chatId = msg.chat.id;
    const helpText = "I am a Dice Helper Bot. When prompted by another game bot or if you just want a quick roll, type `/roll` and I will provide a dice result (1-6).";
    bot.sendMessage(chatId, helpText);
});

// Basic error logging for polling errors
bot.on('polling_error', (error) => {
    console.error(`Dice Helper Bot - Polling Error: ${error.code} - ${error.message}`);
    // You might want to add more robust error handling or notifications here
});

// Main startup sequence for the helper bot
async function startHelperBot() {
    try {
        const me = await bot.getMe();
        console.log(`Dice Helper Bot (@${me.username}) is now running and listening for /roll commands.`);
        // if (ADMIN_ID) {
        //     bot.sendMessage(ADMIN_ID, `Dice Helper Bot (@${me.username}) started successfully.`).catch();
        // }
    } catch (error) {
        console.error("CRITICAL: Dice Helper Bot failed to start or connect to Telegram.", error);
        process.exit(1);
    }
}

startHelperBot();
