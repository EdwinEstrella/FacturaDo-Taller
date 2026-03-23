export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      _prisma_migrations: {
        Row: {
          applied_steps_count: number
          checksum: string
          finished_at: string | null
          id: string
          logs: string | null
          migration_name: string
          rolled_back_at: string | null
          started_at: string
        }
        Insert: {
          applied_steps_count?: number
          checksum: string
          finished_at?: string | null
          id: string
          logs?: string | null
          migration_name: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Update: {
          applied_steps_count?: number
          checksum?: string
          finished_at?: string | null
          id?: string
          logs?: string | null
          migration_name?: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Relationships: []
      }
      Client: {
        Row: {
          address: string | null
          cedula: string | null
          createdAt: string
          email: string | null
          id: string
          name: string
          phone: string | null
          rnc: string | null
          updatedAt: string
        }
        Insert: {
          address?: string | null
          cedula?: string | null
          createdAt?: string
          email?: string | null
          id: string
          name: string
          phone?: string | null
          rnc?: string | null
          updatedAt: string
        }
        Update: {
          address?: string | null
          cedula?: string | null
          createdAt?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          rnc?: string | null
          updatedAt?: string
        }
        Relationships: []
      }
      ClientHistory: {
        Row: {
          action: string
          clientId: string
          createdAt: string
          description: string | null
          id: string
          metadata: string | null
        }
        Insert: {
          action: string
          clientId: string
          createdAt?: string
          description?: string | null
          id: string
          metadata?: string | null
        }
        Update: {
          action?: string
          clientId?: string
          createdAt?: string
          description?: string | null
          id?: string
          metadata?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ClientHistory_clientId_fkey"
            columns: ["clientId"]
            isOneToOne: false
            referencedRelation: "Client"
            referencedColumns: ["id"]
          },
        ]
      }
      CreditNote: {
        Row: {
          createdAt: string
          id: string
          invoiceId: string
          items: Json | null
          reason: string
          sequenceNumber: number
          total: number
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          id: string
          invoiceId: string
          items?: Json | null
          reason: string
          sequenceNumber?: number
          total: number
          updatedAt: string
        }
        Update: {
          createdAt?: string
          id?: string
          invoiceId?: string
          items?: Json | null
          reason?: string
          sequenceNumber?: number
          total?: number
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "CreditNote_invoiceId_fkey"
            columns: ["invoiceId"]
            isOneToOne: false
            referencedRelation: "Invoice"
            referencedColumns: ["id"]
          },
        ]
      }
      DailyClose: {
        Row: {
          billBreakdownEUR: Json | null
          billBreakdownRD: Json | null
          billBreakdownUSD: Json | null
          cashCollected: number
          closeDate: string
          closedBy: string
          closedByName: string
          createdAt: string
          discrepancy: number
          expensesData: Json | null
          id: string
          invoicesData: Json | null
          netCashInDrawer: number
          notes: string | null
          otherCollected: number
          totalBilled: number
          totalCollected: number
          totalEUR: number
          totalExpenses: number
          totalRD: number
          totalUSD: number
        }
        Insert: {
          billBreakdownEUR?: Json | null
          billBreakdownRD?: Json | null
          billBreakdownUSD?: Json | null
          cashCollected: number
          closeDate: string
          closedBy: string
          closedByName: string
          createdAt?: string
          discrepancy?: number
          expensesData?: Json | null
          id: string
          invoicesData?: Json | null
          netCashInDrawer: number
          notes?: string | null
          otherCollected: number
          totalBilled: number
          totalCollected: number
          totalEUR?: number
          totalExpenses: number
          totalRD?: number
          totalUSD?: number
        }
        Update: {
          billBreakdownEUR?: Json | null
          billBreakdownRD?: Json | null
          billBreakdownUSD?: Json | null
          cashCollected?: number
          closeDate?: string
          closedBy?: string
          closedByName?: string
          createdAt?: string
          discrepancy?: number
          expensesData?: Json | null
          id?: string
          invoicesData?: Json | null
          netCashInDrawer?: number
          notes?: string | null
          otherCollected?: number
          totalBilled?: number
          totalCollected?: number
          totalEUR?: number
          totalExpenses?: number
          totalRD?: number
          totalUSD?: number
        }
        Relationships: []
      }
      Dispatch: {
        Row: {
          createdAt: string
          deliveredAt: string | null
          driverName: string | null
          id: string
          installedAt: string | null
          invoiceId: string
          notes: string | null
          status: string
          technicianId: string | null
          updatedAt: string
          vehicleId: string | null
        }
        Insert: {
          createdAt?: string
          deliveredAt?: string | null
          driverName?: string | null
          id: string
          installedAt?: string | null
          invoiceId: string
          notes?: string | null
          status?: string
          technicianId?: string | null
          updatedAt: string
          vehicleId?: string | null
        }
        Update: {
          createdAt?: string
          deliveredAt?: string | null
          driverName?: string | null
          id?: string
          installedAt?: string | null
          invoiceId?: string
          notes?: string | null
          status?: string
          technicianId?: string | null
          updatedAt?: string
          vehicleId?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Dispatch_invoiceId_fkey"
            columns: ["invoiceId"]
            isOneToOne: false
            referencedRelation: "Invoice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Dispatch_technicianId_fkey"
            columns: ["technicianId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      DispatchPhoto: {
        Row: {
          caption: string | null
          dispatchId: string
          id: string
          photoUrl: string
          takenAt: string
          takenBy: string | null
        }
        Insert: {
          caption?: string | null
          dispatchId: string
          id: string
          photoUrl: string
          takenAt?: string
          takenBy?: string | null
        }
        Update: {
          caption?: string | null
          dispatchId?: string
          id?: string
          photoUrl?: string
          takenAt?: string
          takenBy?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "DispatchPhoto_dispatchId_fkey"
            columns: ["dispatchId"]
            isOneToOne: false
            referencedRelation: "Dispatch"
            referencedColumns: ["id"]
          },
        ]
      }
      Invoice: {
        Row: {
          balance: number
          clientId: string | null
          clientName: string | null
          createdAt: string
          createdById: string | null
          creatorName: string | null
          deliveryDate: string | null
          dispatched: boolean
          hasNcf: boolean
          id: string
          ncf: string | null
          ncfType: string | null
          note: string | null
          notes: string | null
          paymentMethod: string | null
          sequenceNumber: number
          shippingCost: number
          status: string
          tax: number
          total: number
          updatedAt: string
        }
        Insert: {
          balance?: number
          clientId?: string | null
          clientName?: string | null
          createdAt?: string
          createdById?: string | null
          creatorName?: string | null
          deliveryDate?: string | null
          dispatched?: boolean
          hasNcf?: boolean
          id: string
          ncf?: string | null
          ncfType?: string | null
          note?: string | null
          notes?: string | null
          paymentMethod?: string | null
          sequenceNumber?: number
          shippingCost?: number
          status?: string
          tax?: number
          total: number
          updatedAt: string
        }
        Update: {
          balance?: number
          clientId?: string | null
          clientName?: string | null
          createdAt?: string
          createdById?: string | null
          creatorName?: string | null
          deliveryDate?: string | null
          dispatched?: boolean
          hasNcf?: boolean
          id?: string
          ncf?: string | null
          ncfType?: string | null
          note?: string | null
          notes?: string | null
          paymentMethod?: string | null
          sequenceNumber?: number
          shippingCost?: number
          status?: string
          tax?: number
          total?: number
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Invoice_clientId_fkey"
            columns: ["clientId"]
            isOneToOne: false
            referencedRelation: "Client"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Invoice_createdById_fkey"
            columns: ["createdById"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      InvoiceItem: {
        Row: {
          id: string
          invoiceId: string
          price: number
          productId: string | null
          productName: string
          quantity: number
          variantId: string | null
        }
        Insert: {
          id: string
          invoiceId: string
          price: number
          productId?: string | null
          productName: string
          quantity: number
          variantId?: string | null
        }
        Update: {
          id?: string
          invoiceId?: string
          price?: number
          productId?: string | null
          productName?: string
          quantity?: number
          variantId?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "InvoiceItem_invoiceId_fkey"
            columns: ["invoiceId"]
            isOneToOne: false
            referencedRelation: "Invoice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "InvoiceItem_productId_fkey"
            columns: ["productId"]
            isOneToOne: false
            referencedRelation: "Product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "InvoiceItem_variantId_fkey"
            columns: ["variantId"]
            isOneToOne: false
            referencedRelation: "ProductVariant"
            referencedColumns: ["id"]
          },
        ]
      }
      Payment: {
        Row: {
          amount: number
          createdAt: string
          date: string
          id: string
          invoiceId: string
          method: string
          notes: string | null
          reference: string | null
          updatedAt: string
        }
        Insert: {
          amount: number
          createdAt?: string
          date?: string
          id: string
          invoiceId: string
          method: string
          notes?: string | null
          reference?: string | null
          updatedAt: string
        }
        Update: {
          amount?: number
          createdAt?: string
          date?: string
          id?: string
          invoiceId?: string
          method?: string
          notes?: string | null
          reference?: string | null
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Payment_invoiceId_fkey"
            columns: ["invoiceId"]
            isOneToOne: false
            referencedRelation: "Invoice"
            referencedColumns: ["id"]
          },
        ]
      }
      Permission: {
        Row: {
          createdAt: string
          id: string
          permissions: Json
          updatedAt: string
          userId: string
        }
        Insert: {
          createdAt?: string
          id: string
          permissions: Json
          updatedAt: string
          userId: string
        }
        Update: {
          createdAt?: string
          id?: string
          permissions?: Json
          updatedAt?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Permission_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      PettyCashClosing: {
        Row: {
          closedAt: string
          closedBy: string
          closedByName: string
          closingBalance: number
          id: string
          notes: string | null
          openingBalance: number
          totalExpense: number
          totalIncome: number
        }
        Insert: {
          closedAt?: string
          closedBy: string
          closedByName: string
          closingBalance: number
          id: string
          notes?: string | null
          openingBalance: number
          totalExpense: number
          totalIncome: number
        }
        Update: {
          closedAt?: string
          closedBy?: string
          closedByName?: string
          closingBalance?: number
          id?: string
          notes?: string | null
          openingBalance?: number
          totalExpense?: number
          totalIncome?: number
        }
        Relationships: []
      }
      Product: {
        Row: {
          category: string
          cost: number
          createdAt: string
          description: string | null
          hasVariants: boolean
          id: string
          isService: boolean
          minStock: number
          name: string
          price: number
          sku: string | null
          stock: number
          unitType: string
          updatedAt: string
        }
        Insert: {
          category?: string
          cost?: number
          createdAt?: string
          description?: string | null
          hasVariants?: boolean
          id: string
          isService?: boolean
          minStock?: number
          name: string
          price: number
          sku?: string | null
          stock?: number
          unitType?: string
          updatedAt: string
        }
        Update: {
          category?: string
          cost?: number
          createdAt?: string
          description?: string | null
          hasVariants?: boolean
          id?: string
          isService?: boolean
          minStock?: number
          name?: string
          price?: number
          sku?: string | null
          stock?: number
          unitType?: string
          updatedAt?: string
        }
        Relationships: []
      }
      ProductVariant: {
        Row: {
          cost: number
          createdAt: string
          id: string
          name: string
          price: number
          productId: string
          sku: string | null
          stock: number
          updatedAt: string
        }
        Insert: {
          cost?: number
          createdAt?: string
          id: string
          name: string
          price: number
          productId: string
          sku?: string | null
          stock?: number
          updatedAt: string
        }
        Update: {
          cost?: number
          createdAt?: string
          id?: string
          name?: string
          price?: number
          productId?: string
          sku?: string | null
          stock?: number
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "ProductVariant_productId_fkey"
            columns: ["productId"]
            isOneToOne: false
            referencedRelation: "Product"
            referencedColumns: ["id"]
          },
        ]
      }
      Purchase: {
        Row: {
          createdAt: string
          date: string
          id: string
          notes: string | null
          sequenceNumber: number
          status: string
          supplierId: string | null
          supplierName: string | null
          total: number
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          date?: string
          id: string
          notes?: string | null
          sequenceNumber?: number
          status?: string
          supplierId?: string | null
          supplierName?: string | null
          total: number
          updatedAt: string
        }
        Update: {
          createdAt?: string
          date?: string
          id?: string
          notes?: string | null
          sequenceNumber?: number
          status?: string
          supplierId?: string | null
          supplierName?: string | null
          total?: number
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Purchase_supplierId_fkey"
            columns: ["supplierId"]
            isOneToOne: false
            referencedRelation: "Supplier"
            referencedColumns: ["id"]
          },
        ]
      }
      PurchaseItem: {
        Row: {
          id: string
          productId: string
          purchaseId: string
          quantity: number
          quantityType: string
          total: number
          unitCost: number
        }
        Insert: {
          id: string
          productId: string
          purchaseId: string
          quantity: number
          quantityType?: string
          total: number
          unitCost: number
        }
        Update: {
          id?: string
          productId?: string
          purchaseId?: string
          quantity?: number
          quantityType?: string
          total?: number
          unitCost?: number
        }
        Relationships: [
          {
            foreignKeyName: "PurchaseItem_productId_fkey"
            columns: ["productId"]
            isOneToOne: false
            referencedRelation: "Product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "PurchaseItem_purchaseId_fkey"
            columns: ["purchaseId"]
            isOneToOne: false
            referencedRelation: "Purchase"
            referencedColumns: ["id"]
          },
        ]
      }
      Quote: {
        Row: {
          clientId: string | null
          createdAt: string
          createdById: string | null
          id: string
          status: string
          total: number
          updatedAt: string
          validUntil: string | null
        }
        Insert: {
          clientId?: string | null
          createdAt?: string
          createdById?: string | null
          id: string
          status?: string
          total: number
          updatedAt: string
          validUntil?: string | null
        }
        Update: {
          clientId?: string | null
          createdAt?: string
          createdById?: string | null
          id?: string
          status?: string
          total?: number
          updatedAt?: string
          validUntil?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Quote_clientId_fkey"
            columns: ["clientId"]
            isOneToOne: false
            referencedRelation: "Client"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Quote_createdById_fkey"
            columns: ["createdById"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      QuoteItem: {
        Row: {
          id: string
          price: number
          productId: string | null
          productName: string
          quantity: number
          quoteId: string
          variantId: string | null
        }
        Insert: {
          id: string
          price: number
          productId?: string | null
          productName: string
          quantity: number
          quoteId: string
          variantId?: string | null
        }
        Update: {
          id?: string
          price?: number
          productId?: string | null
          productName?: string
          quantity?: number
          quoteId?: string
          variantId?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "QuoteItem_productId_fkey"
            columns: ["productId"]
            isOneToOne: false
            referencedRelation: "Product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "QuoteItem_quoteId_fkey"
            columns: ["quoteId"]
            isOneToOne: false
            referencedRelation: "Quote"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "QuoteItem_variantId_fkey"
            columns: ["variantId"]
            isOneToOne: false
            referencedRelation: "ProductVariant"
            referencedColumns: ["id"]
          },
        ]
      }
      Setting: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      Supplier: {
        Row: {
          address: string | null
          createdAt: string
          email: string | null
          id: string
          name: string
          phone: string | null
          updatedAt: string
        }
        Insert: {
          address?: string | null
          createdAt?: string
          email?: string | null
          id: string
          name: string
          phone?: string | null
          updatedAt: string
        }
        Update: {
          address?: string | null
          createdAt?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updatedAt?: string
        }
        Relationships: []
      }
      Transaction: {
        Row: {
          amount: number
          category: string
          closingId: string | null
          date: string
          description: string | null
          id: string
          referenceId: string | null
          type: string
        }
        Insert: {
          amount: number
          category: string
          closingId?: string | null
          date?: string
          description?: string | null
          id: string
          referenceId?: string | null
          type: string
        }
        Update: {
          amount?: number
          category?: string
          closingId?: string | null
          date?: string
          description?: string | null
          id?: string
          referenceId?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "Transaction_closingId_fkey"
            columns: ["closingId"]
            isOneToOne: false
            referencedRelation: "PettyCashClosing"
            referencedColumns: ["id"]
          },
        ]
      }
      User: {
        Row: {
          createdAt: string
          customPermissions: Json | null
          id: string
          name: string
          password: string
          phone: string | null
          role: Database["public"]["Enums"]["Role"]
          updatedAt: string
          username: string
        }
        Insert: {
          createdAt?: string
          customPermissions?: Json | null
          id: string
          name: string
          password: string
          phone?: string | null
          role?: Database["public"]["Enums"]["Role"]
          updatedAt: string
          username: string
        }
        Update: {
          createdAt?: string
          customPermissions?: Json | null
          id?: string
          name?: string
          password?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["Role"]
          updatedAt?: string
          username?: string
        }
        Relationships: []
      }
      WorkOrder: {
        Row: {
          createdAt: string
          id: number
          invoiceId: string
          notes: string | null
          status: string
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          id?: number
          invoiceId: string
          notes?: string | null
          status?: string
          updatedAt: string
        }
        Update: {
          createdAt?: string
          id?: number
          invoiceId?: string
          notes?: string | null
          status?: string
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "WorkOrder_invoiceId_fkey"
            columns: ["invoiceId"]
            isOneToOne: false
            referencedRelation: "Invoice"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      Role:
        | "ADMIN"
        | "SELLER"
        | "ACCOUNTANT"
        | "TECHNICIAN"
        | "MANAGER"
        | "CUSTOM"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  TableName extends keyof DefaultSchema["Tables"] & keyof DefaultSchema["Views"]
> = DefaultSchema["Tables"][TableName] extends { Row: infer R }
  ? R
  : DefaultSchema["Views"][TableName] extends { Row: infer R }
  ? R
  : never

export type TablesInsert<
  TableName extends keyof DefaultSchema["Tables"]
> = DefaultSchema["Tables"][TableName] extends { Insert: infer I }
  ? I
  : never

export type TablesUpdate<
  TableName extends keyof DefaultSchema["Tables"]
> = DefaultSchema["Tables"][TableName] extends { Update: infer U }
  ? U
  : never

export type Enums<EnumName extends keyof DefaultSchema["Enums"]> =
  DefaultSchema["Enums"][EnumName]
