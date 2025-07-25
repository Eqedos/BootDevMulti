import { createClient } from '@supabase/supabase-js'
import CONFIG from '../config'

const supabaseUrl = CONFIG.SUPABASE.URL;
const supabaseKey = CONFIG.SUPABASE.ANON_KEY;

export const supabase = createClient(supabaseUrl!, supabaseKey!)
