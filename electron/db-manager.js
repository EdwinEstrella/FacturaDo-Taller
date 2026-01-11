const { Client } = require('pg');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Creates a new database if it doesn't exist.
 * Connects to the 'postgres' default database to execute the CREATE DATABASE command.
 */
async function createDatabase(config) {
    const { host, port, user, password, database } = config;

    // Connect to default 'postgres' db to perform administrative tasks
    const client = new Client({
        user,
        password,
        host,
        port: parseInt(port),
        database: 'postgres', // Connect to default DB
    });

    try {
        await client.connect();

        // Check if DB exists
        const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [database]);

        if (res.rowCount === 0) {
            // Create DB
            // Note: Parameterized queries don't work for identifiers like database names in CREATE DATABASE
            // We must be careful with sanitization, but here we assume internal/admin use.
            // Basic sanitization: allow only alphanumeric and underscores.
            if (!/^[a-zA-Z0-9_]+$/.test(database)) {
                throw new Error("Invalid database name. Only alphanumeric and underscores allowed.");
            }

            await client.query(`CREATE DATABASE "${database}"`);
            console.log(`Database ${database} created successfully.`);
            return { success: true, message: 'Database created' };
        } else {
            console.log(`Database ${database} already exists.`);
            return { success: true, message: 'Database already exists' };
        }
    } catch (error) {
        console.error('Error creating database:', error);
        throw error;
    } finally {
        await client.end();
    }
}

/**
 * Tests connection to a specific database
 */
async function testConnection(config) {
    const { host, port, user, password, database } = config;

    const client = new Client({
        user,
        password,
        host,
        port: parseInt(port),
        database: database || 'postgres', // Default to postgres if checking general connectivity
    });

    try {
        await client.connect();
        await client.query('SELECT 1');
        return { success: true, message: 'Connection successful' };
    } catch (error) {
        return { success: false, message: error.message };
    } finally {
        await client.end();
    }
}

/**
 * Runs Prisma migrations on the configured database.
 * This assumes the schema.prisma is packaged with the app.
 */
async function runMigrations(databaseUrl, schemaPath = null) {
    return new Promise((resolve, reject) => {
        // In production, we need to point to the correct schema location.
        // In dev, it might be in the project root.

        // Construct the environment for the child process
        const env = {
            ...process.env,
            DATABASE_URL: databaseUrl
        };

        // Determine prisma command path
        // In dev: npx prisma
        // In prod: We might need to bundle prisma CLI or use the engine directly.
        // For now, let's assume 'npx prisma migrate deploy' works if node is available,
        // or we might need to use a specific binary.
        // A robust way for Electron is often using the programmatic engine or a bundled script.
        // However, for this plan, we'll try the CLI command first as requested in the plan "child process".

        const command = `npx prisma migrate deploy`;

        console.log(`Running migrations with URL: ${databaseUrl}`);

        exec(command, { env }, (error, stdout, stderr) => {
            if (error) {
                console.error(`Migration error: ${error.message}`);
                console.error(stderr);
                reject(error);
                return;
            }
            console.log(`Migration output: ${stdout}`);
            resolve(stdout);
        });
    });
}

module.exports = {
    createDatabase,
    testConnection,
    runMigrations
};
