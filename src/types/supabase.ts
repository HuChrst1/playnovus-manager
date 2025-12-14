export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      inventory: {
        Row: {
          created_at: string
          id: number
          location: string | null
          lot_id: number
          piece_ref: string
          quantity: number
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          location?: string | null
          lot_id: number
          piece_ref: string
          quantity?: number
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          location?: string | null
          lot_id?: number
          piece_ref?: string
          quantity?: number
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      lots: {
        Row: {
          created_at: string
          id: number
          label: string | null
          lot_code: string | null
          notes: string | null
          purchase_date: string
          status: string
          supplier: string | null
          total_cost: number
          total_pieces: number
        }
        Insert: {
          created_at?: string
          id?: number
          label?: string | null
          lot_code?: string | null
          notes?: string | null
          purchase_date: string
          status?: string
          supplier?: string | null
          total_cost: number
          total_pieces: number
        }
        Update: {
          created_at?: string
          id?: number
          label?: string | null
          lot_code?: string | null
          notes?: string | null
          purchase_date?: string
          status?: string
          supplier?: string | null
          total_cost?: number
          total_pieces?: number
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          comment: string | null
          cost_amount: number | null
          id: number
          is_partial_set: boolean
          item_kind: string
          line_index: number
          margin_amount: number | null
          net_amount: number | null
          overrides: Json | null
          piece_ref: string | null
          quantity: number
          sale_id: number
          set_id: string | null
        }
        Insert: {
          comment?: string | null
          cost_amount?: number | null
          id?: number
          is_partial_set?: boolean
          item_kind: string
          line_index: number
          margin_amount?: number | null
          net_amount?: number | null
          overrides?: Json | null
          piece_ref?: string | null
          quantity: number
          sale_id: number
          set_id?: string | null
        }
        Update: {
          comment?: string | null
          cost_amount?: number | null
          id?: number
          is_partial_set?: boolean
          item_kind?: string
          line_index?: number
          margin_amount?: number | null
          net_amount?: number | null
          overrides?: Json | null
          piece_ref?: string | null
          quantity?: number
          sale_id?: number
          set_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "sets_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          buyer_paid_total: number | null
          comment: string | null
          created_at: string
          currency: string
          id: number
          margin_rate: number | null
          net_seller_amount: number
          paid_at: string
          sale_number: string | null
          sale_type: string
          sales_channel: string
          status: string
          total_cost_amount: number | null
          total_margin_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          buyer_paid_total?: number | null
          comment?: string | null
          created_at?: string
          currency?: string
          id?: number
          margin_rate?: number | null
          net_seller_amount: number
          paid_at: string
          sale_number?: string | null
          sale_type: string
          sales_channel: string
          status: string
          total_cost_amount?: number | null
          total_margin_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          buyer_paid_total?: number | null
          comment?: string | null
          created_at?: string
          currency?: string
          id?: number
          margin_rate?: number | null
          net_seller_amount?: number
          paid_at?: string
          sale_number?: string | null
          sale_type?: string
          sales_channel?: string
          status?: string
          total_cost_amount?: number | null
          total_margin_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: []
      }
      sets_bom: {
        Row: {
          id: number
          piece_name: string | null
          piece_ref: string
          quantity: number
          set_id: string
        }
        Insert: {
          id?: number
          piece_name?: string | null
          piece_ref: string
          quantity: number
          set_id: string
        }
        Update: {
          id?: number
          piece_name?: string | null
          piece_ref?: string
          quantity?: number
          set_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sets_bom_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "sets_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      sets_catalog: {
        Row: {
          created_at: string
          display_ref: string
          id: string
          image_url: string | null
          name: string
          theme: string | null
          version: string | null
          year_end: number | null
          year_start: number | null
        }
        Insert: {
          created_at?: string
          display_ref: string
          id: string
          image_url?: string | null
          name: string
          theme?: string | null
          version?: string | null
          year_end?: number | null
          year_start?: number | null
        }
        Update: {
          created_at?: string
          display_ref?: string
          id?: string
          image_url?: string | null
          name?: string
          theme?: string | null
          version?: string | null
          year_end?: number | null
          year_start?: number | null
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          comment: string | null
          created_at: string
          direction: string
          id: number
          lot_id: number | null
          piece_ref: string
          quantity: number
          source_id: string | null
          source_type: string
          unit_cost: number | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          direction: string
          id?: number
          lot_id?: number | null
          piece_ref: string
          quantity: number
          source_id?: string | null
          source_type: string
          unit_cost?: number | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          direction?: string
          id?: number
          lot_id?: number | null
          piece_ref?: string
          quantity?: number
          source_id?: string | null
          source_type?: string
          unit_cost?: number | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          cost_basis: number | null
          created_at: string
          fees: number | null
          id: number
          item_ref: string
          net_margin: number | null
          quantity: number
          selling_price: number
          type: string
        }
        Insert: {
          cost_basis?: number | null
          created_at?: string
          fees?: number | null
          id?: number
          item_ref: string
          net_margin?: number | null
          quantity: number
          selling_price: number
          type: string
        }
        Update: {
          cost_basis?: number | null
          created_at?: string
          fees?: number | null
          id?: number
          item_ref?: string
          net_margin?: number | null
          quantity?: number
          selling_price?: number
          type?: string
        }
        Relationships: []
      }
    }
    Views: {
      set_with_completion: {
        Row: {
          id: string
          display_ref: string
          name: string
          version: string | null
          year_start: number | null
          year_end: number | null
          theme: string | null
          image_url: string | null
          total_parts_needed: number | null
          total_parts_owned: number | null
          completion_percent: number | null
          max_complete_sets: number | null
        }
        Relationships: []
      }
      piece_movements: {
        Row: {
          comment: string | null
          created_at: string | null
          direction: string | null
          id: number | null
          lot_code: string | null
          lot_id: number | null
          lot_label: string | null
          lot_purchase_date: string | null
          lot_status: string | null
          piece_ref: string | null
          quantity: number | null
          source_id: string | null
          source_type: string | null
          total_value: number | null
          unit_cost: number | null
        }
        Relationships: []
      }
      sale_item_movements: {
        Row: {
          created_at: string | null
          direction: string | null
          movement_id: number | null
          piece_ref: string | null
          quantity: number | null
          sale_id: number | null
          sale_item_id: number | null
          unit_cost: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_journal: {
        Row: {
          comment: string | null
          created_at: string | null
          direction: string | null
          id: number | null
          lot_code: string | null
          lot_id: number | null
          lot_label: string | null
          lot_purchase_date: string | null
          lot_status: string | null
          piece_ref: string | null
          quantity: number | null
          source_id: string | null
          source_type: string | null
          total_value: number | null
          unit_cost: number | null
        }
        Relationships: []
      }
      stock_per_piece: {
        Row: {
          avg_unit_cost: number | null
          piece_ref: string | null
          total_quantity: number | null
          total_value: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
