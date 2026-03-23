import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('No se encontraron credenciales de Supabase');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
  const { data, error } = await supabase
    .from('User')
    .select('*');
  
  if (error) {
    console.error('Error al consultar usuarios:', error);
  } else {
    console.log('Usuarios encontrados:', data?.length || 0);
    if (data && data.length > 0) {
      console.table(data.map(u => ({ id: u.id, username: u.username, name: u.name, role: u.role })));
    } else {
      console.log('No hay usuarios. Creando usuario admin...');
      const { data: newUser, error: createError } = await supabase
        .from('User')
        .insert({
          username: 'admin',
          password: 'admin', // En producción esto debería estar hasheado
          name: 'Administrador',
          role: 'ADMIN'
        })
        .select();
      
      if (createError) {
        console.error('Error al crear usuario:', createError);
      } else {
        console.log('Usuario admin creado exitosamente:', newUser);
      }
    }
  }
}

checkUsers();
