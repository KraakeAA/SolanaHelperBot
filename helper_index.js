// helper_index.js - Modifications for mentioning the main bot

import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';

const HELPER_BOT_TOKEN = process.env.HELPER_BOT_TOKEN;
if (!HELPER_BOT_TOKEN) {
    console.error("FATAL ERROR: HELPER_BOT_TOKEN is not defined for the Dice Helper Bot.");
    process.exit(1);
}
const bot = new TelegramBot(HELPER_BOT_TOKEN, { polling: true });
console.log("Dice Helper Bot initializing (Emoji Mode with Mention)...");

// !!! DEFINE YOUR MAIN BOT'S USERNAME HERE (without @) !!!
const MAIN_CASINO_BOT_USERNAME = "SolanaChatBot"; // Or load from an env variable if you prefer

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name || `User ${userId}`;

    if (msg.dice && msg.dice.emoji === '🎲') {
        const rollValue = msg.dice.value;
        
        // --- MODIFIED RESPONSE ---
        // Format: @MainBotUsername <roll_value>
        // Example: @SolanaChatBot 5
        const responseText = `@${MAIN_CASINO_BOT_USERNAME} ${rollValue}`; 
        // --- END MODIFIED RESPONSE ---

        bot.sendMessage(chatId, responseText)
            .then(() => {
                console.log(`Dice Helper Bot: User ${username} (${userId}) sent 🎲, got ${rollValue}. Helper responded with "${responseText}" to chat ${chatId}`);
            })
            .catch(err => {
                console.error(`Dice Helper Bot: Error sending roll value message to chat ${chatId}:`, err.message);
            });
    }
    else if (msg.text && msg.text.toLowerCase() === '/roll') {
        const rollValueFallback = Math.floor(Math.random() * 6) + 1;
        
        // --- MODIFIED RESPONSE ---
        const responseTextFallback = `@${MAIN_CASINO_BOT_USERNAME} ${rollValueFallback}`;
        // --- END MODIFIED RESPONSE ---

        bot.sendMessage(chatId, responseTextFallback)
            .then(() => {
                console.log(`Dice Helper Bot: User ${username} used /roll, got ${rollValueFallback}. Helper responded with "${responseTextFallback}" to chat ${chatId}`);
            })
            .catch(err => {
                console.error(`Dice Helper Bot: Error sending /roll fallback message to chat ${chatId}:`, err.message);
            });
    }
});

bot.onText(/\/start|\/help/i, (msg) => {
    const chatId = msg.chat.id;
    const helpText = "I am a Dice Helper Bot. When prompted by another game bot, send the 🎲 emoji to roll. Alternatively, you can type `/roll`. I will provide a dice result (1-6) by mentioning the main bot.";
    bot.sendMessage(chatId, helpText);
});

bot.on('polling_error', (error) => {
    console.error(`\n🚫 HELPER POLLING ERROR 🚫 Code: ${error.code}`);
    console.error(`Message: ${error.message}`);
    console.error(error);
});

async function startHelperBot() {
    try {
        const me = await bot.getMe();
        console.log(`Dice Helper Bot (@${me.username}) with ID: ${me.id} is now running and listening for 🎲 emojis and /roll commands (mentioning @${MAIN_CASINO_BOT_USERNAME}).`);
    } catch (error) {
        console.error("❌ CRITICAL STARTUP ERROR (Helper Bot getMe):", error);
        process.exit(1);
    }
}
startHelperBot();
