-- Les records de « À deux, on porte ! » ne s'écrivent que par public.porte_fini : on retire les droits d'écriture
-- directs (la sécurité par ligne les bloquait déjà, faute de règle ; c'est une ceinture en plus des bretelles).
revoke insert, update, delete, truncate, references, trigger on public.porte_records from anon, authenticated;
revoke select on public.porte_records from anon;
