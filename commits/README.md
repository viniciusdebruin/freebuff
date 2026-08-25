# Freebuff — commits portáveis

Esta pasta é uma cópia portátil dos commits feitos localmente no Freebuff. O
histórico Git dentro do repositório continua sendo a fonte principal; os
patches servem como backup, transporte e forma de aplicar as mudanças em outro
computador.

## Estrutura

- `01-installation-auth/` e `02-retries-followups/`: séries antigas mantidas
  para referência.
- `03-current-fork-patches/`: série atual completa, com 13 patches ordenados.

A série atual foi gerada a partir de `origin/main` até o commit local mais
recente. Ela inclui as correções do runtime, login/desktop, toolkit de agentes,
integração com a CLI e as configurações de continuação automática de sessão e
follow-ups.

Último commit da série atual:

```text
9eb85b79a Add configurable session continuation and followups
```

## Opção preferida: recuperar pelo fork

Quando os commits estiverem publicados no fork, em outro PC:

```bash
git clone https://github.com/viniciusdebruin/freebuff.git
cd freebuff
git pull origin main
git log --oneline -13
```

Antes de aplicar patches, confirme se o `git log` já mostra esses commits. Se
eles já estiverem no fork, não aplique a série novamente.

## Opção de backup: aplicar a série de patches

Use esta opção enquanto o push para o fork ainda não estiver confirmado. Clone
o fork em uma cópia limpa e aplique somente a série atual:

```bash
git clone https://github.com/viniciusdebruin/freebuff.git
cd freebuff
git status
git am /caminho/para/commits/03-current-fork-patches/*.patch
```

Se a pasta `commits` tiver sido copiada para dentro da raiz do repositório,
use:

```bash
git am commits/03-current-fork-patches/*.patch
```

Depois confira o resultado:

```bash
git log --oneline -13
git status
```

O repositório deve estar sem alterações pendentes. Em caso de conflito, não
continue aplicando comandos às cegas: execute `git status`, resolva os arquivos
indicados e finalize com `git am --continue`. Para cancelar a aplicação atual,
use `git am --abort`.

## Verificação local

No repositório recuperado, rode:

```bash
bun test
bun run build:freebuff
./cli/bin/freebuff --version
```

Execute a instalação e a compilação como o usuário normal do computador, não
como `root`. Isso evita que configurações, logs e o `config.toml` fiquem
inacessíveis para o usuário que vai executar o Freebuff.

## Observações

- Os patches contêm código-fonte e metadados Git; não contêm tokens, senhas ou
  credenciais de login.
- `03-current-fork-patches` é a série que deve ser usada para transportar o
  estado atual. Não aplique também as séries `01` e `02` em sequência.
- A pasta `commits/` foi mantida separada e não deve entrar nos commits do
  código do projeto, a menos que isso seja desejado explicitamente. Ela pode
  permanecer como material de transporte fora do histórico principal.
- Se o fork já tiver recebido os commits, basta fazer `git pull`; os patches
  deixam de ser necessários para aquele clone.
