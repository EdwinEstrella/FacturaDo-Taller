import { createAdminClient } from './server'
import { Database, TablesInsert, TablesUpdate } from './database.types'

type TableName = keyof Database['public']['Tables']

/**
 * Helper para server actions que necesita acceso a la base de datos
 * Similar a prisma.ts pero usando Supabase
 * Usa SERVICE_ROLE_KEY para bypass RLS
 */
export function getSupabaseForServer() {
  return createAdminClient()
}

/**
 * Type helper para una tabla específica
 */
export type TableInsert<T extends TableName> = Database['public']['Tables'][T]['Insert']
export type TableUpdate<T extends TableName> = Database['public']['Tables'][T]['Update']
export type TableRow<T extends TableName> = Database['public']['Tables'][T]['Row']

/**
 * Wrapper para operaciones comunes de Supabase con mejor tipos
 */
export class SupabaseQuery<T extends TableName> {
  private tableName: T

  constructor(tableName: T) {
    this.tableName = tableName
  }

  async select(columns?: string) {
    const supabase = await getSupabaseForServer()
    return supabase.from(this.tableName).select(columns)
  }

  async insert(data: TableInsert<T>) {
    const supabase = await getSupabaseForServer()
    return supabase.from(this.tableName).insert(data)
  }

  async update(data: TableUpdate<T>) {
    const supabase = await getSupabaseForServer()
    return supabase.from(this.tableName).update(data)
  }

  async delete() {
    const supabase = await getSupabaseForServer()
    return supabase.from(this.tableName).delete()
  }

  // Helper methods comunes
  async findById(id: string) {
    const supabase = await getSupabaseForServer()
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('id', id)
      .single()

    return { data, error }
  }

  async findMany(options?: {
    column?: string
    value?: any
    orderBy?: string
    ascending?: boolean
    limit?: number
  }) {
    const supabase = await getSupabaseForServer()
    let query = supabase.from(this.tableName).select()

    if (options?.column && options?.value) {
      query = query.eq(options.column, options.value)
    }

    if (options?.orderBy) {
      query = query.order(options.orderBy, { ascending: options.ascending ?? true })
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    const { data, error } = await query
    return { data, error }
  }
}

/**
 * Factory function para crear queries con tipos
 */
export function createQuery<T extends TableName>(tableName: T): SupabaseQuery<T> {
  return new SupabaseQuery(tableName)
}

// Funciones helper para tablas específicas (convenience)
export const db = {
  client: () => new SupabaseQuery('Client'),
  product: () => new SupabaseQuery('Product'),
  invoice: () => new SupabaseQuery('Invoice'),
  user: () => new SupabaseQuery('User'),
  quote: () => new SupabaseQuery('Quote'),
  // Agregar más según sea necesario
}
