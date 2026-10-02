-- Convert `User.emailVerified` from `DateTime?` to `Boolean` (default false).
-- Required by better-auth v1.7, which reads/writes emailVerified as a boolean.
-- Existing rows: a non-null timestamp means the email was verified -> true.
ALTER TABLE "User" ALTER COLUMN "emailVerified" TYPE BOOLEAN USING ("emailVerified" IS NOT NULL);
ALTER TABLE "User" ALTER COLUMN "emailVerified" SET DEFAULT false;
ALTER TABLE "User" ALTER COLUMN "emailVerified" SET NOT NULL;
