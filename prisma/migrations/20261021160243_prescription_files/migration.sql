/*
  Warnings:

  - Added the required column `consentAt` to the `Prescription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mimeType` to the `Prescription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sizeBytes` to the `Prescription` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Prescription" ADD COLUMN     "consentAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "mimeType" TEXT NOT NULL,
ADD COLUMN     "sizeBytes" INTEGER NOT NULL;
