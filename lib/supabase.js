import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper functions for common operations
export const supabaseHelpers = {
  // Auth helpers
  async signUp(email, password, metadata = {}) {
    return await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    })
  },

  async signIn(email, password) {
    return await supabase.auth.signInWithPassword({
      email,
      password
    })
  },

  async signOut() {
    return await supabase.auth.signOut()
  },

  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  },

  // Database helpers
  async fetchData(table, columns = '*', filters = {}) {
    let query = supabase.from(table).select(columns)
    
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value)
    })
    
    return await query
  },

  async insertData(table, data) {
    return await supabase.from(table).insert(data)
  },

  async updateData(table, data, filters) {
    let query = supabase.from(table).update(data)
    
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value)
    })
    
    return await query
  },

  async deleteData(table, filters) {
    let query = supabase.from(table)
    
    Object.entries(filters).forEach(([key, value]) => {
      query = query.delete().eq(key, value)
    })
    
    return await query
  }
}
