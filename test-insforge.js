import { createClient } from '@insforge/sdk'

const insforge = createClient({
  baseUrl: 'https://base.azokia.com',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNzAxODZ9.n__jQjjmYvkSKr_aBAz4hxFrr7ycQ71yR8DGliwe87k'
})

async function test() {
  const { data, error } = await insforge.database
    .from('users')
    .select('*')
    .eq('username', 'admin')
  
  console.log('DATA:', data)
  console.log('ERROR:', error)
}

test()
