import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Define your database types
interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          github_id: number;
          login: string;
          name: string;
          avatar_url: string;
          access_token: string;
          updated_at: string;
        }
      }
    }
  }
}