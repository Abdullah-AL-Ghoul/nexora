import type {
  Project,
  Certification,
  MediaAsset,
  ProjectMedia,
  CertificationMedia,
} from '../../../src/types/index.ts';

/**
 * Isolated Domain Test Fixtures
 *
 * CAUTION: These fixtures are strictly intended for automated in-memory and disposable
 * test execution (vitest suites). Under NEXORA's Zero-Fabrication Policy, these fixtures
 * must NEVER be seeded into persistent production databases or persistent user workspaces.
 */

export const mockMediaAssets: MediaAsset[] = [
  {
    id: 'media_test_project_cover_01',
    originalFilename: 'chronos_residence_facade.webp',
    storedFilename: 'nx_media_f1a2b3c4d5e6.webp',
    storageProvider: 'local',
    storagePath: 'public/img/uploads/projects/nx_media_f1a2b3c4d5e6.webp',
    publicUrl: '/img/uploads/projects/nx_media_f1a2b3c4d5e6.webp',
    visibility: 'public',
    mimeType: 'image/webp',
    fileSize: 482910,
    width: 1920,
    height: 1080,
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    altText: 'Facade installation of the Chronos private gallery',
    uploadedBy: 'user_admin_01',
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 'media_test_cert_badge_01',
    originalFilename: 'cosc_chronometer_badge.webp',
    storedFilename: 'nx_media_c05c00000001.webp',
    storageProvider: 'local',
    storagePath: 'public/img/uploads/certifications/nx_media_c05c00000001.webp',
    publicUrl: '/img/uploads/certifications/nx_media_c05c00000001.webp',
    visibility: 'public',
    mimeType: 'image/webp',
    fileSize: 125400,
    width: 512,
    height: 512,
    sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    altText: 'Official COSC Chronometer Testing Badge',
    uploadedBy: 'user_admin_01',
    createdAt: '2026-03-01T10:30:00Z',
    updatedAt: '2026-03-01T10:30:00Z',
  },
  {
    id: 'media_test_private_audit_doc_01',
    originalFilename: 'swiss_assay_lab_report_2026.pdf',
    storedFilename: 'nx_media_private_assay_9876.pdf',
    storageProvider: 'local',
    storagePath: '.data/private_uploads/certifications/nx_media_private_assay_9876.pdf',
    publicUrl: null, // Strictly NULL for private compliance documentation
    visibility: 'private',
    mimeType: 'application/pdf',
    fileSize: 2450000,
    width: null,
    height: null,
    sha256: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
    altText: 'Confidential Swiss precious metal assay laboratory certificate',
    uploadedBy: 'user_admin_01',
    createdAt: '2026-03-01T11:00:00Z',
    updatedAt: '2026-03-01T11:00:00Z',
  },
];

export const mockProjects: Project[] = [
  {
    id: 'proj_test_01',
    slug: 'chronos-residence-installation',
    title: 'The Chronos Residence Installation',
    subtitle: 'Bespoke Horological Display & Integrated Architectural Cabinetry',
    discipline: 'Architectural Horology',
    clientType: 'PRIVATE_COLLECTOR',
    clientName: 'Confidential Collector',
    description: 'An architectural horological display crafted from solid black walnut and titanium.',
    challenge: 'Integrating micro-climate stabilization without visible refrigeration vents.',
    solution: 'Concealed Peltier thermoelectric modules with passive titanium dissipation fins.',
    materials: ['Solid Black Walnut', 'Titanium Grade 5', 'Museum Anti-Reflective Glass'],
    location: 'Geneva, Switzerland',
    completionDate: '2026-02-28',
    coverMediaId: 'media_test_project_cover_01',
    coverImageUrl: '/img/uploads/projects/nx_media_f1a2b3c4d5e6.webp',
    publicationStatus: 'PUBLISHED',
    isFeatured: true,
    sortOrder: 1,
    createdAt: '2026-03-01T12:00:00Z',
    updatedAt: '2026-03-01T12:00:00Z',
  },
];

export const mockCertifications: Certification[] = [
  {
    id: 'cert_test_01',
    slug: 'cosc-chronometer-laboratory-standard',
    title: 'COSC Certified Chronometer Standard',
    issuingOrganization: 'Contrôle Officiel Suisse des Chronomètres',
    credentialId: 'COSC-TEST-2026-001',
    credentialUrl: 'https://example.com/cosc-verify/2026-001',
    issueDate: '2025-01-15',
    expirationDate: '2027-01-15',
    applicableDisciplines: ['Mechanical Horology', 'Caliber Assembly'],
    skillsStandards: 'ISO 3159 Timekeeping Precision Standard (-4/+6 seconds daily rate)',
    badgeMediaId: 'media_test_cert_badge_01',
    badgeImageUrl: '/img/uploads/certifications/nx_media_c05c00000001.webp',
    publicationStatus: 'PUBLISHED',
    verificationStatus: 'VERIFIED',
    verificationNotes: 'Direct verification through official registry lookup on 2026-01-20.',
    verifiedAt: '2026-01-20T14:30:00Z',
    verifiedBy: 'user_admin_01',
    sortOrder: 1,
    createdAt: '2026-03-01T12:00:00Z',
    updatedAt: '2026-03-01T12:00:00Z',
  },
  {
    id: 'cert_test_expired_01',
    slug: 'expired-craft-accreditation',
    title: 'Historical Guild Accreditation 2023',
    issuingOrganization: 'Geneva Craftsmanship Guild',
    credentialId: 'GCG-HISTORICAL-2023',
    credentialUrl: null,
    issueDate: '2022-01-01',
    expirationDate: '2023-12-31', // Factually elapsed
    applicableDisciplines: ['Leather Finishing'],
    skillsStandards: 'Traditional Saddle Stitching Standard',
    badgeMediaId: null,
    badgeImageUrl: '',
    publicationStatus: 'PUBLISHED',
    verificationStatus: 'VERIFIED', // Administratively verified in 2022, but date is expired
    verificationNotes: 'Historical archive accreditation.',
    verifiedAt: '2022-01-10T09:00:00Z',
    verifiedBy: 'user_admin_01',
    sortOrder: 2,
    createdAt: '2026-03-01T12:00:00Z',
    updatedAt: '2026-03-01T12:00:00Z',
  },
];
