import { getSupabaseServiceClient } from '../../lib/supabase/client.ts';
import { ExciseLicence, ExciseDocumentReference, ComplianceReference } from '../../types/index.ts';

export class ExciseService {
  /**
   * Fetch all Excise Licences
   */
  static async getLicences(status?: string): Promise<ExciseLicence[]> {
    const supabase = getSupabaseServiceClient();
    let query = supabase.from('excise_licences').select('*').order('valid_to', { ascending: true });

    if (status && status !== 'All') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch excise licences: ${error.message}`);
    }

    return (data as unknown as ExciseLicence[]) || [];
  }

  /**
   * Create a new Excise Licence
   */
  static async createLicence(input: {
    licenceType: string;
    licenceNumber: string;
    issueDate?: string;
    validFrom: string;
    validTo: string;
    issuingAuthority: string;
    businessReference?: string;
    documentReference?: string;
    status?: 'Active' | 'Expired' | 'Suspended';
    remarks?: string;
  }): Promise<ExciseLicence> {
    if (!input.licenceType || !input.licenceNumber || !input.validFrom || !input.validTo || !input.issuingAuthority) {
      throw new Error('Licence Type, Licence Number, Valid From, Valid To, and Issuing Authority are required');
    }

    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from('excise_licences')
      .insert({
        licence_type: input.licenceType,
        licence_number: input.licenceNumber,
        issue_date: input.issueDate || null,
        valid_from: input.validFrom,
        valid_to: input.validTo,
        issuing_authority: input.issuingAuthority,
        business_reference: input.businessReference || null,
        document_reference: input.documentReference || null,
        status: input.status || 'Active',
        remarks: input.remarks || null,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error(`Licence number "${input.licenceNumber}" already exists`);
      }
      throw new Error(`Failed to create excise licence: ${error.message}`);
    }

    return data as unknown as ExciseLicence;
  }

  /**
   * Update an existing Excise Licence
   */
  static async updateLicence(
    id: string,
    input: Partial<{
      licenceType: string;
      licenceNumber: string;
      issueDate: string;
      validFrom: string;
      validTo: string;
      issuingAuthority: string;
      businessReference: string;
      documentReference: string;
      status: 'Active' | 'Expired' | 'Suspended';
      remarks: string;
    }>
  ): Promise<ExciseLicence> {
    const supabase = getSupabaseServiceClient();
    const payload: Record<string, any> = { updated_at: new Date().toISOString() };

    if (input.licenceType !== undefined) payload.licence_type = input.licenceType;
    if (input.licenceNumber !== undefined) payload.licence_number = input.licenceNumber;
    if (input.issueDate !== undefined) payload.issue_date = input.issueDate;
    if (input.validFrom !== undefined) payload.valid_from = input.validFrom;
    if (input.validTo !== undefined) payload.valid_to = input.validTo;
    if (input.issuingAuthority !== undefined) payload.issuing_authority = input.issuingAuthority;
    if (input.businessReference !== undefined) payload.business_reference = input.businessReference;
    if (input.documentReference !== undefined) payload.document_reference = input.documentReference;
    if (input.status !== undefined) payload.status = input.status;
    if (input.remarks !== undefined) payload.remarks = input.remarks;

    const { data, error } = await supabase
      .from('excise_licences')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update licence: ${error.message}`);
    }

    return data as unknown as ExciseLicence;
  }

  /**
   * Fetch Excise Document References
   */
  static async getDocumentReferences(params?: { referenceType?: string; search?: string }): Promise<ExciseDocumentReference[]> {
    const supabase = getSupabaseServiceClient();
    let query = supabase.from('excise_document_references').select(`
      id,
      reference_type,
      reference_number,
      reference_date,
      product_id,
      batch_id,
      purchase_id,
      quantity,
      document_reference,
      remarks,
      created_at,
      product:products(name, product_name)
    `).order('created_at', { ascending: false });

    if (params?.referenceType && params.referenceType !== 'All') {
      query = query.eq('reference_type', params.referenceType);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch excise document references: ${error.message}`);
    }

    return (data as unknown as ExciseDocumentReference[]) || [];
  }

  /**
   * Create an Excise Document Reference (TP Permit, Transport, etc.)
   */
  static async createDocumentReference(input: {
    referenceType: 'TP_PERMIT' | 'TRANSPORT' | 'INWARD' | 'LICENCE' | 'EXCISE_DOCUMENT' | 'OTHER';
    referenceNumber: string;
    referenceDate?: string;
    productId?: string;
    batchId?: string;
    purchaseId?: string;
    quantity?: number;
    documentReference?: string;
    remarks?: string;
  }): Promise<ExciseDocumentReference> {
    if (!input.referenceType || !input.referenceNumber) {
      throw new Error('Reference type and reference number are required');
    }

    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from('excise_document_references')
      .insert({
        reference_type: input.referenceType,
        reference_number: input.referenceNumber,
        reference_date: input.referenceDate || new Date().toISOString().split('T')[0],
        product_id: input.productId || null,
        batch_id: input.batchId || null,
        purchase_id: input.purchaseId || null,
        quantity: input.quantity || null,
        document_reference: input.documentReference || null,
        remarks: input.remarks || null,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to record excise document reference: ${error.message}`);
    }

    return data as unknown as ExciseDocumentReference;
  }
}
