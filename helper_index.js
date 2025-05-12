// helper_index.js - Modified to reply to user's trigger and mention main bot

import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';

const HELPER_BOT_TOKEN = process.env.HELPER_BOT_TOKEN;
if (!HELPER_BOT_TOKEN) {
    console.error("FATAL ERROR: HELPER_BOT_TOKEN is not defined for the Dice Helper Bot.");
    process.exit(1);
}
const bot = new TelegramBot(HELPER_BOT_TOKEN, { polling: true });
console.log("Dice Helper Bot initializing (Reply & Mention Mode)...");

const MAIN_CASINO_BOT_USERNAME = "SolanaChatBot"; // Your main bot's username

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name || `User ${userId}`;
    const triggerMessageId = msg.message_id; // ID of the message that triggered the helper (e.g., the 🎲 emoji message)

    let rollValue = null;
    let triggerType = "";

    if (msg.dice && msg.dice.emoji === '🎲') {
        rollValue = msg.dice.value;
        triggerType = "dice emoji";
    } else if (msg.text && msg.text.toLowerCase() === '/roll') {
        rollValue = Math.floor(Math.random() * 6) + 1;
        triggerType = "/roll command";
    }

    if (rollValue !== null) {
        // Format: @MainBotUsername <roll_value>
        // Example: @SolanaChatBot 5
        const responseText = `@${MAIN_CASINO_BOT_USERNAME} ${rollValue}`;
        
        const sendOptions = {
            reply_to_message_id: triggerMessageId // Reply to the user's 🎲 or /roll message
        };

        bot.sendMessage(chatId, responseText, sendOptions)
            .then(() => {
                console.log(`Dice Helper Bot: User ${username} (${userId}) used ${triggerType}, got ${rollValue}. Helper replied with "${responseText}" to message ${triggerMessageId} in chat ${chatId}`);
            })
            .catch(err => {
                console.error(`Dice Helper Bot: Error sending reply message to chat ${chatId}:`, err.message);
            });
    }
});

bot.onText(/\/start|\/help/i, (msg) => {
    const chatId = msg.chat.id;
    const helpText = "I am a Dice Helper Bot. When prompted, send the 🎲 emoji or type `/roll`. I will reply with a dice result (1-6), mentioning the main bot.";
    bot.sendMessage(chatId, helpText);
});

bot.on('polling_error', (error) => { /* ... same as before ... */ });
async function startHelperBot() { /* ... same as before, but update log message if you like ... */
    try {
        const me = await bot.getMe();
        console.log(`Dice Helper Bot (@${me.username}) with ID: ${me.id} is running (Reply & Mention Mode to @${MAIN_CASINO_BOT_USERNAME}).`);
    } catch (error) {
        console.error("❌ CRITICAL STARTUP ERROR (Helper Bot getMe):", error);
        process.exit(1);
    }
}
startHelperBot();
