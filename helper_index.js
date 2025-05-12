// helper_index.js - Dice Helper Bot (Direct Reply Strategy)
// This bot listens for prompts from the main casino bot and replies directly.

import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';

// Environment variable for this Helper Bot's token
const HELPER_BOT_TOKEN = process.env.HELPER_BOT_TOKEN;

// Environment variable for the Main Casino Bot's User ID
// The helper bot will listen for messages from this specific bot ID.
const MAIN_CASINO_BOT_ID_TO_LISTEN_TO = process.env.MAIN_CASINO_BOT_ID_TO_LISTEN_TO;

if (!HELPER_BOT_TOKEN) {
    console.error("FATAL ERROR: HELPER_BOT_TOKEN is not defined for the Dice Helper Bot.");
    process.exit(1);
}

if (!MAIN_CASINO_BOT_ID_TO_LISTEN_TO) {
    console.error("FATAL ERROR: MAIN_CASINO_BOT_ID_TO_LISTEN_TO is not defined. Helper bot doesn't know which main bot to listen for.");
    process.exit(1);
}

const bot = new TelegramBot(HELPER_BOT_TOKEN, { polling: true });
console.log("Dice Helper Bot initializing (Direct Reply Strategy)...");

// Listen for ANY message.
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const messageId = msg.message_id; // This is the ID of the incoming message
    const senderId = String(msg.from.id);
    const senderUsername = msg.from.username || msg.from.first_name || `User ${senderId}`;

    // Log all messages this helper bot sees for its own debugging purposes
    console.log(`[HELPER_RAW_MSG_SEEN] FromID: ${senderId}, User: @${senderUsername}, Text: "${msg.text || 'N/A'}", ChatID: ${chatId}, MsgID: ${messageId}`);

    // Check if the message is from the configured Main Casino Bot
    // AND if its text contains a phrase indicating a dice roll is needed.
    // The phrase "determine your roll" is part of the main bot's prompt.
    if (senderId === String(MAIN_CASINO_BOT_ID_TO_LISTEN_TO) && 
        msg.text && 
        msg.text.toLowerCase().includes("determine your roll")) {
        
        console.log(`Helper Bot: Detected prompt message from Main Casino Bot (ID: ${senderId}) in chat ${chatId}.`);
        console.log(`Helper Bot: Main Bot's message was (ID: ${messageId}): "${msg.text}"`);
        
        // Generate a random dice roll (1-6)
        const rollValue = Math.floor(Math.random() * 6) + 1;
        console.log(`Helper Bot: Generated roll value: ${rollValue}`);

        // Helper bot sends a message containing ONLY the roll value as text,
        // replying directly to the Main Casino Bot's prompt message.
        try {
            await bot.sendMessage(chatId, `${rollValue}`, { 
                reply_to_message_id: messageId // CRITICAL: Reply to the main bot's prompt message
            });
            console.log(`Helper Bot: Successfully replied with "${rollValue}" to Main Bot's message ID ${messageId} in chat ${chatId}.`);
        } catch (error) {
            console.error(`Helper Bot: Error sending reply message to chat ${chatId} (replying to msg ID ${messageId}):`, error.message);
            // Log more error details if available
            if (error.response && error.response.body) {
                console.error(`Helper Bot: Telegram API Error Details: ${JSON.stringify(error.response.body)}`);
            }
        }
    }
});

// Standard help/start command for the helper bot
bot.onText(/\/start|\/help/i, (msg) => {
    const chatId = msg.chat.id;
    const helpText = "I am a Dice Helper Bot. I automatically listen for prompts from the main casino bot and reply with a dice roll (1-6). You don't need to interact with me directly for the game after the main bot has prompted for a roll.";
    bot.sendMessage(chatId, helpText);
});

// Polling error handler for the helper bot
bot.on('polling_error', (error) => {
    console.error(`\n🚫 HELPER BOT POLLING ERROR 🚫 Code: ${error.code}`);
    console.error(`Helper Bot: Message - ${error.message}`);
    // Log the full error object for more details if needed
    // console.error(error); 
});

// General error handler for the helper bot
bot.on('error', (error) => {
    console.error('\n🔥 HELPER BOT GENERAL ERROR EVENT 🔥:', error);
});

// Startup function for the helper bot
async function startHelperBot() {
    try {
        const me = await bot.getMe();
        console.log(`Dice Helper Bot (@${me.username}) with ID: ${me.id} is now running.`);
        console.log(`Monitoring for prompt messages from Main Casino Bot ID: ${MAIN_CASINO_BOT_ID_TO_LISTEN_TO}.`);
    } catch (error) {
        console.error("❌ CRITICAL STARTUP ERROR (Helper Bot getMe):", error);
        // Optionally, notify an admin if this helper bot also has an ADMIN_USER_ID configured
        process.exit(1); // Exit if it can't connect
    }
}

// Start the helper bot
startHelperBot();

console.log("Dice Helper Bot setup complete. Waiting for messages...");
