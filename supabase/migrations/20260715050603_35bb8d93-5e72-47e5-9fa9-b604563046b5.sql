
CREATE POLICY "Workers can upload own aadhaar docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'aadhaar-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Workers can read own aadhaar docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'aadhaar-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
