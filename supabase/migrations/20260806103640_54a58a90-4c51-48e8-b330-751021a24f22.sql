CREATE POLICY "Workers can read their own kyc files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'worker-kyc' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Workers can upload their own kyc files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'worker-kyc' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Workers can update their own kyc files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'worker-kyc' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'worker-kyc' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Workers can delete their own kyc files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'worker-kyc' AND (storage.foldername(name))[1] = auth.uid()::text);