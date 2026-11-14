import { defineConfig } from 'orval';

// Generates typed fetchers and TanStack Query hooks from the backend's OpenAPI
// snapshot. Refresh the snapshot with `npm run api:fetch`, then regenerate
// with `npm run api:generate`.
export default defineConfig({
  ulovko: {
    input: './openapi.json',
    output: {
      mode: 'tags-split',
      target: './src/api/generated/endpoints',
      schemas: './src/api/generated/model',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      override: {
        mutator: {
          path: './src/api/client.ts',
          name: 'apiFetch',
        },
        // apiFetch returns the parsed body and throws ApiError otherwise.
        fetch: {
          includeHttpResponseReturnType: false,
        },
        // Nest's "CompetitionsController_getById" becomes "competitionsGetById",
        // so hooks read as useCompetitionsGetById.
        operationName: (operation) =>
          (operation.operationId ?? '')
            .replace(/Controller_/, '_')
            .replace(/_(\w)/g, (_, c: string) => c.toUpperCase())
            .replace(/^\w/, (c) => c.toLowerCase()),
      },
    },
  },
});
