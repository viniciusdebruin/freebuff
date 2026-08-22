# Linux sem AVX2: Freebuff Desktop e CLI

## Reprodução

- Linux x86_64
- CPU sem `avx2` em `/proc/cpuinfo`
- Freebuff Desktop 0.0.70: o Bun empacotado encerra com `SIGILL` (código 132)
- Freebuff CLI 0.0.154: inicia e baixa `freebuff-linux-x64-baseline.tar.gz`

## Resultado

O launcher do CLI já seleciona `linux-x64-baseline` antes de iniciar o
binário. O teste adicionado em `cli/src/__tests__/release/wrapper-safety.test.ts`
protege essa seleção contra regressões em Linux x64 sem AVX2.

## Sugestão para o Desktop

Aplicar a mesma seleção de target ao launcher do Desktop ou publicar um
AppImage Linux baseado no runtime baseline. O AppImage atual inclui um Bun que
requer AVX2 e encerra antes de iniciar o orquestrador.
