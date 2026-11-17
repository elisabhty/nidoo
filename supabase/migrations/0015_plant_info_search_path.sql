-- NIDOO — Le linter de sécurité Supabase demande un search_path fixe pour private.plant_info.
alter function private.plant_info(text) set search_path = '';
