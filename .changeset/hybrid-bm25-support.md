---
"@vectorstores/core": patch
"@vectorstores/weaviate": patch
"@vectorstores/elastic-search": patch
"@vectorstores/mongodb": patch
"@vectorstores/postgres": patch
"@vectorstores/supabase": patch
"@vectorstores/azure": patch
"@vectorstores/qdrant": patch
---

Add hybrid and BM25 search support to vector stores.
SimpleVectorStore now includes a fallback BM25 implementation.
Native support added for Weaviate, ElasticSearch, MongoDB Atlas, and PostgreSQL.
