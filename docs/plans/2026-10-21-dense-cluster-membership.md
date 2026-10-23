# Dense cluster membership verification plan

Goal: verify complete paginated membership for deterministic 1000- and
10000-point sources on both running native hosts.

Use the existing development fixture and public inspection API. Coincident
points guarantee one low-zoom cluster, avoiding uncertain geometric boundary
expectations. Compared with generating random points, stable dense IDs make
missing/duplicate leaves reproducible. Compared with adding a new test app,
extending the current fixture preserves its native map lifecycle and public API.
This is correctness evidence, not a frame-time or memory benchmark.

1. Add deterministic bounded dense source generation with stable unique IDs and
   Point geometry. Validate completeness through public native query results
   rather than adding a test that merely mirrors fixture generation.
2. Add fixture controls switching the input with increased producer revision and
   clearing held selection. Add an audit button that reads 100-leaf pages until
   total is exhausted, checking source membership, no duplicates, immutable
   results and an empty terminal page. Store compact counts and errors.
3. On each simulator choose 1000 points, locate/tap the cluster and run the audit;
   repeat at 10000 points. Capture exact totals, ID-set equality and query errors.
4. Run relevant contract/types/quality checks and production bundles. Update
   CLUSTER-07 and verification evidence; keep spatial edge and performance gates
   open. No release performance claims or commits.
