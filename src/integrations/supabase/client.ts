// This file is automatically generated. Do not edit it directly.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://hvnxhovwbvphynuxlqnj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2bnhob3Z3YnZwaHludXhscW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4Mjg2ODAsImV4cCI6MjA1OTQwNDY4MH0.i59NYbHj1aJixQMmXh61gPV5SpqoXwxjr85-5pUl-9U";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);