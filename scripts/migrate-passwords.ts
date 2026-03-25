/**
 * Script para migrar contraseñas existentes a bcrypt
 * Ejecutar con: npx tsx scripts/migrate-passwords.ts
 */

import bcrypt from 'bcryptjs'

// Simulación de usuarios - en producción esto debería venir de la base de datos
// Como tenemos un usuario admin/admin123, vamos a hashear esa contraseña
async function generateHashedPasswords() {
    console.log('Generando hashes de contraseñas comunes para migración manual...\n');

    // Contraseña del usuario admin
    const adminPassword = 'admin123';
    const adminHash = await bcrypt.hash(adminPassword, 10);

    console.log('Usuario: admin');
    console.log('Contraseña original: admin123');
    console.log('Hash para DB:');
    console.log(adminHash);
    console.log('\nPara actualizar manualmente en la base de datos:');
    console.log(`UPDATE users SET password = '${adminHash}' WHERE username = 'admin';`);

    // Generar hash para user/user123
    const userPassword = 'user123';
    const userHash = await bcrypt.hash(userPassword, 10);

    console.log('\n-----------------------------------\n');
    console.log('Usuario: user');
    console.log('Contraseña original: user123');
    console.log('Hash para DB:');
    console.log(userHash);
    console.log('\nPara actualizar manualmente en la base de datos:');
    console.log(`UPDATE users SET password = '${userHash}' WHERE username = 'user';`);
}

generateHashedPasswords().catch(console.error);
