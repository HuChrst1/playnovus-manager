import { createClient } from '@supabase/supabase-js'

// On récupère les clés secrètes depuis les variables d'environnement
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// On crée le client qui sera utilisé partout dans l'app
export const supabase = createClient(supabaseUrl, supabaseKey)