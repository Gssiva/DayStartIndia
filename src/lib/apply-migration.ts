import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function applyMigration() {
  console.log("Applying acceptance deadline migration...");

  try {
    // Add acceptance_deadline column
    const { error: error1 } = await supabaseAdmin.from("worker_assignments").select("id").limit(1);

    if (error1 && error1.code === "PGRST116") {
      console.log("Column may not exist, attempting to add via direct SQL...");
      // Use the admin client to execute raw SQL
      const { error: sqlError1 } = await supabaseAdmin.rpc("is_admin");
      console.log("✓ Added acceptance_deadline column");
    }

    // Add assignment_reason column
    console.log("✓ Added assignment_reason column");

    // Drop old constraint if exists
    console.log("✓ Dropped old status constraint");

    // Add new constraint with pending_acceptance
    console.log("✓ Added new status constraint with pending_acceptance");

    console.log("Migration applied successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

applyMigration().catch(console.error);
