-- Custom SQL migration file, put your code below! --
CREATE POLICY merchant_isolation ON public.subscriptions 
    FOR ALL USING (merchant_id = current_setting('app.current_merchant_id')::text);