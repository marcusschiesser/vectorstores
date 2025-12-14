<h1 align="center">vectorstores</h1>
<h3 align="center">
  Vector database framework for your AI application.
</h3>

Context engineering made easy: Vectorstores provides a unified interface for connecting data to your AI application. It supports ingestion of data from various sources, loading it into vector databases and querying it later on.

It plays nicely with existing AI frameworks like Vercel AI SDK, see the [Vercel integration guide](https://www.vectorstores.org/integration/vercel) for more details.

It's a based on a fork of [LLamaIndexTS](https://github.com/run-llama/LlamaIndexTS), so you can use it as a drop-in replacement for LLamaIndexTS in your existing projects. Compared to LLamaIndexTS, vectorstores is more lightweight as it just focuses on vector databases and provides a unified interface for working with them.

## Compatibility

### Multiple JS Environment Support

vectorstores supports multiple JS environments, including:

- Node.js >= 20 ✅
- Deno ✅
- Bun ✅
- Nitro ✅
- Vercel Edge Runtime ✅ (with some limitations)
- Cloudflare Workers ✅ (with some limitations)

## Getting started

```shell
npm install @vectorstores/core
```

### Setup in Node.js, Deno, Bun, TypeScript...?

See the docs: `https://vectorstores.org/getting_started/installation`

### Your first (minimal) retrieval example

```shell
npm init -y
npm install @vectorstores/core openai
npm install -D typescript tsx @types/node
export OPENAI_API_KEY=your-api-key-here
```

```ts
import { Document, Settings, VectorStoreIndex } from "@vectorstores/core";
import { OpenAI } from "openai";

const openai = new OpenAI();
Settings.embedFunc = async (input) => {
  const { data } = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input,
  });
  return data.map((d) => d.embedding);
};

const document = new Document({ text: "Machine learning is..." });
const index = await VectorStoreIndex.fromDocuments([document]);
const retriever = index.asRetriever();

const results = await retriever.retrieve({
  query: "What is machine learning?",
});
console.log(results[0]?.node.text);
```

### Adding provider packages

In most cases, you'll also need to install provider packages to use vectorstores. These are for adding file readers for ingestion or for storing documents in vector databases.

For example, to use the Weaviate vector database, you would install the following package:

```shell
npm install @vectorstores/weaviate
```

## Examples (local + StackBlitz)

- **Run locally**: `https://vectorstores.org/getting_started/examples`
- **Try in your browser (StackBlitz)**: `https://stackblitz.com/github/marcusschiesser/vectorstores/tree/main/examples?file=README.md`

## Contributing

Please see our [contributing guide](CONTRIBUTING.md) for more information.
