# Bestand

Aplicativo desktop de gerenciamento de estoque, desenvolvido a partir da documentação do projeto.

## Stack
- Node.js 22.23.3
- TypeScript
- Electron 39.8.10
- SQLite local via sql.js (WASM)
- Vite
- Chart.js
- jsPDF
- Zod

## Arquitetura
Renderer -> Preload -> IPC -> Services -> SQLite.
O renderer não acessa o banco diretamente. O preload expõe somente os canais IPC necessários.

## Requisitos cobertos
- RF01/RF02: perfis e permissões
- RF03: cadastro, alteração e remoção de produtos
- RF04: vendas e devoluções no histórico
- RF05: carregamentos de estoque
- RF06: receita e custo por janela de tempo
- UC001 a UC010: fluxos correspondentes, incluindo validações e cancelamentos

## Segurança
- `nodeIntegration: false`
- `contextIsolation: true`
- sandbox do renderer habilitado
- preload com whitelist de canais IPC
- senhas protegidas com `scrypt` e salt aleatório
- banco fora do diretório do projeto, em `app.getPath('userData')`
- remoções de usuários e produtos são lógicas quando necessário para preservar histórico

## Execução
O projeto segue RNF03 e exige Node.js 22.23.3.

```bash
nvm use 22.23.3
npm install
npm run check-node
npm run verify
npm start
```

Para desenvolvimento:
```bash
npm run dev
```

> `npm start` abre os arquivos já compilados em `dist/` (rode `npm run build` antes). `npm run dev` usa o servidor do Vite e inicia o Electron com a flag `--dev`.

> Datas são gravadas em UTC no banco e convertidas para o horário local nas consultas de receita e na exibição.

Para gerar pacotes Linux:
```bash
npm run package:linux
```

Os artefatos são gerados na pasta `release/`.

## Banco
Na primeira execução, o banco é criado em `app.getPath('userData')/bestand.sqlite`. O usuário inicial é `admin` com senha `admin123`; altere essa senha no primeiro uso.

O RF06 exige custo total, enquanto o UC004 original não define custo no cadastro. O projeto adiciona custo de aquisição opcional, separado do preço de venda, para viabilizar o cálculo.
