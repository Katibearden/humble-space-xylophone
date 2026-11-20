import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vawftujsnqzpujqxmroly.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhd2Z0dWpzbnF6cHVqcXhtcmx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTg3MDEsImV4cCI6MjEwMzU5NDcwMX0.bxL2nLvJ6psjQwdqTou1gS8NsxdqFiDyBT1-0mZ3H6s';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);