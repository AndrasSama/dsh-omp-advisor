---
name: rag-retrieval-scoring
description: Equips the advisor to evaluate retrieval quality in RAG pipelines — scoring calibration, hybrid fusion, reranking thresholds, and chunking effects.
---

# RAG Retrieval Scoring

Reviews whether a RAG pipeline retrieves the right passages with calibrated confidence. Raw vector similarity is not a relevance score; uncalibrated thresholds either stuff context with noise or silently return nothing.

## Watch for
- Raw cosine/dot scores thresholded as if comparable across embedding models or query types — they are not.
- Fixed top-k stuffing (k=10 regardless of scores) — low-quality chunks dilute the answer.
- Vector-only retrieval missing exact-match cases (error codes, ids, names) that BM25 would catch.
- No reranker: first-stage similarity alone ordering the final context.
- Chunk size mismatched to query type: 2048-token chunks for factoid lookup, 64-token chunks losing surrounding context.
- Metadata filters applied after retrieval instead of inside the index query — wasted k and wrong-domain docs.
- No retrieval eval harness: recall@k / MRR untracked on a labeled query set.
- Duplicate or near-duplicate chunks from overlapping splits consuming budget.

## Best practices
- Hybrid retrieval: BM25 + vector fused with Reciprocal Rank Fusion (k=60 is the standard choice) as a robust default.
- Add a cross-encoder reranker (bge-reranker, Cohere Rerank) over the top 50–100; keep the top 3–8 by reranked score.
- Threshold on the reranker's calibrated score; fall back to "no context" rather than noise.
- Chunk at 256–512 tokens with ~10–15% overlap for general QA; tune via eval, not defaults.
- Push metadata filters (tenant, date, doc type) into the index query.
- Dedup by document + section before packing; cap chunks per source document.
- Maintain a golden set (50–200 labeled queries); track recall@k and answer-grounding rate on every index or embedding change.
- Log query, retrieved ids, and scores per request to debug regressions.

## Quick checklist
- [ ] Hybrid (BM25 + vector) or justified vector-only
- [ ] Reranker applied before final selection
- [ ] Thresholds calibrated on reranker scores, not raw cosine
- [ ] Chunk size tuned and overlap controlled
- [ ] Metadata filters applied inside the index query
- [ ] Near-duplicate chunks deduplicated
- [ ] Golden-set recall@k tracked on changes
- [ ] Retrieval decisions logged per request
