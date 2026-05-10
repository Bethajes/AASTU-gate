DELETE FROM "Student" s
WHERE s."id" LIKE 'ETS-TEST-%'
  AND NOT EXISTS (
    SELECT 1
    FROM "User" u
    WHERE u."studentId" = s."id"
  );
