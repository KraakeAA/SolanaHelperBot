// helper_index.js - Dice Helper Bot (Database Polling Strategy)
// This bot polls the database for roll requests and updates them.

import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import { Pool } from 'pg'; // For PostgreSQL

// --- Environment Variable Validation & Configuration ---
console.log("Helper Bot: Loading environment variables...");

const HELPER_BOT_TOKEN = process.env.HELPER_BOT_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL; // Crucial for DB connection
const POLLING_INTERVAL_MS = process.env.HELPER_DB_POLL_INTERVAL_MS ? parseInt(process.env.HELPER_DB_POLL_INTERVAL_MS, 10) : 3000; // Check DB every 3 seconds by default
const MAX_REQUESTS_PER_CYCLE = process.env.HELPER_MAX_REQUESTS_PER_CYCLE ? parseInt(process.env.HELPER_MAX_REQUESTS_PER_CYCLE, 10) : 5; // Process up to 5 requests per DB check

if (!HELPER_BOT_TOKEN) {
    console.error("FATAL ERROR: HELPER_BOT_TOKEN is not defined for the Dice Helper Bot.");
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

// Use similar SSL settings as your main bot for consistency if needed
// Apply defaults if specific SSL vars aren't set for the helper
const useSslHelper = process.env.DB_SSL === undefined ? true : (process.env.DB_SSL === 'true'); // Default true if not set
const rejectUnauthorizedSslHelper = process.env.DB_REJECT_UNAUTHORIZED === undefined ? false : (process.env.DB_REJECT_UNAUTHORIZED === 'true'); // Default false if not set

console.log(`Helper Bot: DB_SSL effective setting: ${useSslHelper}`);
console.log(`Helper Bot: DB_REJECT_UNAUTHORIZED effective setting: ${rejectUnauthorizedSslHelper}`);

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: useSslHelper ? { rejectUnauthorized: rejectUnauthorizedSslHelper } : false,
    // Optional: Set pool size limits for helper bot if needed
    // max: 5,
    // min: 1,
    // idleTimeoutMillis: 30000,
});

pool.on('connect', client => {
    console.log('Helper Bot: ℹ️ [DB Pool] Client connected to PostgreSQL.');
});
pool.on('error', (err, client) => {
    console.error('Helper Bot: ❌ Unexpected error on idle PostgreSQL client', err);
    // Optional: Add admin notification logic here if desired
});
console.log("Helper Bot: ✅ PostgreSQL Pool created.");

// --- Telegram Bot Initialization ---
const bot = new TelegramBot(HELPER_BOT_TOKEN, { polling: true });
console.log("Helper Bot: Telegram Bot instance created and configured for polling.");

// --- Database Polling Function ---
async function checkAndProcessRollRequests() {
    // console.log('[DB_POLL] Checking for pending dice roll requests...'); // Uncomment for verbose logging
    let client = null; // Use a single client for the transaction within this check cycle
    try {
        client = await pool.connect();
        await client.query('BEGIN'); // Start transaction

        // Select pending requests AND lock them using FOR UPDATE SKIP LOCKED
        // This prevents multiple instances of the helper (if you scale it) from processing the same request.
        // It selects the oldest pending requests first.
        const selectQuery = `
            SELECT request_id, game_id, chat_id, user_id
            FROM dice_roll_requests
            WHERE status = 'pending'
            ORDER BY requested_at ASC
            LIMIT $1
            FOR UPDATE SKIP LOCKED`;
        const result = await client.query(selectQuery, [MAX_REQUESTS_PER_CYCLE]);

        if (result.rows.length === 0) {
            // console.log('[DB_POLL] No pending requests found.'); // Uncomment for verbose logging
            await client.query('COMMIT'); // Commit even if no rows found to end transaction
            return; // Nothing to do
        }

        console.log(`[DB_POLL] Found ${result.rows.length} pending request(s) to process.`);

        // Process each found request within the transaction
        for (const request of result.rows) {
            console.log(`[DB_PROCESS] Processing request_id: ${request.request_id} for game_id: ${request.game_id}`);

            // Generate a random dice roll (1-6)
            const rollValue = Math.floor(Math.random() * 6) + 1;
            console.log(`[DB_PROCESS] Generated roll: ${rollValue} for request_id: ${request.request_id}`);

            // Update the specific request row identified by request_id
            // Ensure status is still 'pending' in the WHERE clause for safety, although FOR UPDATE should prevent concurrent updates.
            const updateQuery = `
                UPDATE dice_roll_requests
                SET status = 'completed', roll_value = $1, processed_at = NOW()
                WHERE request_id = $2 AND status = 'pending'`;
            const updateResult = await client.query(updateQuery, [rollValue, request.request_id]);

            if (updateResult.rowCount > 0) {
                console.log(`[DB_PROCESS] Successfully updated request_id: ${request.request_id} to completed with roll ${rollValue}.`);
            } else {
                // This case should be rare due to FOR UPDATE lock, but log if it happens
                console.warn(`[DB_PROCESS_WARN] Failed to update request_id: ${request.request_id}. Status might have changed concurrently.`);
            }
        }

        await client.query('COMMIT'); // Commit the transaction after processing all requests in this batch
        // console.log('[DB_POLL] Transaction committed.'); // Uncomment for verbose logging

    } catch (error) {
        console.error('[DB_POLL_ERROR] Error during database check/processing cycle:', error);
        if (client) {
            try {
                await client.query('ROLLBACK'); // Rollback transaction on error
                console.log('[DB_POLL_ERROR] Transaction rolled back due to error.');
            } catch (rollbackError) {
                console.error('[DB_POLL_ERROR] Failed to rollback transaction:', rollbackError);
            }
        }
    } finally {
        if (client) {
            client.release(); // ALWAYS release the client back to the pool
            // console.log('[DB_POLL] Database client released.'); // Uncomment for verbose logging
        }
    }
}

// --- Telegram Bot Event Handlers ---

// Standard help/start command for the helper bot
bot.onText(/\/start|\/help/i, (msg) => {
    const chatId = msg.chat.id;
    const helpText = "I am a Dice Helper Bot operating in Database Mode.\n" +
                     "I automatically process dice roll requests generated by the main casino bot by checking a shared database.\n" +
                     "You don't need to interact with me directly for the game functionality.";
    bot.sendMessage(chatId, helpText);
});

// Polling error handler for the helper bot
bot.on('polling_error', (error) => {
    console.error(`\n🚫 HELPER BOT TELEGRAM POLLING ERROR 🚫 Code: ${error.code}`);
    console.error(`Helper Bot: Message - ${error.message}`);
    // Consider specific error codes (e.g., 401 Unauthorized, 409 Conflict) if needed
});

// General error handler for the helper bot library
bot.on('error', (error) => {
    console.error('\n🔥 HELPER BOT GENERAL TELEGRAM LIBRARY ERROR EVENT 🔥:', error);
});

// --- Startup Function ---
let pollingIntervalId = null; // To store the interval ID for graceful shutdown

async function startHelperBot() {
    console.log(`\n🚀🚀🚀 Initializing Dice Helper Bot (DB Polling Mode) 🚀🚀🚀`);
    console.log(`Timestamp: ${new Date().toISOString()}`);

    try {
        // 1. Test Database Connection on startup
        console.log("Helper Bot: Attempting initial database connection test...");
        const dbClient = await pool.connect();
        console.log("Helper Bot: ✅ Successfully connected to PostgreSQL.");
        await dbClient.query('SELECT NOW()'); // Simple query to test
        console.log("Helper Bot: ✅ Database query test successful.");
        dbClient.release();

        // 2. Connect to Telegram and get Bot Info
        console.log("Helper Bot: Connecting to Telegram...");
        const me = await bot.getMe();
        console.log(`Helper Bot: ✅ Successfully connected to Telegram! Bot Name: @${me.username}, Bot ID: ${me.id}`);

        // 3. Start the Database Polling Loop
        pollingIntervalId = setInterval(checkAndProcessRollRequests, POLLING_INTERVAL_MS);
        console.log(`Helper Bot: ✅ Database polling started. Checking database every ${POLLING_INTERVAL_MS}ms.`);
        console.log(`\n🎉 Helper Bot operational!`);

    } catch (error) {
        console.error("❌ CRITICAL STARTUP ERROR (Helper Bot): Failed to initialize.", error);
        // Attempt to gracefully close pool if it was initialized before error
        if (pool) {
            try { await pool.end(); } catch (poolEndError) { /* Ignore secondary error */ }
        }
        process.exit(1); // Exit if critical setup fails
    }
}

// --- Shutdown Handling ---
let isShuttingDownHelper = false;
async function shutdown(signal) {
    if (isShuttingDownHelper) {
        console.log("Helper Bot: Shutdown already in progress.");
        return;
    }
    isShuttingDownHelper = true;
    console.log(`\n🚦 Received ${signal}. Shutting down Helper Bot gracefully...`);

    // 1. Stop the Database Polling
    if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
        console.log("Helper Bot: Database polling stopped.");
    }

    // 2. Stop Telegram Polling
    if (bot && bot.isPolling()) {
         try {
             await bot.stopPolling({ cancel: true });
             console.log("Helper Bot: Telegram polling stopped.");
         } catch(e) {
             console.error("Helper Bot: Error stopping Telegram polling:", e.message);
         }
    }

    // 3. Close the Database Pool
    if (pool) {
         try {
             await pool.end();
             console.log("Helper Bot: PostgreSQL pool has been closed.");
         } catch(e) {
             console.error("Helper Bot: Error closing PostgreSQL pool:", e.message);
         }
    }

    console.log("Helper Bot: ✅ Shutdown complete. Exiting.");
    process.exit(0); // Exit cleanly
}

// Register signal handlers for graceful shutdown
process.on('SIGINT', async () => await shutdown('SIGINT'));  // CTRL+C
process.on('SIGTERM', async () => await shutdown('SIGTERM')); // kill command

// Add handlers for potential process-level errors
process.on('uncaughtException', (error, origin) => {
    console.error(`\n🚨🚨 HELPER BOT UNCAUGHT EXCEPTION AT: ${origin} 🚨🚨`, error);
    // Consider a more robust shutdown or notification here
    process.exit(1); // Exit uncleanly on uncaught exception
});
process.on('unhandledRejection', (reason, promise) => {
    console.error(`\n🔥🔥 HELPER BOT UNHANDLED REJECTION 🔥🔥`, reason, promise);
    // Consider logging more details or notifying
});


// --- Start the Bot ---
startHelperBot();

console.log("Helper Bot: End of script. Startup process initiated.");
// --- END OF helper_index.js ---
