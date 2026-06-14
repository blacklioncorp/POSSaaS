const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const tenantId = "c231cde2-5a88-4619-bbd2-c73b90f22c47";
  const { data, error } = await supabase.from('productos').select('*').eq('tenant_id', tenantId);
  console.log("Error:", error);
  console.log("Count:", data ? data.length : 0);
  console.log("Data:", data);
}
main();
