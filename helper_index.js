// helper_index.js - Versatile Animated Emoji Helper Bot (Database Polling)
// This bot polls the database for roll requests, sends the specified animated emoji,
// and updates the database with the result from the animated emoji roll.

import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import { Pool } from 'pg'; // For PostgreSQL

// --- Environment Variable Validation & Configuration ---
console.log("Helper Bot: Loading environment variables...");

const HELPER_BOT_TOKEN = process.env.HELPER_BOT_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;
const POLLING_INTERVAL_MS = process.env.HELPER_DB_POLL_INTERVAL_MS ? parseInt(process.env.HELPER_DB_POLL_INTERVAL_MS, 10) : 3000;
const MAX_REQUESTS_PER_CYCLE = process.env.HELPER_MAX_REQUESTS_PER_CYCLE ? parseInt(process.env.HELPER_MAX_REQUESTS_PER_CYCLE, 10) : 5;

if (!HELPER_BOT_TOKEN) {
    console.error("FATAL ERROR: HELPER_BOT_TOKEN is not defined for the Helper Bot.");
    process.exit(1);
}
if (!DATABASE_URL) {
    console.error("FATAL ERROR: DATABASE_URL is not defined. Helper bot cannot connect to PostgreSQL.");
    process.exit(1);
}
console.log(`Helper Bot: HELPER_BOT_TOKEN loaded.`);
console.log(`Helper Bot: DATABASE_URL loaded.`);
console.log(`Helper Bot: Database polling interval set to ${POLLING_INTERVAL_MS}ms.`);
console.log(`Helper Bot: Max requests per cycle set to ${MAX_REQUESTS_PER_CYCLE}.`);

// --- PostgreSQL Pool Initialization ---
console.log("Helper Bot: ⚙️ Setting up PostgreSQL Pool...");
const useSslHelper = process.env.DB_SSL === undefined ? true : (process.env.DB_SSL === 'true');
const rejectUnauthorizedSslHelper = process.env.DB_REJECT_UNAUTHORIZED === undefined ? false : (process.env.DB_REJECT_UNAUTHORIZED === 'true');
console.log(`Helper Bot: DB_SSL effective setting: ${useSslHelper}`);
console.log(`Helper Bot: DB_REJECT_UNAUTHORIZED effective setting: ${rejectUnauthorizedSslHelper}`);

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: useSslHelper ? { rejectUnauthorized: rejectUnauthorizedSslHelper } : false,
    // max: 5, // Optional: pool size for helper
});

pool.on('connect', client => {
    console.log('Helper Bot: ℹ️ [DB Pool] Client connected to PostgreSQL.');
});
pool.on('error', (err, client) => {
    console.error('Helper Bot: ❌ Unexpected error on idle PostgreSQL client', err);
});
console.log("Helper Bot: ✅ PostgreSQL Pool created.");

// --- Telegram Bot Initialization ---
const bot = new TelegramBot(HELPER_BOT_TOKEN, { polling: true }); // Polling for helper bot's own commands like /start
console.log("Helper Bot: Telegram Bot instance created.");

// --- Database Polling Function ---
async function checkAndProcessRollRequests() {
    let client = null;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // --- MODIFIED: Select emoji_type as well ---
        const selectQuery = `
            SELECT request_id, game_id, chat_id, user_id, emoji_type 
            FROM dice_roll_requests
            WHERE status = 'pending'
            ORDER BY requested_at ASC
            LIMIT $1
            FOR UPDATE SKIP LOCKED`;
        const result = await client.query(selectQuery, [MAX_REQUESTS_PER_CYCLE]);

        if (result.rows.length === 0) {
            await client.query('COMMIT');
            client.release();
            return;
        }

        console.log(`[DB_POLL] Helper Bot: Found ${result.rows.length} pending request(s).`);

        for (const request of result.rows) {
            console.log(`[DB_PROCESS] Helper Bot: Processing request_id: ${request.request_id} for game_id: ${request.game_id}, emoji: ${request.emoji_type || '🎲 (default)'}`);
            let rollValue = null;
            let updateStatus = 'error';
            // --- MODIFIED: Determine emoji to send ---
            const emojiToSend = request.emoji_type || '🎲'; // Default to standard dice if not specified

            try {
                console.log(`[HELPER_SEND_EMOJI] Sending animated emoji '${emojiToSend}' to chat_id: ${request.chat_id} for request ${request.request_id}`);
                // --- MODIFIED: Use emojiToSend ---
                const sentMessage = await bot.sendDice(request.chat_id, { emoji: emojiToSend });

                if (sentMessage && sentMessage.dice) {
                    rollValue = sentMessage.dice.value;
                    updateStatus = 'completed';
                    console.log(`[HELPER_SEND_EMOJI] Emoji '${emojiToSend}' sent successfully for request ${request.request_id}. Result Value: ${rollValue}`);
                } else {
                    console.error(`[HELPER_SEND_EMOJI_ERROR] Failed to get dice result for request ${request.request_id}.`);
                }
            } catch (sendError) {
                console.error(`[HELPER_SEND_EMOJI_ERROR] Failed to send emoji '${emojiToSend}' to chat_id ${request.chat_id} for request ${request.request_id}:`, sendError.message);
                if (sendError.response && sendError.response.body) {
                    console.error(`[HELPER_SEND_EMOJI_ERROR] API Error Details: ${JSON.stringify(sendError.response.body)}`);
                }
            }

            const updateQuery = `
                UPDATE dice_roll_requests
                SET status = $1, roll_value = $2, processed_at = NOW()
                WHERE request_id = $3 AND status = 'pending'`; // Ensure we only update if still pending
            const updateResult = await client.query(updateQuery, [updateStatus, rollValue, request.request_id]);

            if (updateResult.rowCount > 0) {
                console.log(`[DB_PROCESS] Helper Bot: Updated request_id: ${request.request_id} to status '${updateStatus}'${rollValue !== null ? ` with value ${rollValue}` : ''}.`);
            } else {
                console.warn(`[DB_PROCESS_WARN] Helper Bot: Failed to update request_id: ${request.request_id}. Status might have changed concurrently.`);
            }
        }
        await client.query('COMMIT');
    } catch (error) {
        console.error('[DB_POLL_ERROR] Helper Bot: Error during DB check/processing cycle:', error);
        if (client) {
            try { await client.query('ROLLBACK'); console.log('[DB_POLL_ERROR] Helper Bot: Transaction rolled back.'); }
            catch (rollbackError) { console.error('[DB_POLL_ERROR] Helper Bot: Failed to rollback:', rollbackError); }
        }
    } finally {
        if (client) {
            client.release();
        }
    }
}

// --- Telegram Bot Event Handlers (for Helper Bot's own interactions) ---
bot.onText(/\/start|\/help/i, (msg) => {
    const chatId = msg.chat.id;
    // --- MODIFIED: Updated help text ---
    const helpText = "I am an Animated Emoji Helper Bot.\n" +
                     "I process requests from the main casino bot to send animated emojis (like 🎲, 🎯, 🎰, etc.) and report their random results back.\n" +
                     "You do not need to interact with me directly.";
    bot.sendMessage(chatId, helpText);
});

bot.on('polling_error', (error) => {
    console.error(`\n🚫 HELPER BOT TELEGRAM POLLING ERROR 🚫 Code: ${error.code}, Msg: ${error.message}`);
});
bot.on('error', (error) => {
    console.error('\n🔥 HELPER BOT GENERAL TELEGRAM LIBRARY ERROR EVENT 🔥:', error);
});

// --- Startup Function ---
let dbPollingIntervalId = null;

async function startHelperBot() {
    console.log(`\n🚀🚀🚀 Initializing Animated Emoji Helper Bot 🚀🚀🚀`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    try {
        console.log("Helper Bot: Testing DB connection...");
        const dbClient = await pool.connect();
        console.log("Helper Bot: ✅ DB connected.");
        await dbClient.query('SELECT NOW()');
        console.log("Helper Bot: ✅ DB query test OK.");
        dbClient.release();

        console.log("Helper Bot: Connecting to Telegram...");
        const me = await bot.getMe();
        console.log(`Helper Bot: ✅ Connected to Telegram! Bot: @${me.username} (ID: ${me.id})`);

        dbPollingIntervalId = setInterval(checkAndProcessRollRequests, POLLING_INTERVAL_MS);
        console.log(`Helper Bot: ✅ DB polling started (Interval: ${POLLING_INTERVAL_MS}ms).`);
        console.log(`\n🎉 Helper Bot operational!`);
    } catch (error) {
        console.error("❌ CRITICAL STARTUP ERROR (Helper Bot):", error);
        if (pool) { try { await pool.end(); } catch (e) { /* ignore */ } }
        process.exit(1);
    }
}

// --- Shutdown Handling ---
let isShuttingDownHelper = false;
async function shutdownHelper(signal) {
    if (isShuttingDownHelper) {
        console.log("Helper Bot: Shutdown already in progress."); return;
    }
    isShuttingDownHelper = true;
    console.log(`\n🚦 Received ${signal}. Shutting down Helper Bot...`);
    if (dbPollingIntervalId) clearInterval(dbPollingIntervalId);
    console.log("Helper Bot: DB polling stopped.");
    if (bot && bot.isPolling()) {
        try { await bot.stopPolling({ cancel: true }); console.log("Helper Bot: Telegram polling stopped."); }
        catch(e) { console.error("Helper Bot: Error stopping Telegram polling:", e.message); }
    }
    if (pool) {
        try { await pool.end(); console.log("Helper Bot: PostgreSQL pool closed."); }
        catch(e) { console.error("Helper Bot: Error closing PostgreSQL pool:", e.message); }
    }
    console.log("Helper Bot: ✅ Shutdown complete. Exiting.");
    process.exit(0);
}

process.on('SIGINT', async () => await shutdownHelper('SIGINT'));
process.on('SIGTERM', async () => await shutdownHelper('SIGTERM'));
process.on('uncaughtException', (error, origin) => {
    console.error(`\n🚨🚨 HELPER BOT UNCAUGHT EXCEPTION AT: ${origin} 🚨🚨`, error);
    // For a simple helper, exiting might be okay. For main bot, graceful shutdown attempt is better.
    shutdownHelper('uncaughtException_exit').catch(() => process.exit(1)); // Attempt graceful then force
});
process.on('unhandledRejection', (reason, promise) => {
    console.error(`\n🔥🔥 HELPER BOT UNHANDLED REJECTION 🔥🔥`, reason);
});

// --- Start the Bot ---
startHelperBot();

console.log("Helper Bot: End of script. Startup process initiated.");
// --- END OF helper_index.js ---
