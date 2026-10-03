
import { getSupabaseServiceClient } from '../src/lib/supabase/client.js';

async function seed10Bars() {
  console.log('--- SEEDING/VERIFYING 10 CANONICAL BARS IN BAR_OUTLETS ---');
  const supabase = getSupabaseServiceClient();

  const ownerId = 'b649fa66-a1c0-45fe-9184-c8164dc43ef0';

  const canonicalBars = [
    { name: 'Main Bar Outlet', code: 'BAR-001' },
    { name: 'Lounge Bar', code: 'BAR-002' },
    { name: 'Rooftop Terrace Bar', code: 'BAR-003' },
    { name: 'Poolside Bar', code: 'BAR-004' },
    { name: 'Garden Restaurant & Bar', code: 'BAR-005' },
    { name: 'VIP Executive Lounge', code: 'BAR-006' },
    { name: 'Sports Bar & Grill', code: 'BAR-007' },
    { name: 'Beachfront Bar', code: 'BAR-008' },
    { name: 'Cocktail Club & Bar', code: 'BAR-009' },
    { name: 'Banquets & Event Bar', code: 'BAR-010' }
  ];

  // Fetch existing bars
  const { data: existingBars, error: fetchErr } = await supabase
    .from('bar_outlets')
    .select('*');

  if (fetchErr) {
    console.error('Error fetching bar_outlets:', fetchErr.message);
    return;
  }

  const existingMap = new Map((existingBars || []).map(b => [b.code || b.name, b]));

  for (const item of canonicalBars) {
    if (!existingMap.has(item.code) && !existingMap.has(item.name)) {
      console.log(`Creating bar: ${item.name} (${item.code})...`);
      const { data: newBar, error: createErr } = await supabase
        .from('bar_outlets')
        .insert({
          name: item.name,
          code: item.code,
          owner_user_id: ownerId,
          status: 'Active'
        })
        .select()
        .single();

      if (createErr) {
        console.error(`Failed to create ${item.name}:`, createErr.message);
      } else if (newBar) {
        console.log(`✅ Created ${item.name} with ID: ${newBar.id}`);
        // Ensure authorization exists
        await supabase
          .from('bar_user_authorizations')
          .upsert({
            bar_id: newBar.id,
            user_id: ownerId,
            role: 'Owner',
            status: 'Active'
          }, { onConflict: 'bar_id, user_id' });
      }
    } else {
      const existing = existingMap.get(item.code) || existingMap.get(item.name);
      console.log(`Bar ${item.name} already exists with ID: ${existing.id}`);
      // Ensure authorization
      await supabase
        .from('bar_user_authorizations')
        .upsert({
          bar_id: existing.id,
          user_id: ownerId,
          role: 'Owner',
          status: 'Active'
        }, { onConflict: 'bar_id, user_id' });
    }
  }

  const { data: finalBars } = await supabase.from('bar_outlets').select('*');
  console.log(`\nFinal active bars count in database: ${finalBars?.length || 0}`);
}

seed10Bars().catch(console.error);
