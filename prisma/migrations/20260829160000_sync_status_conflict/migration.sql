-- Wave prompt 010: distinguish business conflicts from recoverable sync failures.

ALTER TYPE "SyncStatus" ADD VALUE 'CONFLICT';
