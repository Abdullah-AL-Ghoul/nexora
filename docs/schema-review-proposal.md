# NEXORA — Database Architecture & Schema Evolution Proposal

**Execution Date:** November 2026  
**Status:** Pre-Implementation Specification (Non-Destructive Design, Zero Migrations Applied in this Turn)  
**Standard:** Relational Integrity, WCAG 2.2 Accessibility, Client Privacy Governance, Role-Based Access Control  

---

## 1. Architectural Critique of Initial Proposal

The initial draft presented in earlier notes had several critical shortcomings that the user correctly identified:
1. **Unstructured Media Storage:** Storing project photos in a raw `String[]` array prevented assigning **Alt Text** (violating WCAG 2.2 AA accessibility requirements), captions, individual aspect ratios, or custom drag-and-drop sort orders.
2. **Hardcoded Assumptions:** Setting `year: 2026` as a default is brittle; bespoke heritage commissions may date back several years.
3. **Absence of Client Privacy Controls:** In luxury bespoke commissions, private collectors frequently demand anonymity (e.g. *"Private Collector, Zurich"* vs displaying a full patron name).
4. **Conflation of Publication Status and Credential Validity:** A certificate might be legally `ACTIVE` with an issuing authority, but saved as a `DRAFT` internally while marketing prepares copy. Conversely, a published certificate might become `EXPIRED`. These two lifecycles must be decoupled.
5. **Lack of Relational Links:** Bespoke projects often originate from or inspire catalog products (`Product`), and pieces may carry specific authenticity certificates (`Certification`).
6. **Unprotected Document Assets:** Uploading raw PDF certificates directly to public URLs risks leaking sensitive client serials or private appraisals.

---

## 2. Refined Production-Grade Prisma Schema Specification

```prisma
// ============================================================================
// 1. ENUMS FOR LIFECYCLE & PRIVACY GOVERNANCE
// ============================================================================

enum PublicationStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum ClientPrivacyLevel {
  PUBLIC          // Full client/entity name visible
  ANONYMIZED      // Display "Private Collector, [Region]"
  CONFIDENTIAL    // Conceal client identity entirely
}

enum CertificationType {
  PRODUCT_AUTHENTICITY       // Individual piece COA, serial verification
  INSTITUTIONAL_ACCREDITATION // COSC Chronometer, Responsible Jewellery Council (RJC)
  ARTISAN_MASTERY            // Master Horologist, Guild Accreditations
  MATERIAL_COMPLIANCE        // Ethical Diamond Sourcing (Kimberley), Fairmined Gold
}

enum CredentialValidityStatus {
  ACTIVE
  EXPIRED
  REVOKED
  PENDING_RENEWAL
}

enum ProjectDiscipline {
  HOROLOGY
  HAUTE_JOAILLERIE
  ACOUSTIC_INSTRUMENTATION
  ARCHITECTURAL_COMMISSION
  BESPOKE_LIFESTYLE
}

enum MediaType {
  IMAGE
  VIDEO
}

// ============================================================================
// 2. ATELIER BESPOKE PROJECTS SCHEMA
// ============================================================================

model Project {
  id                 String             @id @default(cuid())
  title              String
  slug               String             @unique
  discipline         ProjectDiscipline  @default(HOROLOGY)
  category           String             // Sub-label e.g. "Tourbillon Caliber", "Pavé Diamond Setting"
  
  // Client & Provenance Governance
  clientName         String?
  clientLocation     String?            // e.g. "Geneva, Switzerland"
  clientPrivacyLevel ClientPrivacyLevel @default(ANONYMIZED)
  
  // Editorial Content
  summary            String             // 1-2 sentence high-impact editorial pitch
  description        String             @db.Text // Long-form craftsmanship story (Markdown/HTML)
  curatorNote        String?            @db.Text // Special note from head artisan
  
  // Technical Specifications
  materials          String[]           // e.g. ["18K Rose Gold", "Grade 5 Titanium", "Sapphire"]
  dimensions         String?            // e.g. "42mm diameter x 11.8mm thickness"
  yearCompleted      Int?
  durationWeeks      Int?
  
  // Publishing & Ordering
  publicationStatus  PublicationStatus  @default(DRAFT)
  featured           Boolean            @default(false)
  sortOrder          Int                @default(0)
  liveShowcaseUrl    String?            // Optional external video or 3D view link
  
  // SEO Metadata
  seoTitle           String?
  seoDescription     String?
  canonicalUrl       String?
  
  // Audit Trail
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  // Relational Integrity
  media              ProjectMedia[]
  certifications     Certification[]    @relation("ProjectCertifications")
  relatedProducts    Product[]          @relation("ProjectRelatedProducts")

  @@index([publicationStatus, sortOrder])
  @@index([discipline])
}

model ProjectMedia {
  id          String    @id @default(cuid())
  projectId   String
  url         String
  altText     String    // Strictly mandatory for WCAG 2.2 AA a11y compliance
  caption     String?   // Editorial label e.g. "Hand-chamfered bridge under 10x magnification"
  position    Int       @default(0)
  isCover     Boolean   @default(false)
  mediaType   MediaType @default(IMAGE)
  aspectRatio String    @default("4/3") // e.g. "16/9", "4/3", "1/1"
  createdAt   DateTime  @default(now())

  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, position])
}

// ============================================================================
// 3. AUTHENTICITY CERTIFICATIONS SCHEMA
// ============================================================================

model Certification {
  id                   String                   @id @default(cuid())
  title                String                   // e.g. "Official Swiss Chronometer Testing (COSC)"
  slug                 String                   @unique
  type                 CertificationType        @default(INSTITUTIONAL_ACCREDITATION)
  
  // Issuing Authority Metadata
  issuingBody          String                   // e.g. "Contrôle Officiel Suisse des Chronomètres"
  issuingBodyUrl       String?                  // e.g. "https://www.cosc.swiss"
  issuingBodyLogo      String?                  // Logo image URL
  
  // Verification Identifiers
  credentialId         String                   @unique // e.g. "NX-CHRONO-2026-089"
  verificationUrl      String?                  // Direct verification registry link
  
  // Temporal Lifecycle
  issueDate            DateTime
  expiryDate           DateTime?
  autoExpire           Boolean                  @default(true)
  
  // Display Badges & Document Security
  badgeImageUrl        String                   // Official seal/hallmark icon
  documentUrl          String?                  // PDF certificate / appraisal sheet
  isDocumentPrivate    Boolean                  @default(false) // Requires authentication or signed URL
  
  // Domain Competencies
  skillsOrStandards    String[]                 // e.g. ["ISO 3159", "Dynamic Thermal Rate Testing"]
  summary              String?
  description          String?                  @db.Text
  
  // Decoupled Statuses
  publicationStatus    PublicationStatus        @default(DRAFT)
  credentialStatus     CredentialValidityStatus @default(ACTIVE)
  sortOrder            Int                      @default(0)
  
  // SEO Metadata
  seoTitle             String?
  seoDescription       String?
  
  // Audit Trail
  createdAt            DateTime                 @default(now())
  updatedAt            DateTime                 @updatedAt

  // Relational Links
  projects             Project[]                @relation("ProjectCertifications")
  products             Product[]                @relation("ProductCertifications")

  @@index([publicationStatus, credentialStatus])
  @@index([credentialId])
}
```

---

## 3. Rationale Behind Design Decisions

### 3.1 ProjectMedia Relation (vs. `String[]`)
- **Accessibility Invariant:** By mandating `altText: String` on `ProjectMedia`, we eliminate the accessibility anti-pattern of rendering images without descriptive tags.
- **Visual Composition:** Photographers and editors can assign `caption` and `aspectRatio`, enabling the frontend to assemble magazine-grade asymmetric bento spreads (as seen in the Bang & Olufsen reference exhibit).

### 3.2 Decoupling Publication Status from Credential Validity
- An accreditation from an institution like COSC or GIA has its own legal lifespan (`issueDate` $\rightarrow$ `expiryDate`).
- If a certificate expires, the backend can automatically flag `credentialStatus: EXPIRED` without unpublishing the historical record, ensuring that past clients can still verify the lineage of pieces crafted during the active certification window.

### 3.3 Client Privacy Governance (`ClientPrivacyLevel`)
- Ultra-wealthy patrons purchasing one-of-a-kind horological complications or high-jewelry pieces demand privacy.
- The `ClientPrivacyLevel` enum enforces at the query layer whether `clientName` is rendered, replaced with an anonymized label (e.g. *"Private Commission, Dubai"*), or stripped entirely.

### 3.4 Protection of PDF Documents (`isDocumentPrivate`)
- Public visitors can view the cryptographic badge, issuing authority, and Credential ID on the public site.
- If `isDocumentPrivate` is true, the raw certificate PDF (which may contain insurance appraisals or serial numbers) is accessible only to authenticated purchasers or staff via a time-limited signed URL.
