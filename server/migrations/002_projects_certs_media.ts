import type { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import type { Migration } from './types.js';

export const DOMAIN_SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS media_assets (
  id                 TEXT PRIMARY KEY,
  original_filename  TEXT NOT NULL,
  stored_filename    TEXT UNIQUE NOT NULL,
  storage_provider   TEXT NOT NULL DEFAULT 'local' 
                     CHECK (storage_provider IN ('local', 's3', 'gcs')),
  storage_path       TEXT NOT NULL,
  public_url         TEXT,
  visibility         TEXT NOT NULL DEFAULT 'public' 
                     CHECK (visibility IN ('public', 'private')),
  mime_type          TEXT NOT NULL,
  file_size          INTEGER NOT NULL 
                     CHECK (file_size > 0),
  width              INTEGER,
  height             INTEGER,
  sha256             TEXT NOT NULL,
  alt_text           TEXT NOT NULL DEFAULT '',
  uploaded_by        TEXT NOT NULL,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  CHECK ((width IS NULL AND height IS NULL) OR (width > 0 AND height > 0)),
  CHECK ((visibility = 'public' AND public_url IS NOT NULL AND length(trim(public_url)) > 0) OR (visibility = 'private' AND public_url IS NULL)),
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS projects (
  id                  TEXT PRIMARY KEY,
  slug                TEXT UNIQUE NOT NULL,
  title               TEXT NOT NULL,
  subtitle            TEXT NOT NULL DEFAULT '',
  discipline          TEXT NOT NULL,
  client_type         TEXT NOT NULL DEFAULT 'PRIVATE_COLLECTOR' 
                      CHECK (client_type IN ('PRIVATE_COLLECTOR', 'RESIDENTIAL', 'COMMERCIAL', 'INSTITUTIONAL')),
  client_name         TEXT,
  description         TEXT NOT NULL DEFAULT '',
  challenge           TEXT NOT NULL DEFAULT '',
  solution            TEXT NOT NULL DEFAULT '',
  materials           TEXT NOT NULL DEFAULT '[]',
  location            TEXT NOT NULL DEFAULT '',
  completion_date     TEXT,
  cover_media_id      TEXT,
  cover_image_url     TEXT NOT NULL DEFAULT '',
  publication_status  TEXT NOT NULL DEFAULT 'DRAFT' 
                      CHECK (publication_status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  is_featured         INTEGER NOT NULL DEFAULT 0 
                      CHECK (is_featured IN (0, 1)),
  sort_order          INTEGER NOT NULL DEFAULT 0 
                      CHECK (sort_order >= 0),
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  FOREIGN KEY (cover_media_id) REFERENCES media_assets(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS certifications (
  id                      TEXT PRIMARY KEY,
  slug                    TEXT UNIQUE NOT NULL,
  title                   TEXT NOT NULL,
  issuing_organization    TEXT NOT NULL,
  credential_id           TEXT NOT NULL DEFAULT '',
  credential_url          TEXT,
  issue_date              TEXT NOT NULL,
  expiration_date         TEXT,
  applicable_disciplines  TEXT NOT NULL DEFAULT '[]',
  skills_standards        TEXT NOT NULL DEFAULT '',
  badge_media_id          TEXT,
  badge_image_url         TEXT NOT NULL DEFAULT '',
  publication_status      TEXT NOT NULL DEFAULT 'DRAFT' 
                          CHECK (publication_status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  verification_status     TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION' 
                          CHECK (verification_status IN ('PENDING_VERIFICATION', 'VERIFIED', 'EXPIRED', 'REVOKED')),
  verification_notes      TEXT NOT NULL DEFAULT '',
  verified_at             TEXT,
  verified_by             TEXT,
  sort_order              INTEGER NOT NULL DEFAULT 0 
                          CHECK (sort_order >= 0),
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  FOREIGN KEY (badge_media_id) REFERENCES media_assets(id) ON DELETE RESTRICT,
  FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS project_media (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL,
  media_asset_id  TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'GALLERY' 
                  CHECK (role IN ('COVER', 'GALLERY', 'DIAGRAM', 'BEFORE_AFTER_BEFORE', 'BEFORE_AFTER_AFTER', 'BLUEPRINT', 'INSTALLATION')),
  sort_order      INTEGER NOT NULL DEFAULT 0 
                  CHECK (sort_order >= 0),
  caption         TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (media_asset_id) REFERENCES media_assets(id) ON DELETE RESTRICT,
  UNIQUE(project_id, media_asset_id, role)
);

CREATE TABLE IF NOT EXISTS certification_media (
  id                TEXT PRIMARY KEY,
  certification_id  TEXT NOT NULL,
  media_asset_id    TEXT NOT NULL,
  role              TEXT NOT NULL DEFAULT 'EVIDENCE_DOCUMENT' 
                    CHECK (role IN ('BADGE', 'CERTIFICATE_SCAN', 'TEST_REPORT', 'EVIDENCE_DOCUMENT', 'AUDIT_REPORT')),
  sort_order        INTEGER NOT NULL DEFAULT 0 
                    CHECK (sort_order >= 0),
  caption           TEXT NOT NULL DEFAULT '',
  created_at        TEXT NOT NULL,
  FOREIGN KEY (certification_id) REFERENCES certifications(id) ON DELETE CASCADE,
  FOREIGN KEY (media_asset_id) REFERENCES media_assets(id) ON DELETE RESTRICT,
  UNIQUE(certification_id, media_asset_id, role)
);

-- Purpose-built composite indexes
CREATE INDEX IF NOT EXISTS idx_projects_pub_featured_sort 
  ON projects(publication_status, is_featured, sort_order);
CREATE INDEX IF NOT EXISTS idx_projects_discipline 
  ON projects(discipline);

CREATE INDEX IF NOT EXISTS idx_certifications_pub_verif 
  ON certifications(publication_status, verification_status, sort_order);

CREATE INDEX IF NOT EXISTS idx_media_assets_hash_vis 
  ON media_assets(sha256, visibility);
CREATE INDEX IF NOT EXISTS idx_media_assets_uploader 
  ON media_assets(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_project_media_proj 
  ON project_media(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_project_media_asset 
  ON project_media(media_asset_id);
CREATE INDEX IF NOT EXISTS idx_cert_media_cert 
  ON certification_media(certification_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_cert_media_asset 
  ON certification_media(media_asset_id);

-- Secondary performance indexes for existing commerce tables
CREATE INDEX IF NOT EXISTS idx_products_category 
  ON products(category_id, status);
CREATE INDEX IF NOT EXISTS idx_products_status_featured 
  ON products(status, is_featured);
CREATE INDEX IF NOT EXISTS idx_orders_user 
  ON orders(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order 
  ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product 
  ON reviews(product_id, is_approved);
`;

export const DOMAIN_SCHEMA_CHECKSUM = crypto
  .createHash('sha256')
  .update(DOMAIN_SCHEMA_DDL.trim())
  .digest('hex');

/**
 * Migration 002: Provision domain tables (media_assets, projects, certifications, junction tables, indexes).
 */
export const migration002: Migration = {
  version: 2,
  name: '002_projects_certs_media',
  checksum: DOMAIN_SCHEMA_CHECKSUM,
  up(db: DatabaseSync) {
    db.exec(DOMAIN_SCHEMA_DDL);
  },
};
