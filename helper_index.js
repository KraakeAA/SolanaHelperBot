// helper_index.js - Simple Dice Helper Bot (Modified for Emoji)

import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';

const HELPER_BOT_TOKEN = process.env.HELPER_BOT_TOKEN;
if (!HELPER_BOT_TOKEN) {
    console.error("FATAL ERROR: HELPER_BOT_TOKEN is not defined for the Dice Helper Bot.");
    process.exit(1);
}
const bot = new TelegramBot(HELPER_BOT_TOKEN, { polling: true });
console.log("Dice Helper Bot initializing (Emoji Mode)...");

// Listen for ANY message. We will check if it's a dice emoji.
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name || `User ${userId}`;

    // Check if the message contains a dice object and if the emoji is the standard die 🎲
    if (msg.dice && msg.dice.emoji === '🎲') {
        const rollValue = msg.dice.value; // Telegram provides the value here

        // The helper bot will send a message containing ONLY the roll value as text.
        // This is what the main casino bot will parse.
        bot.sendMessage(chatId, `${rollValue}`)
            .then(() => {
                console.log(`Dice Helper Bot: User ${username} (${userId}) sent 🎲, got ${rollValue}. Helper responded with "${rollValue}" to chat ${chatId}`);
            })
            .catch(err => {
                console.error(`Dice Helper Bot: Error sending roll value message to chat ${chatId}:`, err.message);
            });
    }
    // You can still keep the /roll command as a fallback or alternative if you like:
    else if (msg.text && msg.text.toLowerCase() === '/roll') {
        const rollValueFallback = Math.floor(Math.random() * 6) + 1;
        bot.sendMessage(chatId, `${rollValueFallback}`)
            .then(() => {
                console.log(`Dice Helper Bot: User ${username} used /roll, got ${rollValueFallback}. Helper responded with "${rollValueFallback}" to chat ${chatId}`);
            })
            .catch(err => {
                console.error(`Dice Helper Bot: Error sending /roll fallback message to chat ${chatId}:`, err.message);
            });
    }
});

bot.onText(/\/start|\/help/i, (msg) => {
    const chatId = msg.chat.id;
    const helpText = "I am a Dice Helper Bot. When prompted by another game bot, send the 🎲 emoji to roll. Alternatively, you can type `/roll`. I will provide a dice result (1-6).";
    bot.sendMessage(chatId, helpText);
});

bot.on('polling_error', (error) => { /* ... as before ... */ });
async function startHelperBot() { /* ... as before ... */
    try {
        const me = await bot.getMe();
        console.log(`Dice Helper Bot (@${me.username}) with ID: ${me.id} is now running and listening for 🎲 emojis and /roll commands.`);
    } catch (error) { /* ... */ }
}
startHelperBot();
