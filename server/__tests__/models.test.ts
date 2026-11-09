import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../migrations/runner.js';
import {
  CreateProjectSchema,
  CreateCertificationSchema,
  AdminVerifyCertificationSchema,
  CreateMediaAssetSchema,
} from '../schemas.js';
import { mockMediaAssets, mockProjects, mockCertifications } from './fixtures/domainFixtures.js';

describe('Domain Models, Schema Constraints & Referential Integrity', () => {
  let db: DatabaseSync;

  beforeEach(async () => {
    db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    await runMigrations(db);

    // Seed a prerequisite user for foreign key references
    db.exec(`
      INSERT INTO users (id, email, name, role, created_at)
      VALUES ('user_admin_01', 'admin@nexora.com', 'Admin User', 'ADMIN', '2026-01-01T00:00:00Z');
    `);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // Ignore close error
    }
  });

  describe('Media Assets Constraints', () => {
    it('1. Inserts valid public media asset successfully', () => {
      const asset = mockMediaAssets[0];
      expect(() => {
        db.prepare(`
          INSERT INTO media_assets (
            id, original_filename, stored_filename, storage_provider, storage_path,
            public_url, visibility, mime_type, file_size, width, height, sha256,
            alt_text, uploaded_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `).run(
          asset.id,
          asset.originalFilename,
          asset.storedFilename,
          asset.storageProvider,
          asset.storagePath,
          asset.publicUrl,
          asset.visibility,
          asset.mimeType,
          asset.fileSize,
          asset.width,
          asset.height,
          asset.sha256,
          asset.altText,
          asset.uploadedBy,
          asset.createdAt,
          asset.updatedAt
        );
      }).not.toThrow();

      const stored = db.prepare('SELECT * FROM media_assets WHERE id = ?;').get(asset.id) as any;
      expect(stored).toBeDefined();
      expect(stored.public_url).toBe(asset.publicUrl);
    });

    it('2. Inserts valid private media asset with NULL public_url', () => {
      const asset = mockMediaAssets[2];
      expect(() => {
        db.prepare(`
          INSERT INTO media_assets (
            id, original_filename, stored_filename, storage_provider, storage_path,
            public_url, visibility, mime_type, file_size, width, height, sha256,
            alt_text, uploaded_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `).run(
          asset.id,
          asset.originalFilename,
          asset.storedFilename,
          asset.storageProvider,
          asset.storagePath,
          asset.publicUrl,
          asset.visibility,
          asset.mimeType,
          asset.fileSize,
          asset.width,
          asset.height,
          asset.sha256,
          asset.altText,
          asset.uploadedBy,
          asset.createdAt,
          asset.updatedAt
        );
      }).not.toThrow();

      const stored = db.prepare('SELECT * FROM media_assets WHERE id = ?;').get(asset.id) as any;
      expect(stored).toBeDefined();
      expect(stored.visibility).toBe('private');
      expect(stored.public_url).toBeNull();
    });

    it('3. Rejects public media asset with NULL public_url via CHECK constraint', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO media_assets (
            id, original_filename, stored_filename, storage_provider, storage_path,
            public_url, visibility, mime_type, file_size, sha256, uploaded_by, created_at, updated_at
          ) VALUES ('m_bad_pub', 'a.jpg', 'stored_bad_pub.jpg', 'local', '/p', NULL, 'public', 'image/jpeg', 100, 'hash', 'user_admin_01', '2026', '2026');
        `).run();
      }).toThrow(/CHECK constraint failed/);
    });

    it('4. Rejects private media asset with non-NULL public_url via CHECK constraint', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO media_assets (
            id, original_filename, stored_filename, storage_provider, storage_path,
            public_url, visibility, mime_type, file_size, sha256, uploaded_by, created_at, updated_at
          ) VALUES ('m_bad_priv', 'a.pdf', 'stored_bad_priv.pdf', 'local', '/p', '/public/url.pdf', 'private', 'application/pdf', 100, 'hash', 'user_admin_01', '2026', '2026');
        `).run();
      }).toThrow(/CHECK constraint failed/);
    });

    it('5. Rejects non-positive file_size via CHECK constraint', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO media_assets (
            id, original_filename, stored_filename, storage_provider, storage_path,
            public_url, visibility, mime_type, file_size, sha256, uploaded_by, created_at, updated_at
          ) VALUES ('m_zero_sz', 'a.jpg', 'stored_zero.jpg', 'local', '/p', '/a.jpg', 'public', 'image/jpeg', 0, 'hash', 'user_admin_01', '2026', '2026');
        `).run();
      }).toThrow(/CHECK constraint failed/);
    });

    it('6. Rejects invalid dimensions (e.g. width <= 0 or height <= 0) via CHECK constraint', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO media_assets (
            id, original_filename, stored_filename, storage_provider, storage_path,
            public_url, visibility, mime_type, file_size, width, height, sha256, uploaded_by, created_at, updated_at
          ) VALUES ('m_bad_dim', 'a.jpg', 'stored_bad_dim.jpg', 'local', '/p', '/a.jpg', 'public', 'image/jpeg', 100, -10, 100, 'hash', 'user_admin_01', '2026', '2026');
        `).run();
      }).toThrow(/CHECK constraint failed/);
    });

    it('7. Rejects invalid storage_provider via CHECK constraint', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO media_assets (
            id, original_filename, stored_filename, storage_provider, storage_path,
            public_url, visibility, mime_type, file_size, sha256, uploaded_by, created_at, updated_at
          ) VALUES ('m_bad_prov', 'a.jpg', 'stored_bad_prov.jpg', 'dropbox_unsupported', '/p', '/a.jpg', 'public', 'image/jpeg', 100, 'hash', 'user_admin_01', '2026', '2026');
        `).run();
      }).toThrow(/CHECK constraint failed/);
    });

    it('8. Rejects media asset with nonexistent uploaded_by user via FOREIGN KEY constraint', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO media_assets (
            id, original_filename, stored_filename, storage_provider, storage_path,
            public_url, visibility, mime_type, file_size, sha256, uploaded_by, created_at, updated_at
          ) VALUES ('m_bad_user', 'a.jpg', 'stored_bad_user.jpg', 'local', '/p', '/a.jpg', 'public', 'image/jpeg', 100, 'hash', 'nonexistent_user_id', '2026', '2026');
        `).run();
      }).toThrow(/FOREIGN KEY constraint failed/);
    });
  });

  describe('Projects Constraints & Junctions', () => {
    beforeEach(() => {
      // Seed prerequisite media asset
      const asset = mockMediaAssets[0];
      db.prepare(`
        INSERT INTO media_assets (
          id, original_filename, stored_filename, storage_provider, storage_path,
          public_url, visibility, mime_type, file_size, sha256, uploaded_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `).run(
        asset.id, asset.originalFilename, asset.storedFilename, asset.storageProvider,
        asset.storagePath, asset.publicUrl, asset.visibility, asset.mimeType, asset.fileSize,
        asset.sha256, asset.uploadedBy, asset.createdAt, asset.updatedAt
      );
    });

    it('1. Rejects duplicate project slug via UNIQUE constraint', () => {
      const p = mockProjects[0];
      db.prepare(`
        INSERT INTO projects (
          id, slug, title, discipline, cover_media_id, publication_status, created_at, updated_at
        ) VALUES ('p1', ?, ?, ?, ?, ?, ?, ?);
      `).run(p.slug, p.title, p.discipline, p.coverMediaId, p.publicationStatus, p.createdAt, p.updatedAt);

      expect(() => {
        db.prepare(`
          INSERT INTO projects (
            id, slug, title, discipline, cover_media_id, publication_status, created_at, updated_at
          ) VALUES ('p2', ?, ?, ?, ?, ?, ?, ?);
        `).run(p.slug, 'Different Title', p.discipline, p.coverMediaId, p.publicationStatus, p.createdAt, p.updatedAt);
      }).toThrow(/UNIQUE constraint failed/);
    });

    it('2. Rejects invalid publication_status via CHECK constraint', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO projects (
            id, slug, title, discipline, publication_status, created_at, updated_at
          ) VALUES ('p_bad_pub', 'slug-bad', 'Title', 'Discipline', 'INVALID_STATUS', '2026', '2026');
        `).run();
      }).toThrow(/CHECK constraint failed/);
    });

    it('3. Rejects invalid client_type via CHECK constraint', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO projects (
            id, slug, title, discipline, client_type, created_at, updated_at
          ) VALUES ('p_bad_client', 'slug-client', 'Title', 'Discipline', 'UNSUPPORTED_TYPE', '2026', '2026');
        `).run();
      }).toThrow(/CHECK constraint failed/);
    });

    it('4. Rejects invalid project_media role via CHECK constraint', () => {
      const p = mockProjects[0];
      db.prepare(`
        INSERT INTO projects (id, slug, title, discipline, created_at, updated_at)
        VALUES ('p_junction_test', 'proj-junc', 'T', 'D', '2026', '2026');
      `).run();

      expect(() => {
        db.prepare(`
          INSERT INTO project_media (id, project_id, media_asset_id, role, created_at)
          VALUES ('pm_bad_role', 'p_junction_test', ?, 'UNAUTHORIZED_ROLE', '2026');
        `).run(mockMediaAssets[0].id);
      }).toThrow(/CHECK constraint failed/);
    });

    it('5. Prevents deletion of media asset referenced by project cover_media_id (RESTRICT)', () => {
      const asset = mockMediaAssets[0];
      db.prepare(`
        INSERT INTO projects (id, slug, title, discipline, cover_media_id, created_at, updated_at)
        VALUES ('proj_ref_test', 'proj-ref', 'T', 'D', ?, '2026', '2026');
      `).run(asset.id);

      expect(() => {
        db.prepare('DELETE FROM media_assets WHERE id = ?;').run(asset.id);
      }).toThrow(/FOREIGN KEY constraint failed/);
    });

    it('6. Cascades delete on project removal to project_media junction while preserving underlying media asset', () => {
      const asset = mockMediaAssets[0];
      db.prepare(`
        INSERT INTO projects (id, slug, title, discipline, created_at, updated_at)
        VALUES ('proj_cascade_test', 'proj-casc', 'T', 'D', '2026', '2026');
      `).run();

      db.prepare(`
        INSERT INTO project_media (id, project_id, media_asset_id, role, created_at)
        VALUES ('pm_casc_1', 'proj_cascade_test', ?, 'GALLERY', '2026');
      `).run(asset.id);

      // Verify junction exists
      expect(db.prepare("SELECT * FROM project_media WHERE id = 'pm_casc_1';").get()).toBeDefined();

      // Delete parent project
      db.prepare("DELETE FROM projects WHERE id = 'proj_cascade_test';").run();

      // Junction is cascaded (removed)
      expect(db.prepare("SELECT * FROM project_media WHERE id = 'pm_casc_1';").get()).toBeUndefined();

      // Media asset is preserved!
      expect(db.prepare('SELECT * FROM media_assets WHERE id = ?;').get(asset.id)).toBeDefined();
    });
  });

  describe('Certifications Constraints & Expiration Semantics', () => {
    it('1. Rejects duplicate certification slug via UNIQUE constraint', () => {
      const c = mockCertifications[0];
      db.prepare(`
        INSERT INTO certifications (
          id, slug, title, issuing_organization, issue_date, publication_status, verification_status, created_at, updated_at
        ) VALUES ('c1', ?, ?, ?, ?, ?, ?, ?, ?);
      `).run(c.slug, c.title, c.issuingOrganization, c.issueDate, c.publicationStatus, c.verificationStatus, c.createdAt, c.updatedAt);

      expect(() => {
        db.prepare(`
          INSERT INTO certifications (
            id, slug, title, issuing_organization, issue_date, publication_status, verification_status, created_at, updated_at
          ) VALUES ('c2', ?, ?, ?, ?, ?, ?, ?, ?);
        `).run(c.slug, 'Other Title', c.issuingOrganization, c.issueDate, c.publicationStatus, c.verificationStatus, c.createdAt, c.updatedAt);
      }).toThrow(/UNIQUE constraint failed/);
    });

    it('2. Rejects invalid verification_status via CHECK constraint', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO certifications (
            id, slug, title, issuing_organization, issue_date, verification_status, created_at, updated_at
          ) VALUES ('c_bad_ver', 'bad-ver', 'T', 'O', '2026-01-01', 'FAKE_VERIFIED_STATE', '2026', '2026');
        `).run();
      }).toThrow(/CHECK constraint failed/);
    });

    it('3. Computes effective expiration dynamically for elapsed credentials', () => {
      const cActive = mockCertifications[0];
      const cExpired = mockCertifications[1];

      // Active credential (expires in 2027)
      (db.prepare(`
        INSERT INTO certifications (
          id, slug, title, issuing_organization, issue_date, expiration_date, verification_status, created_at, updated_at
        ) VALUES ('c_act', ?, ?, ?, ?, ?, ?, ?, ?);
      `) as any).run(
        cActive.slug, cActive.title, cActive.issuingOrganization, cActive.issueDate,
        cActive.expirationDate ?? null, cActive.verificationStatus, cActive.createdAt, cActive.updatedAt
      );

      // Expired credential (expired in 2023)
      (db.prepare(`
        INSERT INTO certifications (
          id, slug, title, issuing_organization, issue_date, expiration_date, verification_status, created_at, updated_at
        ) VALUES ('c_exp', ?, ?, ?, ?, ?, ?, ?, ?);
      `) as any).run(
        cExpired.slug, cExpired.title, cExpired.issuingOrganization, cExpired.issueDate,
        cExpired.expirationDate ?? null, cExpired.verificationStatus, cExpired.createdAt, cExpired.updatedAt
      );

      // Query using canonical dynamic effective verification expression
      const rows = db.prepare(`
        SELECT id, verification_status, expiration_date,
        CASE 
          WHEN verification_status != 'REVOKED' 
               AND expiration_date IS NOT NULL 
               AND expiration_date < date('now') 
          THEN 'EXPIRED' 
          ELSE verification_status 
        END AS effective_verification_status
        FROM certifications ORDER BY id ASC;
      `).all() as any[];

      const activeRow = rows.find((r) => r.id === 'c_act');
      expect(activeRow.effective_verification_status).toBe('VERIFIED');

      const expiredRow = rows.find((r) => r.id === 'c_exp');
      expect(expiredRow.verification_status).toBe('VERIFIED'); // persisted admin verification state
      expect(expiredRow.effective_verification_status).toBe('EXPIRED'); // dynamically evaluated effective state
    });
  });

  describe('Zod Validation Contracts', () => {
    it('1. CreateProjectSchema validates valid project data', () => {
      const valid = {
        slug: 'modern-chronos-gallery',
        title: 'Modern Chronos Gallery',
        discipline: 'Architectural Horology',
        clientType: 'PRIVATE_COLLECTOR' as const,
        materials: ['Solid Walnut', 'Titanium Grade 5'],
        isFeatured: true,
      };
      const parsed = CreateProjectSchema.parse(valid);
      expect(parsed.slug).toBe('modern-chronos-gallery');
      expect(parsed.publicationStatus).toBe('DRAFT'); // Default
    });

    it('2. CreateProjectSchema rejects invalid slugs with uppercase or special characters', () => {
      const invalid = {
        slug: 'Invalid Slug!',
        title: 'Title',
        discipline: 'Discipline',
      };
      expect(() => CreateProjectSchema.parse(invalid)).toThrow();
    });

    it('3. CreateCertificationSchema rejects direct self-assertion of VERIFIED status', () => {
      const attempt = {
        slug: 'swiss-assay-seal',
        title: 'Swiss Assay Seal',
        issuingOrganization: 'Swiss Lab',
        issueDate: '2026-01-01',
        verificationStatus: 'VERIFIED', // Forbidden in generic create schema
      };
      expect(() => CreateCertificationSchema.parse(attempt)).toThrow();
    });

    it('4. AdminVerifyCertificationSchema authorizes official verification with notes', () => {
      const adminAction = {
        verificationStatus: 'VERIFIED' as const,
        verificationNotes: 'Verified against official COSC registry serial #2026-001 on 2026-01-20.',
      };
      const parsed = AdminVerifyCertificationSchema.parse(adminAction);
      expect(parsed.verificationStatus).toBe('VERIFIED');
    });

    it('5. CreateMediaAssetSchema enforces publicUrl non-empty for public and null for private', () => {
      // Valid public
      expect(() =>
        CreateMediaAssetSchema.parse({
          originalFilename: 'img.webp',
          storedFilename: 'st_img.webp',
          storageProvider: 'local',
          storagePath: '/p',
          publicUrl: '/p/img.webp',
          visibility: 'public',
          mimeType: 'image/webp',
          fileSize: 1000,
          sha256: 'a'.repeat(64),
          uploadedBy: 'u1',
        })
      ).not.toThrow();

      // Invalid public with null publicUrl
      expect(() =>
        CreateMediaAssetSchema.parse({
          originalFilename: 'img.webp',
          storedFilename: 'st_img.webp',
          storageProvider: 'local',
          storagePath: '/p',
          publicUrl: null,
          visibility: 'public',
          mimeType: 'image/webp',
          fileSize: 1000,
          sha256: 'a'.repeat(64),
          uploadedBy: 'u1',
        })
      ).toThrow();

      // Valid private
      expect(() =>
        CreateMediaAssetSchema.parse({
          originalFilename: 'doc.pdf',
          storedFilename: 'st_doc.pdf',
          storageProvider: 'local',
          storagePath: '/private/doc.pdf',
          publicUrl: null,
          visibility: 'private',
          mimeType: 'application/pdf',
          fileSize: 1000,
          sha256: 'b'.repeat(64),
          uploadedBy: 'u1',
        })
      ).not.toThrow();

      // Invalid private with publicUrl
      expect(() =>
        CreateMediaAssetSchema.parse({
          originalFilename: 'doc.pdf',
          storedFilename: 'st_doc.pdf',
          storageProvider: 'local',
          storagePath: '/private/doc.pdf',
          publicUrl: '/leak/doc.pdf',
          visibility: 'private',
          mimeType: 'application/pdf',
          fileSize: 1000,
          sha256: 'b'.repeat(64),
          uploadedBy: 'u1',
        })
      ).toThrow();
    });
  });
});
