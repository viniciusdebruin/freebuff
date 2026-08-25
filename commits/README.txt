COMMITS LOCAIS DO FREEBUFF

Agora existem somente dois commits independentes:

1. 01-installation-auth
   Corrige a instalação/autenticação do Freebuff.

2. 02-retries-followups
   Adiciona retries para erros transitórios e o timer das três sugestões,
   sem iniciar uma nova sessão automaticamente.

No outro computador, dentro da raiz do projeto, aplique cada patch na ordem:

git apply commits/01-installation-auth/changes.patch
git add cli/src/hooks/use-auth-query.ts
git commit -m "Fix Freebuff installation authentication loop"

git apply commits/02-retries-followups/changes.patch
git add cli/src/components/tools/suggest-followups.tsx packages/agent-runtime/src/llm-api/codebuff-web-api.ts packages/agent-runtime/src/prompt-agent-stream.ts
git commit -m "Retry transient errors without starting a new session"

Revise com git diff antes de cada commit. Não adicione a pasta commits aos
commits do projeto; ela serve apenas como material de aplicação local.
