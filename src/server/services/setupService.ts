import { getSupabaseServiceClient } from '../../lib/supabase/client.ts';
import { SetupInput } from '../../types/index.ts';
import { SetupSchema, SetupSchemaType } from '../../lib/validation/setup.ts';
import { hashPassword } from '../../lib/auth/password.ts';

export interface SetupStatusResult {
  setupCompleted: boolean;
  setupCompletedAt: string | null;
  businessName?: string;
  selectedLanguage?: string;
}

export class SetupService {
  /**
   * Determine whether the application setup has been completed.
   * Source of truth is always the database.
   */
  static async getSetupStatus(): Promise<SetupStatusResult> {
    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase
      .from('application_setup')
      .select('setup_completed, setup_completed_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      // If table doesn't exist yet, setup is definitely not completed
      if (error.code === '42P01') {
        return { setupCompleted: false, setupCompletedAt: null };
      }
      throw new Error(`Database error checking setup status: ${error.message}`);
    }

    if (!data) {
      return { setupCompleted: false, setupCompletedAt: null };
    }

    if (data.setup_completed) {
      // Fetch business settings if completed
      const { data: settings } = await supabase
        .from('settings')
        .select('business_name, selected_language')
        .limit(1)
        .maybeSingle();

      return {
        setupCompleted: true,
        setupCompletedAt: data.setup_completed_at,
        businessName: settings?.business_name,
        selectedLanguage: settings?.selected_language,
      };
    }

    return {
      setupCompleted: false,
      setupCompletedAt: null,
    };
  }

  /**
   * Atomic Setup Operation.
   * 1. Validates input server-side
   * 2. Checks setup status to prevent duplicate execution
   * 3. Hashes password securely
   * 4. Creates owner credentials
   * 5. Saves business settings
   * 6. Creates initial categories
   * 7. Creates initial pack sizes
   * 8. Marks setup completed
   */
  static async executeSetup(input: SetupInput): Promise<{ success: boolean; redirect: string }> {
    // 1. Server-side validation
    const validation = SetupSchema.safeParse(input);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Invalid setup parameters';
      throw new Error(firstError);
    }
    const validData: SetupSchemaType = validation.data;

    // 2. Check if setup was already completed (Idempotency protection)
    const currentStatus = await this.getSetupStatus();
    if (currentStatus.setupCompleted) {
      throw new Error('Setup has already been completed. Please log in.');
    }

    const supabase = getSupabaseServiceClient();

    // Track created entity IDs for rollback if needed
    let createdOwnerId: string | null = null;
    let createdSettingsId: string | null = null;
    let createdCategories: string[] = [];

    try {
      // 3. Hash password
      const hashedPassword = await hashPassword(validData.password);

      // 4. Create owner credentials
      const { data: owner, error: ownerError } = await supabase
        .from('owner_credentials')
        .insert({
          mobile_number: validData.mobileNumber,
          password_hash: hashedPassword,
          active: true,
        })
        .select('id')
        .single();

      if (ownerError || !owner) {
        throw new Error(`Failed to create owner credentials: ${ownerError?.message || 'Unknown error'}`);
      }
      createdOwnerId = owner.id;

      // 5. Create business settings
      const { data: settings, error: settingsError } = await supabase
        .from('settings')
        .insert({
          business_name: validData.businessName,
          address: validData.address,
          business_address: validData.address,
          owner_mobile: validData.ownerMobile,
          vat_number: validData.vatNumber || null,
          licence_reference: validData.licenceReference || null,
          currency: 'INR',
          timezone: 'Asia/Kolkata',
          date_format: 'DD/MM/YYYY',
          selected_language: validData.language,
          language: validData.language,
          low_stock_threshold: 5,
        })
        .select('id')
        .single();

      if (settingsError || !settings) {
        throw new Error(`Failed to create business settings: ${settingsError?.message || 'Unknown error'}`);
      }
      createdSettingsId = settings.id;

      // 6. Create required initial categories
      const requiredCategories = [
        { name: 'Whisky', code: 'WHISKY', active: true },
        { name: 'Beer', code: 'BEER', active: true },
        { name: 'Wine', code: 'WINE', active: true },
        { name: 'Rum', code: 'RUM', active: true },
        { name: 'Vodka', code: 'VODKA', active: true },
        { name: 'Brandy', code: 'BRANDY', active: true },
        { name: 'MML', code: 'MML', active: true },
        { name: 'Fermented Beer', code: 'FERMENTED_BEER', active: true },
        { name: 'Other', code: 'OTHER', active: true },
      ];

      const { data: insertedCategories, error: catError } = await supabase
        .from('categories')
        .upsert(requiredCategories, { onConflict: 'name' })
        .select('id, name');

      if (catError || !insertedCategories) {
        throw new Error(`Failed to create initial categories: ${catError?.message || 'Unknown error'}`);
      }
      createdCategories = insertedCategories.map(c => c.id);

      const whiskyCat = insertedCategories.find(c => c.name === 'Whisky');
      const beerCat = insertedCategories.find(c => c.name === 'Beer');

      if (!whiskyCat || !beerCat) {
        throw new Error('Missing core categories Whisky or Beer after insertion');
      }

      const rumCat = insertedCategories.find(c => c.name === 'Rum');
      const vodkaCat = insertedCategories.find(c => c.name === 'Vodka');
      const wineCat = insertedCategories.find(c => c.name === 'Wine');

      // 7. Create required initial pack sizes (Strict Rule: NO 500 ml Pint!)
      const requiredPackSizes: any[] = [
        // Whisky
        { category_id: whiskyCat.id, name: '90 ml Nip', volume_ml: 90, pack_type: 'Bottle', active: true },
        { category_id: whiskyCat.id, name: '180 ml Nip', volume_ml: 180, pack_type: 'Bottle', active: true },
        { category_id: whiskyCat.id, name: '375 ml Pint', volume_ml: 375, pack_type: 'Bottle', active: true },
        { category_id: whiskyCat.id, name: '750 ml Bottle', volume_ml: 750, pack_type: 'Bottle', active: true },
        { category_id: whiskyCat.id, name: '1000 ml Bottle', volume_ml: 1000, pack_type: 'Bottle', active: true },
        { category_id: whiskyCat.id, name: '2 L Bottle', volume_ml: 2000, pack_type: 'Bottle', active: true },
        // Beer (Strict constraint: 500 ml is Can, NOT Pint)
        { category_id: beerCat.id, name: '275 ml Can', volume_ml: 275, pack_type: 'Can', active: true },
        { category_id: beerCat.id, name: '330 ml Can', volume_ml: 330, pack_type: 'Can', active: true },
        { category_id: beerCat.id, name: '330 ml Pint', volume_ml: 330, pack_type: 'Pint', active: true },
        { category_id: beerCat.id, name: '500 ml Can', volume_ml: 500, pack_type: 'Can', active: true },
        { category_id: beerCat.id, name: '650 ml Bottle', volume_ml: 650, pack_type: 'Bottle', active: true },
      ];

      if (rumCat) {
        requiredPackSizes.push(
          { category_id: rumCat.id, name: '180 ml Nip', volume_ml: 180, pack_type: 'Bottle', active: true },
          { category_id: rumCat.id, name: '375 ml Pint', volume_ml: 375, pack_type: 'Bottle', active: true },
          { category_id: rumCat.id, name: '750 ml Bottle', volume_ml: 750, pack_type: 'Bottle', active: true }
        );
      }
      if (vodkaCat) {
        requiredPackSizes.push(
          { category_id: vodkaCat.id, name: '180 ml Nip', volume_ml: 180, pack_type: 'Bottle', active: true },
          { category_id: vodkaCat.id, name: '375 ml Pint', volume_ml: 375, pack_type: 'Bottle', active: true },
          { category_id: vodkaCat.id, name: '750 ml Bottle', volume_ml: 750, pack_type: 'Bottle', active: true }
        );
      }
      if (wineCat) {
        requiredPackSizes.push(
          { category_id: wineCat.id, name: '375 ml Bottle', volume_ml: 375, pack_type: 'Bottle', active: true },
          { category_id: wineCat.id, name: '750 ml Bottle', volume_ml: 750, pack_type: 'Bottle', active: true }
        );
      }

      const { error: packError } = await supabase
        .from('pack_sizes')
        .upsert(requiredPackSizes, { onConflict: 'category_id, name' });

      if (packError) {
        throw new Error(`Failed to create initial pack sizes: ${packError.message}`);
      }

      // 8. Create standard manufacturers
      const standardManufacturers = [
        { name: 'Pernod Ricard India Pvt Ltd', state: 'Maharashtra', active: true },
        { name: 'United Spirits Ltd (Diageo)', state: 'Maharashtra', active: true },
        { name: 'United Breweries Limited (Heineken)', state: 'Maharashtra', active: true },
        { name: 'Carlsberg India Pvt Ltd', state: 'Maharashtra', active: true },
        { name: 'Radico Khaitan Ltd', state: 'Maharashtra', active: true },
        { name: 'Sula Vineyards Ltd', state: 'Maharashtra', active: true },
        { name: 'Tilaknagar Industries Ltd', state: 'Maharashtra', active: true },
      ];

      const { data: insertedManufacturers } = await supabase
        .from('manufacturers')
        .upsert(standardManufacturers, { onConflict: 'name' })
        .select('id, name');

      // 9. Create standard brands linked to categories
      if (insertedManufacturers) {
        const pernod = insertedManufacturers.find(m => m.name.includes('Pernod'));
        const usl = insertedManufacturers.find(m => m.name.includes('United Spirits'));
        const ub = insertedManufacturers.find(m => m.name.includes('United Breweries'));
        const carlsberg = insertedManufacturers.find(m => m.name.includes('Carlsberg'));
        const radico = insertedManufacturers.find(m => m.name.includes('Radico'));
        const sula = insertedManufacturers.find(m => m.name.includes('Sula'));

        const standardBrands = [
          { name: 'Royal Stag', category_id: whiskyCat.id, manufacturer_id: pernod?.id, maharashtra_status: 'Active', active: true },
          { name: 'Blenders Pride', category_id: whiskyCat.id, manufacturer_id: pernod?.id, maharashtra_status: 'Active', active: true },
          { name: "McDowell's No. 1", category_id: whiskyCat.id, manufacturer_id: usl?.id, maharashtra_status: 'Active', active: true },
          { name: 'Antiquity Blue', category_id: whiskyCat.id, manufacturer_id: usl?.id, maharashtra_status: 'Active', active: true },
          { name: 'Kingfisher Premium', category_id: beerCat.id, manufacturer_id: ub?.id, maharashtra_status: 'Active', active: true },
          { name: 'Kingfisher Strong', category_id: beerCat.id, manufacturer_id: ub?.id, maharashtra_status: 'Active', active: true },
          { name: 'Tuborg Strong', category_id: beerCat.id, manufacturer_id: carlsberg?.id, maharashtra_status: 'Active', active: true },
          ...(rumCat ? [{ name: 'Old Monk', category_id: rumCat.id, manufacturer_id: radico?.id, maharashtra_status: 'Active', active: true }] : []),
          ...(vodkaCat ? [{ name: 'Magic Moments', category_id: vodkaCat.id, manufacturer_id: radico?.id, maharashtra_status: 'Active', active: true }] : []),
          ...(wineCat ? [{ name: 'Sula Shiraz', category_id: wineCat.id, manufacturer_id: sula?.id, maharashtra_status: 'Active', active: true }] : []),
        ];

        await supabase
          .from('brands')
          .upsert(standardBrands, { onConflict: 'category_id, name' });
      }

      // 10. Mark setup as completed in application_setup table
      const { error: setupError } = await supabase
        .from('application_setup')
        .insert({
          setup_completed: true,
          setup_completed_at: new Date().toISOString(),
        });

      if (setupError) {
        throw new Error(`Failed to mark setup as completed: ${setupError.message}`);
      }

      return {
        success: true,
        redirect: '/login',
      };
    } catch (err) {
      // Atomic rollback cleanup on failure
      if (createdOwnerId) {
        await supabase.from('owner_credentials').delete().eq('id', createdOwnerId);
      }
      if (createdSettingsId) {
        await supabase.from('settings').delete().eq('id', createdSettingsId);
      }
      throw err;
    }
  }
}
