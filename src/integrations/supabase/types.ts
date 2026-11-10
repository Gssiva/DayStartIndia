export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string;
          admin_id: string;
          created_at: string;
          details: Json;
          id: string;
          ip_address: string | null;
          target_id: string;
          target_type: string;
        };
        Insert: {
          action: string;
          admin_id: string;
          created_at?: string;
          details?: Json;
          id?: string;
          ip_address?: string | null;
          target_id: string;
          target_type: string;
        };
        Update: {
          action?: string;
          admin_id?: string;
          created_at?: string;
          details?: Json;
          id?: string;
          ip_address?: string | null;
          target_id?: string;
          target_type?: string;
        };
        Relationships: [];
      };
      booking_disputes: {
        Row: {
          booking_id: string;
          created_at: string;
          customer_id: string;
          id: string;
          reason: string;
          resolution_notes: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          status: string;
          updated_at: string;
          worker_id: string | null;
        };
        Insert: {
          booking_id: string;
          created_at?: string;
          customer_id: string;
          id?: string;
          reason: string;
          resolution_notes?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          updated_at?: string;
          worker_id?: string | null;
        };
        Update: {
          booking_id?: string;
          created_at?: string;
          customer_id?: string;
          id?: string;
          reason?: string;
          resolution_notes?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          updated_at?: string;
          worker_id?: string | null;
        };
        Relationships: [];
      };
      booking_evidence: {
        Row: {
          assignment_id: string | null;
          booking_id: string;
          bucket_id: string;
          created_at: string;
          evidence_type: string;
          file_path: string;
          id: string;
          notes: string | null;
          uploaded_at: string;
          verified_by_admin: boolean;
          worker_id: string;
        };
        Insert: {
          assignment_id?: string | null;
          booking_id: string;
          bucket_id?: string;
          created_at?: string;
          evidence_type: string;
          file_path: string;
          id?: string;
          notes?: string | null;
          uploaded_at?: string;
          verified_by_admin?: boolean;
          worker_id: string;
        };
        Update: {
          assignment_id?: string | null;
          booking_id?: string;
          bucket_id?: string;
          created_at?: string;
          evidence_type?: string;
          file_path?: string;
          id?: string;
          notes?: string | null;
          uploaded_at?: string;
          verified_by_admin?: boolean;
          worker_id?: string;
        };
        Relationships: [];
      };
      booking_events: {
        Row: {
          actor_id: string | null;
          actor_role: string | null;
          booking_id: string;
          created_at: string;
          event_type: string;
          id: string;
          metadata: Json;
          notes: string | null;
          status_from: string | null;
          status_to: string;
        };
        Insert: {
          actor_id?: string | null;
          actor_role?: string | null;
          booking_id: string;
          created_at?: string;
          event_type: string;
          id?: string;
          metadata?: Json;
          notes?: string | null;
          status_from?: string | null;
          status_to: string;
        };
        Update: {
          actor_id?: string | null;
          actor_role?: string | null;
          booking_id?: string;
          created_at?: string;
          event_type?: string;
          id?: string;
          metadata?: Json;
          notes?: string | null;
          status_from?: string | null;
          status_to?: string;
        };
        Relationships: [];
      };
      booking_items: {
        Row: {
          booking_id: string;
          created_at: string;
          id: string;
          quantity: number;
          title: string;
          total_price: number;
          unit_price: number;
        };
        Insert: {
          booking_id: string;
          created_at?: string;
          id?: string;
          quantity?: number;
          title: string;
          total_price: number;
          unit_price: number;
        };
        Update: {
          booking_id?: string;
          created_at?: string;
          id?: string;
          quantity?: number;
          title?: string;
          total_price?: number;
          unit_price?: number;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          address: Json;
          advance_amount: number;
          area: string;
          balance_amount: number;
          booking_date: string | null;
          booking_type: string;
          city: string;
          created_at: string;
          customer_confirmed_at: string | null;
          dispute_reason: string | null;
          disputed: boolean;
          evidence_submitted: boolean;
          id: string;
          language: string;
          payment: Json;
          payment_status: string;
          price_snapshot: Json;
          rating: number | null;
          rating_feedback: string | null;
          service_id: string | null;
          service_slug: string;
          site_lat: number | null;
          site_lng: number | null;
          slot: string | null;
          status: string;
          sub_service_id: string | null;
          sub_service_slug: string;
          timing: string;
          total_price: number;
          updated_at: string;
          user_id: string;
          worker: Json;
          workers: number;
        };
        Insert: {
          address?: Json;
          advance_amount?: number;
          area: string;
          balance_amount?: number;
          booking_date?: string | null;
          booking_type?: string;
          city: string;
          created_at?: string;
          customer_confirmed_at?: string | null;
          dispute_reason?: string | null;
          disputed?: boolean;
          evidence_submitted?: boolean;
          id: string;
          language?: string;
          payment?: Json;
          payment_status?: string;
          price_snapshot?: Json;
          rating?: number | null;
          rating_feedback?: string | null;
          service_id?: string | null;
          service_slug: string;
          site_lat?: number | null;
          site_lng?: number | null;
          slot?: string | null;
          status?: string;
          sub_service_id?: string | null;
          sub_service_slug: string;
          timing?: string;
          total_price?: number;
          updated_at?: string;
          user_id: string;
          worker?: Json;
          workers?: number;
        };
        Update: {
          address?: Json;
          advance_amount?: number;
          area?: string;
          balance_amount?: number;
          booking_date?: string | null;
          booking_type?: string;
          city?: string;
          created_at?: string;
          customer_confirmed_at?: string | null;
          dispute_reason?: string | null;
          disputed?: boolean;
          evidence_submitted?: boolean;
          id?: string;
          language?: string;
          payment?: Json;
          payment_status?: string;
          price_snapshot?: Json;
          rating?: number | null;
          rating_feedback?: string | null;
          service_id?: string | null;
          service_slug?: string;
          site_lat?: number | null;
          site_lng?: number | null;
          slot?: string | null;
          status?: string;
          sub_service_id?: string | null;
          sub_service_slug?: string;
          timing?: string;
          total_price?: number;
          updated_at?: string;
          user_id?: string;
          worker?: Json;
          workers?: number;
        };
        Relationships: [];
      };
      customer_profiles: {
        Row: {
          billing_address: Json;
          company_name: string | null;
          created_at: string;
          customer_type: string;
          gstin: string | null;
          id: string;
          saved_addresses: Json;
          updated_at: string;
        };
        Insert: {
          billing_address?: Json;
          company_name?: string | null;
          created_at?: string;
          customer_type?: string;
          gstin?: string | null;
          id: string;
          saved_addresses?: Json;
          updated_at?: string;
        };
        Update: {
          billing_address?: Json;
          company_name?: string | null;
          created_at?: string;
          customer_type?: string;
          gstin?: string | null;
          id?: string;
          saved_addresses?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          created_at: string;
          id: string;
          is_read: boolean;
          link: string | null;
          message: string;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_read?: boolean;
          link?: string | null;
          message: string;
          title: string;
          type?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_read?: boolean;
          link?: string | null;
          message?: string;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      payment_transactions: {
        Row: {
          amount: number;
          booking_id: string;
          created_at: string;
          currency: string;
          customer_id: string;
          gateway_name: string;
          gateway_order_id: string | null;
          gateway_payment_id: string | null;
          gateway_signature: string | null;
          id: string;
          idempotency_key: string;
          metadata: Json;
          payment_type: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          booking_id: string;
          created_at?: string;
          currency?: string;
          customer_id: string;
          gateway_name?: string;
          gateway_order_id?: string | null;
          gateway_payment_id?: string | null;
          gateway_signature?: string | null;
          id?: string;
          idempotency_key: string;
          metadata?: Json;
          payment_type: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          booking_id?: string;
          created_at?: string;
          currency?: string;
          customer_id?: string;
          gateway_name?: string;
          gateway_order_id?: string | null;
          gateway_payment_id?: string | null;
          gateway_signature?: string | null;
          id?: string;
          idempotency_key?: string;
          metadata?: Json;
          payment_type?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payout_requests: {
        Row: {
          account_snapshot: Json;
          amount: number;
          created_at: string;
          id: string;
          notes: string | null;
          payout_method: string;
          processed_at: string | null;
          processed_by: string | null;
          reference_id: string | null;
          status: string;
          updated_at: string;
          worker_id: string;
        };
        Insert: {
          account_snapshot?: Json;
          amount: number;
          created_at?: string;
          id?: string;
          notes?: string | null;
          payout_method?: string;
          processed_at?: string | null;
          processed_by?: string | null;
          reference_id?: string | null;
          status?: string;
          updated_at?: string;
          worker_id: string;
        };
        Update: {
          account_snapshot?: Json;
          amount?: number;
          created_at?: string;
          id?: string;
          notes?: string | null;
          payout_method?: string;
          processed_at?: string | null;
          processed_by?: string | null;
          reference_id?: string | null;
          status?: string;
          updated_at?: string;
          worker_id?: string;
        };
        Relationships: [];
      };
      phone_otp_requests: {
        Row: {
          attempts: number;
          code_hash: string;
          consumed_at: string | null;
          created_at: string;
          expires_at: string;
          id: string;
          ip_hash: string | null;
          phone: string;
        };
        Insert: {
          attempts?: number;
          code_hash: string;
          consumed_at?: string | null;
          created_at?: string;
          expires_at: string;
          id?: string;
          ip_hash?: string | null;
          phone: string;
        };
        Update: {
          attempts?: number;
          code_hash?: string;
          consumed_at?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          ip_hash?: string | null;
          phone?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_quotes: {
        Row: {
          admin_notes: string | null;
          area: string;
          city: string;
          created_at: string;
          customer_id: string;
          description: string;
          duration_days: number;
          estimated_budget: number | null;
          id: string;
          quote_amount: number | null;
          service_id: string | null;
          site_address: string | null;
          status: string;
          title: string;
          updated_at: string;
          workers_needed: number;
        };
        Insert: {
          admin_notes?: string | null;
          area: string;
          city: string;
          created_at?: string;
          customer_id: string;
          description: string;
          duration_days?: number;
          estimated_budget?: number | null;
          id?: string;
          quote_amount?: number | null;
          service_id?: string | null;
          site_address?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
          workers_needed?: number;
        };
        Update: {
          admin_notes?: string | null;
          area?: string;
          city?: string;
          created_at?: string;
          customer_id?: string;
          description?: string;
          duration_days?: number;
          estimated_budget?: number | null;
          id?: string;
          quote_amount?: number | null;
          service_id?: string | null;
          site_address?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          workers_needed?: number;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          booking_id: string;
          created_at: string;
          customer_id: string;
          feedback: string | null;
          id: string;
          rating: number;
          worker_id: string | null;
        };
        Insert: {
          booking_id: string;
          created_at?: string;
          customer_id: string;
          feedback?: string | null;
          id?: string;
          rating: number;
          worker_id?: string | null;
        };
        Update: {
          booking_id?: string;
          created_at?: string;
          customer_id?: string;
          feedback?: string | null;
          id?: string;
          rating?: number;
          worker_id?: string | null;
        };
        Relationships: [];
      };
      service_coverage_locations: {
        Row: {
          area: string;
          city: string;
          created_at: string;
          id: string;
          is_active: boolean;
          lat: number;
          lng: number;
          radius_km: number;
          updated_at: string;
        };
        Insert: {
          area: string;
          city: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          lat: number;
          lng: number;
          radius_km?: number;
          updated_at?: string;
        };
        Update: {
          area?: string;
          city?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          lat?: number;
          lng?: number;
          radius_km?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      services: {
        Row: {
          created_at: string;
          description: string;
          eta: string | null;
          evidence_requirements: Json;
          icon: string;
          id: string;
          image: string | null;
          multi_worker: boolean;
          name: string;
          pricing_model: string;
          slug: string;
          sort_order: number;
          starting_price: number | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string;
          eta?: string | null;
          evidence_requirements?: Json;
          icon?: string;
          id?: string;
          image?: string | null;
          multi_worker?: boolean;
          name: string;
          pricing_model?: string;
          slug: string;
          sort_order?: number;
          starting_price?: number | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          eta?: string | null;
          evidence_requirements?: Json;
          icon?: string;
          id?: string;
          image?: string | null;
          multi_worker?: boolean;
          name?: string;
          pricing_model?: string;
          slug?: string;
          sort_order?: number;
          starting_price?: number | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sub_services: {
        Row: {
          created_at: string;
          description: string;
          duration: string | null;
          icon: string;
          id: string;
          image: string | null;
          name: string;
          price: number;
          service_id: string;
          slug: string;
          sort_order: number;
          status: string;
          unit: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string;
          duration?: string | null;
          icon?: string;
          id?: string;
          image?: string | null;
          name: string;
          price: number;
          service_id: string;
          slug: string;
          sort_order?: number;
          status?: string;
          unit?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          duration?: string | null;
          icon?: string;
          id?: string;
          image?: string | null;
          name?: string;
          price?: number;
          service_id?: string;
          slug?: string;
          sort_order?: number;
          status?: string;
          unit?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sub_services_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          role: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          role: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      worker_assignments: {
        Row: {
          arrived_at: string | null;
          assigned_at: string;
          assignment_reason: string | null;
          booking_id: string;
          completed_at: string | null;
          created_at: string;
          distance_km: number | null;
          id: string;
          score: number | null;
          started_at: string | null;
          status: string;
          updated_at: string;
          worker_id: string;
        };
        Insert: {
          arrived_at?: string | null;
          assigned_at?: string;
          assignment_reason?: string | null;
          booking_id: string;
          completed_at?: string | null;
          created_at?: string;
          distance_km?: number | null;
          id?: string;
          score?: number | null;
          started_at?: string | null;
          status?: string;
          updated_at?: string;
          worker_id: string;
        };
        Update: {
          arrived_at?: string | null;
          assigned_at?: string;
          assignment_reason?: string | null;
          booking_id?: string;
          completed_at?: string | null;
          created_at?: string;
          distance_km?: number | null;
          id?: string;
          score?: number | null;
          started_at?: string | null;
          status?: string;
          updated_at?: string;
          worker_id?: string;
        };
        Relationships: [];
      };
      worker_earnings: {
        Row: {
          assignment_id: string | null;
          booking_id: string;
          created_at: string;
          gross_amount: number;
          hold_reason: string | null;
          id: string;
          net_earnings: number;
          platform_fee: number;
          status: string;
          updated_at: string;
          worker_id: string;
        };
        Insert: {
          assignment_id?: string | null;
          booking_id: string;
          created_at?: string;
          gross_amount: number;
          hold_reason?: string | null;
          id?: string;
          net_earnings: number;
          platform_fee?: number;
          status?: string;
          updated_at?: string;
          worker_id: string;
        };
        Update: {
          assignment_id?: string | null;
          booking_id?: string;
          created_at?: string;
          gross_amount?: number;
          hold_reason?: string | null;
          id?: string;
          net_earnings?: number;
          platform_fee?: number;
          status?: string;
          updated_at?: string;
          worker_id?: string;
        };
        Relationships: [];
      };
      worker_kyc_documents: {
        Row: {
          created_at: string;
          doc_type: string;
          file_path: string | null;
          id: string;
          reviewer_note: string | null;
          status: string;
          submitted_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          doc_type: string;
          file_path?: string | null;
          id?: string;
          reviewer_note?: string | null;
          status?: string;
          submitted_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          doc_type?: string;
          file_path?: string | null;
          id?: string;
          reviewer_note?: string | null;
          status?: string;
          submitted_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      worker_profiles: {
        Row: {
          address_line: string | null;
          alt_phone: string | null;
          approval_date: string | null;
          approval_status: string;
          approved_by: string | null;
          availability_schedule: Json;
          availability_status: string;
          bank_account_name: string | null;
          bank_account_number: string | null;
          bank_ifsc: string | null;
          completed_jobs_count: number;
          created_at: string;
          current_lat: number | null;
          current_lng: number | null;
          district: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          emergency_contact_relation: string | null;
          e_shram_number: string | null;
          experience_years: number;
          full_name: string | null;
          id: string;
          languages: string[];
          last_location_at: string | null;
          payout_preference: string;
          payout_preference_requested: string | null;
          phone: string | null;
          photo_path: string | null;
          pin_code: string | null;
          rating: number;
          rating_count: number;
          service_areas: string[];
          skill_categories: string[];
          state: string | null;
          terms_accepted_at: string | null;
          updated_at: string;
          upi_id: string | null;
          user_id: string;
        };
        Insert: {
          address_line?: string | null;
          alt_phone?: string | null;
          approval_date?: string | null;
          approval_status?: string;
          approved_by?: string | null;
          availability_schedule?: Json;
          availability_status?: string;
          bank_account_name?: string | null;
          bank_account_number?: string | null;
          bank_ifsc?: string | null;
          completed_jobs_count?: number;
          created_at?: string;
          current_lat?: number | null;
          current_lng?: number | null;
          district?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          emergency_contact_relation?: string | null;
          e_shram_number?: string | null;
          experience_years?: number;
          full_name?: string | null;
          id?: string;
          languages?: string[];
          last_location_at?: string | null;
          payout_preference?: string;
          payout_preference_requested?: string | null;
          phone?: string | null;
          photo_path?: string | null;
          pin_code?: string | null;
          rating?: number;
          rating_count?: number;
          service_areas?: string[];
          skill_categories?: string[];
          state?: string | null;
          terms_accepted_at?: string | null;
          updated_at?: string;
          upi_id?: string | null;
          user_id: string;
        };
        Update: {
          address_line?: string | null;
          alt_phone?: string | null;
          approval_date?: string | null;
          approval_status?: string;
          approved_by?: string | null;
          availability_schedule?: Json;
          availability_status?: string;
          bank_account_name?: string | null;
          bank_account_number?: string | null;
          bank_ifsc?: string | null;
          completed_jobs_count?: number;
          created_at?: string;
          current_lat?: number | null;
          current_lng?: number | null;
          district?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          emergency_contact_relation?: string | null;
          e_shram_number?: string | null;
          experience_years?: number;
          full_name?: string | null;
          id?: string;
          languages?: string[];
          last_location_at?: string | null;
          payout_preference?: string;
          payout_preference_requested?: string | null;
          phone?: string | null;
          photo_path?: string | null;
          pin_code?: string | null;
          rating?: number;
          rating_count?: number;
          service_areas?: string[];
          skill_categories?: string[];
          state?: string | null;
          terms_accepted_at?: string | null;
          updated_at?: string;
          upi_id?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      worker_registrations: {
        Row: {
          aadhaar_document_path: string | null;
          aadhaar_last4: string;
          aadhaar_ocr_full: string | null;
          aadhaar_verified: boolean;
          area: string;
          category: string;
          city: string;
          created_at: string;
          email: string | null;
          email_verified: boolean;
          full_name: string;
          id: string;
          language: string;
          notes: string | null;
          pay_model: string;
          phone: string;
          phone_verified: boolean;
          status: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          aadhaar_document_path?: string | null;
          aadhaar_last4: string;
          aadhaar_ocr_full?: string | null;
          aadhaar_verified?: boolean;
          area: string;
          category: string;
          city: string;
          created_at?: string;
          email?: string | null;
          email_verified?: boolean;
          full_name: string;
          id?: string;
          language?: string;
          notes?: string | null;
          pay_model: string;
          phone: string;
          phone_verified?: boolean;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          aadhaar_document_path?: string | null;
          aadhaar_last4?: string;
          aadhaar_ocr_full?: string | null;
          aadhaar_verified?: boolean;
          area?: string;
          category?: string;
          city?: string;
          created_at?: string;
          email?: string | null;
          email_verified?: boolean;
          full_name?: string;
          id?: string;
          language?: string;
          notes?: string | null;
          pay_model?: string;
          phone?: string;
          phone_verified?: boolean;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          check_user_id: string;
          check_role: string;
        };
        Returns: boolean;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_worker: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
