const { createClient } = require('@insforge/sdk');

const client = createClient({
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL,
  anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY
});

async function createProducts() {
  const products = [
    {
      name: "Camiseta Básica",
      description: "Camiseta de algodón disponible en varios colores y tallas",
      price: 350,
      cost: 150,
      stock: 0,
      minStock: 10,
      sku: "CAM-001",
      category: "ARTICULO",
      unitType: "UNIT",
      isService: false,
      hasVariants: true
    },
    {
      name: "Madera de Pino",
      description: "Tablones de madera de pino por medida",
      price: 0,
      cost: 450,
      stock: 50,
      minStock: 20,
      sku: "MAD-PINO",
      category: "MATERIAL",
      unitType: "MEASURE",
      isService: false,
      hasVariants: false
    },
    {
      name: "Instalación de Aire Acondicionado",
      description: "Servicio profesional de instalación",
      price: 2500,
      cost: 800,
      stock: 0,
      minStock: 0,
      sku: "SERV-AC",
      category: "SERVICIO",
      unitType: "UNIT",
      isService: true,
      hasVariants: false
    }
  ];

  for (const product of products) {
    const { data, error } = await client.database.from('Product').insert([product]).select().single();
    
    if (error) {
      console.error('Error inserting product:', product.name, error);
    } else {
      console.log('✅ Created:', product.name);
      
      // Create variants for Camiseta
      if (product.name === "Camiseta Básica") {
        const variants = [
          { productId: data.id, name: "Roja - S", price: 350, cost: 150, stock: 15, sku: "CAM-001-R-S" },
          { productId: data.id, name: "Roja - M", price: 350, cost: 150, stock: 20, sku: "CAM-001-R-M" },
          { productId: data.id, name: "Roja - L", price: 350, cost: 150, stock: 18, sku: "CAM-001-R-L" },
          { productId: data.id, name: "Azul - M", price: 350, cost: 150, stock: 25, sku: "CAM-001-A-M" },
          { productId: data.id, name: "Azul - L", price: 350, cost: 150, stock: 22, sku: "CAM-001-A-L" }
        ];
        
        const { error: variantError } = await client.database.from('ProductVariant').insert(variants);
        
        if (variantError) {
          console.error('Error inserting variants:', variantError);
        } else {
          console.log('  ✅ Created 5 variants');
        }
      }
    }
  }
  
  console.log('\n✅ Test products created successfully!');
}

createProducts().catch(console.error);
