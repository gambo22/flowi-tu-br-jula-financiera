export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          name: string | null
          income_type: string | null
          income_min: number | null
          income_max: number | null
          income_frequency: string | null
          income_period_1: number | null
          income_period_2: number | null
          income_period_3: number | null
          income_period_4: number | null
          monthly_income: number | null
          income_this_month: number | null
          payment_day_type: string | null
          payment_day_1: number | null
          payment_day_2: number | null
          cash_on_hand: number | null
          onboarding_complete: boolean | null
          created_at: string | null
        }
        Insert: {
          id: string
          name?: string | null
          income_type?: string | null
          income_min?: number | null
          income_max?: number | null
          income_frequency?: string | null
          income_period_1?: number | null
          income_period_2?: number | null
          income_period_3?: number | null
          income_period_4?: number | null
          monthly_income?: number | null
          income_this_month?: number | null
          payment_day_type?: string | null
          payment_day_1?: number | null
          payment_day_2?: number | null
          cash_on_hand?: number | null
          onboarding_complete?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string | null
          income_type?: string | null
          income_min?: number | null
          income_max?: number | null
          income_frequency?: string | null
          income_period_1?: number | null
          income_period_2?: number | null
          income_period_3?: number | null
          income_period_4?: number | null
          monthly_income?: number | null
          income_this_month?: number | null
          payment_day_type?: string | null
          payment_day_1?: number | null
          payment_day_2?: number | null
          cash_on_hand?: number | null
          onboarding_complete?: boolean | null
          created_at?: string | null
        }
      }
      expenses: {
        Row: {
          id: string
          user_id: string
          amount: number
          category: string
          note: string | null
          date: string
          is_recurring: boolean | null
          payment_method: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          category: string
          note?: string | null
          date: string
          is_recurring?: boolean | null
          payment_method?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          category?: string
          note?: string | null
          date?: string
          is_recurring?: boolean | null
          payment_method?: string | null
          created_at?: string | null
        }
      }
      budget_limits: {
        Row: {
          id: string
          user_id: string
          category: string
          monthly_limit: number
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          category: string
          monthly_limit: number
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          category?: string
          monthly_limit?: number
          created_at?: string | null
        }
      }
      goals: {
        Row: {
          id: string
          user_id: string
          name: string
          type: string | null
          total_amount: number
          current_saved: number | null
          monthly_payment: number | null
          priority: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type?: string | null
          total_amount: number
          current_saved?: number | null
          monthly_payment?: number | null
          priority?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: string | null
          total_amount?: number
          current_saved?: number | null
          monthly_payment?: number | null
          priority?: number | null
          created_at?: string | null
        }
      }
      fixed_expenses: {
        Row: {
          id: string
          user_id: string
          name: string
          category: string
          amount: number
          payment_day: number
          payment_day_type: string | null
          is_active: boolean | null
          installment_total: number | null
          installment_current: number | null
          installment_note: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          category: string
          amount: number
          payment_day: number
          payment_day_type?: string | null
          is_active?: boolean | null
          installment_total?: number | null
          installment_current?: number | null
          installment_note?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          category?: string
          amount?: number
          payment_day?: number
          payment_day_type?: string | null
          is_active?: boolean | null
          installment_total?: number | null
          installment_current?: number | null
          installment_note?: string | null
          created_at?: string | null
        }
      }
      fixed_expense_payments: {
        Row: {
          id: string
          fixed_expense_id: string
          user_id: string
          amount_paid: number | null
          payment_date: string
          month: number
          year: number
          confirmed: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          fixed_expense_id: string
          user_id: string
          amount_paid?: number | null
          payment_date: string
          month: number
          year: number
          confirmed?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          fixed_expense_id?: string
          user_id?: string
          amount_paid?: number | null
          payment_date?: string
          month?: number
          year?: number
          confirmed?: boolean | null
          created_at?: string | null
        }
      }
      accounts: {
        Row: {
          id: string
          user_id: string
          name: string
          balance: number | null
          type: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          balance?: number | null
          type?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          balance?: number | null
          type?: string | null
          created_at?: string | null
        }
      }
      debts: {
        Row: {
          id: string
          user_id: string
          name: string
          total_amount: number
          remaining_amount: number | null
          monthly_payment: number | null
          interest_rate: number | null
          category: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          total_amount: number
          remaining_amount?: number | null
          monthly_payment?: number | null
          interest_rate?: number | null
          category?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          total_amount?: number
          remaining_amount?: number | null
          monthly_payment?: number | null
          interest_rate?: number | null
          category?: string | null
          created_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
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
