-- ============================================================
-- KLô — Schéma Supabase complet
-- Version : 2.0 — Production
-- ============================================================
-- Instructions :
--   1. Ouvrir Supabase Dashboard > SQL Editor
--   2. Coller et exécuter ce fichier en entier
--   3. Vérifier dans Table Editor que toutes les tables sont créées
-- ============================================================

-- Extensions nécessaires
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- NETTOYAGE (si re-exécution)
-- ============================================================
drop table if exists journal_audit cascade;
drop table if exists credits cascade;
drop table if exists notifications cascade;
drop table if exists documents cascade;
drop table if exists paiements cascade;
drop table if exists contrats cascade;
drop table if exists kyc cascade;
drop table if exists terrains cascade;
drop table if exists profils cascade;

drop type if exists type_profil_enum cascade;
drop type if exists statut_kyc_enum cascade;
drop type if exists statut_terrain_enum cascade;
drop type if exists statut_contrat_enum cascade;
drop type if exists type_paiement_enum cascade;
drop type if exists statut_paiement_enum cascade;
drop type if exists moyen_paiement_enum cascade;
drop type if exists operateur_enum cascade;
drop type if exists type_document_enum cascade;
drop type if exists statut_document_enum cascade;
drop type if exists type_notification_enum cascade;
drop type if exists canal_notification_enum cascade;
drop type if exists statut_notification_enum cascade;
drop type if exists statut_credit_enum cascade;

-- ============================================================
-- ENUMS
-- ============================================================

create type type_profil_enum       as enum ('local', 'diaspora');
create type statut_kyc_enum        as enum ('non_soumis', 'en_attente', 'valide', 'refuse');
create type statut_terrain_enum    as enum ('dispo', 'reserve', 'en_cours', 'vendu');
create type statut_contrat_enum    as enum ('actif', 'resilie', 'solde');
create type type_paiement_enum     as enum ('acompte', 'mensualite');
create type statut_paiement_enum   as enum ('a_venir', 'paye', 'en_retard');
create type moyen_paiement_enum    as enum ('mobile_money', 'carte', 'virement');
create type operateur_enum         as enum ('orange', 'mtn', 'moov', 'wave', 'autre');
create type type_document_enum     as enum ('provisoire', 'acd', 'autre');
create type statut_document_enum   as enum ('actif', 'revoque');
create type type_notification_enum as enum (
  'paiement_recu', 'relance', 'resiliation',
  'kyc_valide', 'kyc_refuse',
  'titre_disponible', 'reservation_expiree',
  'contrat_signe', 'bienvenue'
);
create type canal_notification_enum    as enum ('sms', 'email', 'app');
create type statut_notification_enum   as enum ('envoye', 'echoue', 'en_attente');
create type statut_credit_enum         as enum ('actif', 'epuise');

-- ============================================================
-- TABLE : profils
-- ============================================================
-- Extension de auth.users Supabase.
-- Créé automatiquement via trigger lors de l'inscription.

create table profils (
  id                uuid primary key references auth.users(id) on delete cascade,
  nom_complet       text not null,
  email             text not null,
  telephone         text,
  pays_residence    text,
  type_profil       type_profil_enum not null default 'local',
  statut_kyc        statut_kyc_enum  not null default 'non_soumis',
  is_admin          boolean not null default false,
  is_super_admin    boolean not null default false,
  derniere_connexion timestamptz,
  created_at        timestamptz not null default now()
);

comment on table profils is 'Profils utilisateurs — miroir de auth.users avec données métier';

-- ============================================================
-- TABLE : terrains
-- ============================================================

create table terrains (
  id               uuid primary key default gen_random_uuid(),
  reference        text not null unique,           -- ex: KL-2024-001
  nom              text not null,
  description      text,
  localisation     text not null,
  pays             text not null,
  superficie       numeric(12,2) not null,          -- en m²
  prix_fcfa        bigint not null,                  -- prix en FCFA
  acompte_pct      integer not null default 20
                   check (acompte_pct between 20 and 30),
  duree_mois       integer not null default 24
                   check (duree_mois between 1 and 36),
  statut           statut_terrain_enum not null default 'dispo',
  statut_juridique text,                             -- ex: "Titre foncier", "ACD"
  titre_foncier    boolean not null default false,
  images           text[] not null default '{}',     -- URLs Supabase Storage
  video_url        text,
  latitude         numeric(10,7),
  longitude        numeric(10,7),
  admin_id         uuid references profils(id),      -- admin créateur
  date_reservation timestamptz,                      -- pour expiration 7 jours
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table terrains is 'Catalogue des terrains disponibles à la vente';
comment on column terrains.acompte_pct is 'Pourcentage acompte fixé par admin (20-30%)';
comment on column terrains.duree_mois  is 'Durée max échelonnement fixée par admin (1-36 mois)';

-- ============================================================
-- TABLE : kyc
-- ============================================================

create table kyc (
  id               uuid primary key default gen_random_uuid(),
  profil_id        uuid not null references profils(id) on delete cascade,
  document_type    text not null check (document_type in ('cni', 'passeport')),
  document_url     text not null,                    -- URL Supabase Storage (bucket sécurisé)
  document_url2    text,                             -- verso CNI si besoin
  statut           statut_kyc_enum not null default 'en_attente',
  motif_refus      text,
  admin_id         uuid references profils(id),      -- admin validateur
  date_soumission  timestamptz not null default now(),
  date_decision    timestamptz,
  created_at       timestamptz not null default now()
);

comment on table kyc is 'Documents KYC soumis par les clients pour validation';
comment on column kyc.document_url is 'Stocké dans bucket kyc-documents (accès restreint)';

-- ============================================================
-- TABLE : contrats
-- ============================================================

create table contrats (
  id                  uuid primary key default gen_random_uuid(),
  profil_id           uuid not null references profils(id),
  terrain_id          uuid not null references terrains(id),
  prix_total          bigint not null,               -- FCFA au moment de la signature
  acompte_verse       bigint not null,               -- montant acompte payé
  duree_mois          integer not null check (duree_mois between 1 and 36),
  mensualite_montant  bigint not null,               -- (prix_total - acompte) / duree_mois
  jour_prelevement    integer not null check (jour_prelevement between 1 and 28),
  statut              statut_contrat_enum not null default 'actif',
  date_signature      timestamptz not null default now(),
  date_fin_prevue     date not null,
  -- Résiliation
  date_resiliation    timestamptz,
  option_resiliation  text check (option_resiliation in ('remboursement', 'credit')),
  date_limite_choix   date,                          -- 30 jours après résiliation
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table contrats is 'Contrats de vente signés entre clients et KLô';
comment on column contrats.mensualite_montant is '(prix_total - acompte_verse) / duree_mois — calculé à la signature';
comment on column contrats.jour_prelevement   is 'Jour du mois fixé à la signature, invariable';

-- ============================================================
-- TABLE : paiements
-- ============================================================

create table paiements (
  id                    uuid primary key default gen_random_uuid(),
  contrat_id            uuid not null references contrats(id),
  type                  type_paiement_enum not null,
  montant               bigint not null,             -- FCFA
  statut                statut_paiement_enum not null default 'a_venir',
  moyen                 moyen_paiement_enum,
  operateur             operateur_enum,
  ref_transaction_api   text,                        -- ID retourné par CinetPay/Paydunya
  date_echeance         date not null,
  date_paiement         timestamptz,
  numero_relance        integer not null default 0
                        check (numero_relance between 0 and 2),
  date_derniere_relance timestamptz,
  created_at            timestamptz not null default now()
);

comment on table paiements is 'Paiements acomptes et mensualités des contrats';
comment on column paiements.ref_transaction_api is 'Obligatoire pour tout paiement reçu (traçabilité)';

-- ============================================================
-- TABLE : documents
-- ============================================================

create table documents (
  id               uuid primary key default gen_random_uuid(),
  contrat_id       uuid not null references contrats(id),
  type             type_document_enum not null,
  numero_unique    text not null unique default encode(gen_random_bytes(8), 'hex'),
  qr_code_hash     text not null default encode(gen_random_bytes(16), 'hex'),
  url_fichier      text,                             -- URL Supabase Storage
  statut           statut_document_enum not null default 'actif',
  visible_client   boolean not null default true,
  genere_par       uuid not null references profils(id),
  date_generation  timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

comment on table documents is 'Documents générés (provisoire à la signature, ACD au solde)';
comment on column documents.numero_unique is 'Hash aléatoire — jamais séquentiel (sécurité)';
comment on column documents.qr_code_hash  is 'Hash pour portail de vérification public';

-- ============================================================
-- TABLE : notifications
-- ============================================================

create table notifications (
  id            uuid primary key default gen_random_uuid(),
  profil_id     uuid not null references profils(id),
  contrat_id    uuid references contrats(id),
  type          type_notification_enum not null,
  canal         canal_notification_enum not null,
  message       text not null,
  statut        statut_notification_enum not null default 'en_attente',
  lu            boolean not null default false,
  date_envoi    timestamptz,
  created_at    timestamptz not null default now()
);

comment on table notifications is 'Notifications envoyées aux clients (SMS, email, in-app)';

-- ============================================================
-- TABLE : credits
-- ============================================================

create table credits (
  id                  uuid primary key default gen_random_uuid(),
  profil_id           uuid not null references profils(id),
  contrat_origine_id  uuid not null references contrats(id),
  montant_total       bigint not null,
  montant_utilise     bigint not null default 0,
  montant_restant     bigint not null,
  statut              statut_credit_enum not null default 'actif',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table credits is 'Crédits issus des résiliations (Option B) — sans expiration';

-- ============================================================
-- TABLE : journal_audit
-- ============================================================

create table journal_audit (
  id                 uuid primary key default gen_random_uuid(),
  admin_id           uuid not null references profils(id),
  action             text not null,
  entite_concernee   text not null,                  -- nom de la table
  entite_id          uuid not null,
  motif              text not null,                  -- obligatoire pour super admin
  donnees_avant      jsonb,
  donnees_apres      jsonb,
  created_at         timestamptz not null default now()
);

comment on table journal_audit is 'Journal immuable des actions super admin — pour audit';

-- ============================================================
-- INDEX (performances)
-- ============================================================

create index idx_terrains_statut      on terrains(statut);
create index idx_terrains_pays        on terrains(pays);
create index idx_contrats_profil      on contrats(profil_id);
create index idx_contrats_terrain     on contrats(terrain_id);
create index idx_contrats_statut      on contrats(statut);
create index idx_paiements_contrat    on paiements(contrat_id);
create index idx_paiements_statut     on paiements(statut);
create index idx_paiements_echeance   on paiements(date_echeance);
create index idx_notifications_profil on notifications(profil_id);
create index idx_notifications_lu     on notifications(profil_id, lu);
create index idx_kyc_profil           on kyc(profil_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- 1. Créer un profil automatiquement à l'inscription
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profils (id, nom_complet, email, type_profil)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nom_complet', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'type_profil')::type_profil_enum, 'local')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- 2. Mettre à jour updated_at automatiquement
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_terrains_updated_at
  before update on terrains
  for each row execute procedure set_updated_at();

create trigger trg_contrats_updated_at
  before update on contrats
  for each row execute procedure set_updated_at();

create trigger trg_credits_updated_at
  before update on credits
  for each row execute procedure set_updated_at();

-- 3. Mettre à jour statut_kyc dans profils quand KYC change
create or replace function sync_statut_kyc()
returns trigger language plpgsql security definer as $$
begin
  update profils
  set statut_kyc = new.statut
  where id = new.profil_id;
  return new;
end;
$$;

create trigger trg_kyc_sync
  after insert or update on kyc
  for each row execute procedure sync_statut_kyc();

-- 4. Libérer un terrain si réservation expire (appelé par cron ou API)
create or replace function liberer_terrain_expire()
returns void language plpgsql security definer as $$
begin
  update terrains
  set statut = 'dispo', date_reservation = null
  where statut = 'reserve'
    and date_reservation is not null
    and date_reservation < now() - interval '7 days';
end;
$$;

-- 5. Mettre à jour montant_restant dans credits
create or replace function sync_credit_restant()
returns trigger language plpgsql as $$
begin
  new.montant_restant = new.montant_total - new.montant_utilise;
  if new.montant_restant <= 0 then
    new.statut = 'epuise';
  end if;
  return new;
end;
$$;

create trigger trg_credits_restant
  before update on credits
  for each row execute procedure sync_credit_restant();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table profils       enable row level security;
alter table terrains      enable row level security;
alter table kyc           enable row level security;
alter table contrats      enable row level security;
alter table paiements     enable row level security;
alter table documents     enable row level security;
alter table notifications enable row level security;
alter table credits       enable row level security;
alter table journal_audit enable row level security;

-- ── profils ──────────────────────────────────────────────────
-- Chaque utilisateur voit et modifie uniquement son profil
create policy "profil_select_own"
  on profils for select
  using (auth.uid() = id);

create policy "profil_update_own"
  on profils for update
  using (auth.uid() = id);

-- Les admins voient tous les profils
create policy "profil_select_admin"
  on profils for select
  using (exists (
    select 1 from profils p
    where p.id = auth.uid() and p.is_admin = true
  ));

-- ── terrains ─────────────────────────────────────────────────
-- Tout le monde voit les terrains disponibles et réservés (pas les vendus)
create policy "terrains_select_public"
  on terrains for select
  using (statut != 'vendu');

-- Admins voient tout et peuvent modifier
create policy "terrains_all_admin"
  on terrains for all
  using (exists (
    select 1 from profils p
    where p.id = auth.uid() and p.is_admin = true
  ));

-- ── kyc ──────────────────────────────────────────────────────
-- Client voit uniquement ses propres documents KYC
create policy "kyc_select_own"
  on kyc for select
  using (profil_id = auth.uid());

create policy "kyc_insert_own"
  on kyc for insert
  with check (profil_id = auth.uid());

-- Admin voit et modifie tous les KYC
create policy "kyc_all_admin"
  on kyc for all
  using (exists (
    select 1 from profils p
    where p.id = auth.uid() and p.is_admin = true
  ));

-- ── contrats ─────────────────────────────────────────────────
-- Client voit uniquement ses contrats
create policy "contrats_select_own"
  on contrats for select
  using (profil_id = auth.uid());

-- Admin voit et gère tous les contrats
create policy "contrats_all_admin"
  on contrats for all
  using (exists (
    select 1 from profils p
    where p.id = auth.uid() and p.is_admin = true
  ));

-- ── paiements ────────────────────────────────────────────────
-- Client voit uniquement ses paiements (via contrats)
create policy "paiements_select_own"
  on paiements for select
  using (exists (
    select 1 from contrats c
    where c.id = paiements.contrat_id and c.profil_id = auth.uid()
  ));

-- Admin voit et gère tous les paiements
create policy "paiements_all_admin"
  on paiements for all
  using (exists (
    select 1 from profils p
    where p.id = auth.uid() and p.is_admin = true
  ));

-- ── documents ────────────────────────────────────────────────
-- Client voit ses documents marqués visible_client = true
create policy "documents_select_own"
  on documents for select
  using (
    visible_client = true
    and exists (
      select 1 from contrats c
      where c.id = documents.contrat_id and c.profil_id = auth.uid()
    )
  );

-- Admin voit et gère tous les documents
create policy "documents_all_admin"
  on documents for all
  using (exists (
    select 1 from profils p
    where p.id = auth.uid() and p.is_admin = true
  ));

-- ── notifications ─────────────────────────────────────────────
-- Client voit uniquement ses notifications
create policy "notifications_select_own"
  on notifications for select
  using (profil_id = auth.uid());

create policy "notifications_update_own"
  on notifications for update
  using (profil_id = auth.uid());

-- Admin voit et gère toutes les notifications
create policy "notifications_all_admin"
  on notifications for all
  using (exists (
    select 1 from profils p
    where p.id = auth.uid() and p.is_admin = true
  ));

-- ── credits ──────────────────────────────────────────────────
-- Client voit uniquement ses crédits
create policy "credits_select_own"
  on credits for select
  using (profil_id = auth.uid());

-- Admin voit et gère tous les crédits
create policy "credits_all_admin"
  on credits for all
  using (exists (
    select 1 from profils p
    where p.id = auth.uid() and p.is_admin = true
  ));

-- ── journal_audit ─────────────────────────────────────────────
-- Super admin uniquement — en lecture seule pour admin standard
create policy "journal_select_admin"
  on journal_audit for select
  using (exists (
    select 1 from profils p
    where p.id = auth.uid() and p.is_admin = true
  ));

create policy "journal_insert_superadmin"
  on journal_audit for insert
  with check (exists (
    select 1 from profils p
    where p.id = auth.uid() and p.is_super_admin = true
  ));

-- ============================================================
-- STORAGE BUCKETS (à créer dans Supabase Dashboard)
-- ============================================================
-- Bucket 1 : terrain-media
--   - Public: OUI
--   - Dossiers: images/, videos/
--   - Qui peut uploader: admins uniquement
--
-- Bucket 2 : kyc-documents
--   - Public: NON (accès restreint)
--   - Qui peut uploader: le client lui-même (son dossier)
--   - Qui peut lire: admin uniquement
--
-- Bucket 3 : contrat-documents
--   - Public: NON
--   - Qui peut lire: le client propriétaire du contrat + admin

-- ============================================================
-- DONNÉES INITIALES (Mode demo → à supprimer en production)
-- ============================================================

-- Note : Les données de démonstration sont gérées côté frontend
-- via MOCK_TERRAINS dans lib/supabase.ts.
-- En production, saisir les terrains depuis le dashboard admin.

-- ============================================================
-- VUES UTILES (optionnel)
-- ============================================================

-- Vue : tableau de bord admin — contrats actifs avec infos client
create or replace view v_contrats_actifs as
select
  c.id,
  c.statut,
  c.prix_total,
  c.acompte_verse,
  c.mensualite_montant,
  c.duree_mois,
  c.jour_prelevement,
  c.date_signature,
  c.date_fin_prevue,
  p.nom_complet,
  p.email,
  p.telephone,
  p.statut_kyc,
  t.nom         as terrain_nom,
  t.localisation,
  t.pays,
  t.reference   as terrain_ref
from contrats c
join profils p  on p.id = c.profil_id
join terrains t on t.id = c.terrain_id
where c.statut = 'actif';

-- Vue : paiements en retard
create or replace view v_paiements_retard as
select
  pay.id,
  pay.montant,
  pay.date_echeance,
  pay.numero_relance,
  p.nom_complet,
  p.email,
  p.telephone,
  t.nom as terrain_nom,
  t.reference
from paiements pay
join contrats c on c.id = pay.contrat_id
join profils p  on p.id = c.profil_id
join terrains t on t.id = c.terrain_id
where pay.statut = 'en_retard'
order by pay.date_echeance asc;

-- ============================================================
-- FIN DU SCHÉMA
-- ============================================================
