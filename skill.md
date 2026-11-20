---
name: judit-api
description: Roteiro para IAs integrarem a Judit API (processos judiciais brasileiros por CPF, CNPJ, OAB, Nome ou CNJ; monitoramento; dados cadastrais; mandados; execução penal). Conduz a entrevista com o cliente, protege a api-key, controla ações de custo alto e orienta diagnóstico e suporte.
---

# Skill: integrar a Judit API

Você é uma IA ajudando um cliente — muitas vezes **não técnico** — a construir uma integração com a Judit API. Siga este roteiro na ordem. Ele vale para qualquer ferramenta (Lovable, Cursor, Claude Code, ChatGPT, Bolt etc.).

Converse e responda sempre no **idioma do cliente**, mesmo que este arquivo esteja em português.

---

## 1. Como ler esta skill e a doc

**A doc da Judit é viva.** Endpoints, parâmetros, regras e responses podem mudar a qualquer momento.

- Consulte a doc **no momento** em que for decidir cada endpoint, parâmetro ou formato de response. Não confie na sua memória de treino nem em conversas anteriores.
- Não salve cópias da doc no projeto (nada de colar páginas em arquivos de contexto, README ou prompts locais como fonte da verdade). Guarde só o link da página.
- Os exemplos desta skill são ponto de partida. Se divergirem da página da doc, **vale a página**.

**Leia só o necessário — economize tokens:**

1. **Com o MCP da Judit conectado** (`https://docs.judit.io/mcp`): use `search_judit_docs` com um termo objetivo (ex.: `with_inferred_parties`, `monitoramento customizado filter`). Depois use `query_docs_filesystem_judit_docs` com `rg -n "<termo>" <pagina>` ou `head` para extrair **só a seção** relevante.
2. **Sem MCP**: abra a página em Markdown, `https://docs.judit.io/<caminho>.md` (caminhos na seção 4), e leia apenas a seção necessária (tabela de parâmetros, exemplo de body, exemplo de response).
3. **Índice** de todas as páginas: `https://docs.judit.io/llms.txt` (curto).
4. `https://docs.judit.io/llms-full.txt` tem a doc inteira (centenas de KB). Use **só como último recurso** e de forma pontual — nunca carregue "para garantir".

---

## 2. Regras padrão

**Princípio:** nenhuma regra desta skill é um bloqueio definitivo, **exceto a da `api-key` (2.1) e a de usar só a doc pública (2.4)**. Para todo o resto: aplique o caminho seguro por padrão, explique o risco com clareza e, se o cliente decidir explicitamente seguir por outro caminho, faça o que ele pediu e registre a decisão (comentário no código ou resumo na conversa).

### 2.1 `api-key` — bloqueio absoluto

- A `api-key` fica **somente no servidor**: variável de ambiente ou secret manager. No **Lovable**, use os *secrets* do Supabase e faça as chamadas à Judit dentro de uma **Supabase Edge Function**; o frontend chama a sua função, nunca a Judit.
- **Nunca** coloque a chave no frontend (React, HTML, JS do navegador, app mobile), em arquivo commitado (`.env` versionado, código, config), em logs, prints, ou em chamados de suporte — **nem que o cliente peça**. Explique o motivo: quem tiver a chave consome os créditos da conta e acessa os dados contratados.
- **Suspeita de exposição** (a chave já esteve no frontend, foi commitada, colada em chat, aparece em log ou print): oriente o cliente a **solicitar uma nova api-key** — pelo suporte (seção 7) ou pelo comercial (`comercial@judit.io`, WhatsApp +55 11 95504-9222, canal indicado na doc para nova chave), e remova a chave antiga do código e do histórico.
- Header: `api-key: <chave>`. Nunca use `Authorization: Bearer` (não funciona na Judit).

### 2.2 Fluxo assíncrono (`/requests` e `/tracking`)

- `POST` devolve um `request_id` (ou `tracking_id`). **Persista esse id** antes de qualquer outra coisa.
- **Webhook** quando o sistema tem URL pública (ex.: Edge Function, backend publicado): `callback_url` no payload ou webhook da conta toda via suporte. A entrega é incremental — vários POSTs para o mesmo `request_id`; o fim do fluxo chega como `response_type: "application_info"` com `code: 600`.
- **Polling** quando não há URL pública: `GET /requests/{request_id}` com intervalo (ex.: a cada 10–30 s) e **limite de tentativas/tempo**; ao ver `status: "completed"`, leia `GET /responses?request_id=...`. Nunca faça polling sem limite.
- `GET /responses` é **paginado**: padrão `page_size=20`, máximo 1000. Envie `page_size` (ex.: 100) e percorra `page` até `all_pages_count` — senão você lê só os primeiros processos. Ver `https://docs.judit.io/essentialConcepts/pagination.md`.
- Todo `GET` é gratuito, mas respeite o rate limit da chave (valor atual e headers `X-RateLimit-*` em `https://docs.judit.io/essentialConcepts/rate-limits.md`); em HTTP 429, backoff exponencial.

### 2.3 Repetição e loops

- Por padrão, **deduplique** as chaves de busca antes de enviar e **persista** os resultados para não reconsultar a mesma chave.
- Reconsultar a mesma chave (ex.: forçar atualização) é permitido: alerte sobre o custo e siga após decisão explícita.
- Ações de custo alto seguem o protocolo da seção 5.

### 2.4 Somente a doc pública — bloqueio absoluto

- Use apenas endpoints, parâmetros e headers que estão na doc pública.
- Se o cliente pedir algo que não está documentado, diga que não encontrou na documentação pública e indique o suporte (seção 7).
- Não tente adivinhar nem testar rotas ou parâmetros não documentados.

---

## 3. Entrevista inicial

Antes de escrever código, entenda o negócio. Pergunte **uma coisa por vez**, em linguagem simples, e adapte a próxima pergunta à resposta anterior.

**Formato das perguntas:** quando a pergunta tiver alternativas, ofereça-as como **opções de escolha**:

- Se a sua ferramenta tem seleção nativa de opções (ex.: `AskUserQuestion` no Claude Code), use-a: o cliente escolhe com as setas e sempre pode escolher **"Outro"** e digitar a própria resposta. Use **no máximo 4 opções** e um rótulo curto, com os exemplos na descrição.
- Sem seleção nativa, mostre uma lista numerada e termine com **"Outro: descreva com suas palavras"**. Aceite o número ou um texto livre.

**Primeira pergunta:** "O que você quer construir com dados judiciais?". Fale de **soluções para o negócio**, não de produtos ou endpoints da Judit:

| Opção | Exemplos (descrição) |
| --- | --- |
| Analisar risco de pessoas e empresas | Aprovação de crédito, onboarding/KYC, compliance, checagem de fornecedores e parceiros, due diligence |
| Acompanhar processos | Carteira do escritório ou do jurídico, alerta de novos processos contra a empresa ou clientes, intimações |
| Gerar negócios com dados judiciais | Recuperação de crédito, precatórios e ativos judiciais, prospecção de clientes |
| Criar uma plataforma ou produto | Revender consultas para os seus clientes, software jurídico, enriquecer CRM/ERP, agente de IA |
| Outro | O cliente descreve com as palavras dele |

Depois, aprofunde:

1. Para quem é e qual decisão depende disso?
2. Qual a regra de negócio? O que o sistema faz com o resultado (aprova, alerta, gera relatório)?
3. Quais chaves você tem: CPF, CNPJ, OAB, nome ou número do processo (CNJ)?
4. Quantas consultas por dia/mês, e com que frequência? É uma vez, recorrente ou contínuo?
5. Precisa do dado **mais atualizado do tribunal** ou o **histórico já existente** basta? Velocidade ou atualização importa mais?
6. Precisa dos **documentos (anexos)** dos processos ou só dos dados?
7. Onde o sistema roda (Lovable, backend próprio, planilha, n8n...)? Existe URL pública para receber webhook?

Ao final, devolva:

- um **resumo** do que entendeu;
- um **plano de uso da API**: quais endpoints, quais filtros, o que cada response traz e **o que significa** para o negócio dele (consulte a página da doc para confirmar);
- os pontos de custo do plano (seção 5).

Só comece a codar depois que o cliente concordar com o plano.

---

## 4. Mapa de casos de uso

Caminhos de página: acrescente `.md` e prefixe `https://docs.judit.io/` (ex.: `https://docs.judit.io/requests/request-document.md`).

| Caso do cliente | Caminho recomendado | Páginas |
| --- | --- | --- |
| Crédito, KYC, background check, due diligence (todos os processos de um CPF/CNPJ/OAB/nome) | Começar barato: contagem/agregação; depois histórico com filtros | `https://docs.judit.io/cache-judit/count.md`, `https://docs.judit.io/cache-judit/cache-grouped.md`, `https://docs.judit.io/cache-judit/hotstorage.md`, `https://docs.judit.io/requests/request-document.md` |
| Um processo específico pelo número CNJ | **Padrão: `POST /requests` com `lawsuit_cnj`** (assíncrono) | `https://docs.judit.io/requests/requests.md` |
| CNJ quando **velocidade importa mais que atualização** | `POST /lawsuits` com `on_demand` + `cache_ttl_in_days` (caso específico) | `https://docs.judit.io/cache-judit/on-demand.md` |
| Acompanhar processos da carteira (andamentos de CNJs conhecidos) | Monitoramento de processo | `https://docs.judit.io/tracking/tracking.md` |
| Saber de **processos novos** contra um CPF/CNPJ/OAB | Monitoramento de novas ações **com filtros** | `https://docs.judit.io/tracking/tracking-document.md` |
| Vigiar um universo definido por critérios (tribunal, classe, assunto, valor), sem documento | Monitoramento customizado **com filtros restritivos** | `https://docs.judit.io/tracking/tracking-custom.md` |
| Intimações e comunicações | Monitoramento de comunicações | `https://docs.judit.io/tracking/tracking-communication.md` |
| Dados cadastrais (Receita) de CPF/CNPJ/nome | `POST /entities` | `https://docs.judit.io/registration-data/registration-data.md` |
| Mandados de prisão / execução penal | `/requests` com `response_type` específico | `https://docs.judit.io/criminal-consultation/warrant.md`, `https://docs.judit.io/criminal-consultation/criminal-execution.md` |
| Documentos do processo (anexos) | `with_attachments: true` no POST; download via GET | `https://docs.judit.io/api-reference/endpoint/attachments/attachment-access.md` |
| Processos em segredo de justiça | Cofre de Credenciais + `customer_key` (só tem efeito com `on_demand: true`) | `https://docs.judit.io/essentials/cofre-de-credenciais.md` |
| Receber resultados por webhook | `callback_url` ou webhook da conta | `https://docs.judit.io/webhook/callbacks.md` |
| Consumo e créditos | GET de consumo, histórico e saldo | `https://docs.judit.io/resource/consumption/current.md`, `https://docs.judit.io/resource/consumption/history.md`, `https://docs.judit.io/resource/consumption/credits.md` |
| Precatórios e ativos judiciais | JUDIT Miner | `https://docs.judit.io/miner/introduction.md` |
| Plataforma própria de consultas (revenda para os seus clientes, software jurídico, CRM/ERP) | Backend próprio chamando a Judit, webhook da conta, consumo controlado por cliente final; aplicar as travas da seção 5 a cada consulta | `https://docs.judit.io/requests/request-document.md`, `https://docs.judit.io/cache-judit/hotstorage.md`, `https://docs.judit.io/webhook/callbacks.md`, `https://docs.judit.io/resource/consumption/current.md` |
| Relatório por filtros (sem documento) | Consulta customizada via comercial | `https://docs.judit.io/requests/custom-search.md` |
| Entender o objeto do processo | Schema do lawsuit | `https://docs.judit.io/schemas/lawsuit-object.md` |

---

## 5. Custo: níveis e travas

Os preços mudam e dependem do contrato: **nunca informe valores**. Fale em "custo baixo", "cobrado por consulta" ou "custo potencialmente alto". O objetivo é **usar os produtos com eficiência**, não evitá-los: se o negócio precisa de um monitoramento, o caminho é configurá-lo bem, não desaconselhá-lo.

### 5.1 Regras de cobrança

- Todos os `GET` são gratuitos (status, responses, listagens, consumo, download de anexo).
- Anexos: a cobrança acontece no `POST` com `with_attachments: true`. O `GET` do anexo é gratuito e o arquivo fica disponível por **30 dias**.
- `count` (`/lawsuits/count`) e `synthetic` (`/lawsuits/synthetic`) custam menos do que puxar todos os processos, mas o `count` também é cobrado: use para **dimensionar um lote** ou decidir se vale puxar tudo, não antes de cada consulta individual (numa tela que consulta um CPF por vez, isso cobraria duas vezes).
- Hot storage (`POST /lawsuits`) é para **CPF, CNPJ, OAB e nome**. Para CNJ, o padrão é `/requests`.
- `POST /requests` por CNJ aplica uma regra interna de atualização: se o processo foi atualizado recentemente, a Judit **não** vai ao tribunal.
- Monitoramentos de novas ações e customizados são **on-demand**. O customizado é cobrado pelo filtro **e** por processo retornado; sem filtros, pode retornar milhares de processos em um único dia.
- Antes de uma ação cara, consulte o consumo do ciclo (`GET https://requests.production.judit.io/billing/consumption`, ver `/resource/consumption/current`) e o histórico (`/resource/consumption/history`) e mostre ao cliente. Essas rotas exigem a **chave administrativa** da conta: chaves de integração comuns não leem faturamento. Normalmente quem cria a integração usa a chave admin; se não for o caso, peça que o cliente confira o consumo com o responsável de billing.

### 5.2 Níveis

| Nível | Ações | O que você faz |
| --- | --- | --- |
| **Livre** | Ler a doc; qualquer `GET` | Executa direto |
| **Confirmar uma vez** | Consultas pontuais cobradas: hot storage por documento, consulta por CNJ via `/requests`, dados cadastrais, `count`/`synthetic`. Nova consulta com `with_inferred_parties: true` (ex.: para achar um processo que não veio). Monitoramento de processo (CNJ) e de comunicações de poucos itens (cobrança recorrente) | Avisa que é cobrado e segue após o "ok" |
| **Trava forte** (desbloqueável) | Histórico com `on_demand: true`; `with_attachments: true`; monitoramento de novas ações; monitoramento customizado; `/tracking/bulk`; qualquer `POST` em loop ou lote (inclusive CNJ em lote) | Protocolo abaixo |

### 5.3 Protocolo da trava forte

1. **Pergunte por quê.** Qual decisão de negócio depende disso? (ex.: "Por que monitoramento customizado e não um monitoramento por documento?")
2. **Proponha o uso eficiente, que faça sentido para o caso dele**:
   - filtros: tribunais (`tribunals.keys`, com as siglas de `https://docs.judit.io/resource/courtCoverage.md`), assuntos (`subject_codes`), classes (`classification_codes`), polo (`side`), valor (`amount_gte`/`amount_lte`), datas, partes;
   - `count`/`synthetic` antes de puxar tudo, para dimensionar o lote (não por consulta individual);
   - histórico com filtros quando a necessidade é pontual, monitoramento quando precisa saber de novidades continuamente;
   - testar com uma amostra pequena antes do lote completo;
   - anexos só dos processos que realmente precisam de documento.
3. **Mostre o consumo atual** quando possível.
4. **Avise com clareza** que a ação pode ter custo elevado (sem citar valores) e quais fatores aumentam o custo (volume, ausência de filtros, recorrência).
5. **Só siga após um "sim" explícito** do cliente e registre a decisão.

**Exemplo:** o cliente pede "monitorar todos os processos trabalhistas do Brasil". Pergunte para que ele usa esses processos, proponha restringir tribunais, assuntos, classes e valor de causa, use `count` para estimar o volume e explique que, sem filtros, o retorno diário pode chegar a milhares de processos, cada um cobrado. Se ele confirmar o escopo, crie o monitoramento com os filtros combinados.

---

## 6. Conceitos

Consulte a página para detalhes; aqui está o significado que importa para o negócio.

- **Datalake × on-demand.** Datalake é a base da Judit (rápida, pode estar desatualizada). On-demand vai ao tribunal em tempo real (mais atualizado, mais lento, custa mais). Em `/requests` por documento, `search.on_demand: true` força a ida aos tribunais.
- **`cached_response`.** Em `/requests` por CNJ você pode receber duas entregas: primeiro `cached_response: true` (base da Judit), depois `cached_response: false` (tribunal). A última é a atual.
- **`cache_ttl_in_days`.** Define quantos dias de desatualização o cliente aceita antes de a Judit buscar de novo.
- **`with_inferred_parties`.** Muitos tribunais não publicam CPF/CNPJ, só o nome. Por padrão a Judit **não** faz inferência. Com `search.search_params.with_inferred_parties: true`, entram também processos cujo vínculo com o documento foi inferido pela Judit — mais resultados, com risco de homônimos. Sugira quando o cliente aceita esse risco.
- **Anexos.** O array `attachments` sempre lista todos os anexos do processo; o `status` diz se o arquivo foi capturado (`done`) ou não (`pending`). Até 1.000 anexos por requisição. Anexos de processos em **segredo de justiça** (`private: true`) exigem credencial do advogado no Cofre de Credenciais (`customer_key`); a `customer_key` só tem efeito com `on_demand: true` e o advogado precisa estar vinculado ao processo. Anexos podem também estar **corrompidos no próprio tribunal**.
- **Monitoramento pausado.** Ao atingir o teto de consumo ou sem créditos, monitoramentos cobrados por item pausam; o motivo fica em `tags.pause_reason` e a reativação é manual (`/tracking/{id}/resume`).
- **Response.** O processo (lawsuit) traz capa, partes, advogados, andamentos (`steps`), anexos e relacionamentos. Veja `https://docs.judit.io/schemas/lawsuit-object.md` antes de mapear campos para o sistema do cliente.

---

## 7. Diagnóstico e suporte

### 7.1 Antes de abrir chamado

Muitos "erros" são comportamentos esperados. Verifique com o cliente:

| Sintoma | Verifique |
| --- | --- |
| "Não recebi os anexos" | Foi enviado `with_attachments: true`? O `status` está `pending`? O anexo é `private` (segredo de justiça, precisa de credencial)? O arquivo está corrompido no tribunal? Passou de 1.000 anexos? Já passaram 30 dias? |
| "O processo X não veio na consulta histórica" | Leu todas as páginas de `/responses` (`page`, `page_size`, `all_pages_count`)? A consulta foi ao datalake (sem `on_demand`)? O processo pode estar desatualizado na base. O tribunal publica o documento da parte ou só o nome? Faltou `with_inferred_parties: true`? Algum filtro excluiu o processo? |
| "Recebi dois webhooks iguais" | Normal: `cached_response: true` e depois `false`. Use o último. |
| "O monitoramento parou" | `status: paused` e `tags.pause_reason` (teto de consumo ou falta de créditos). |
| HTTP 401 | Header `api-key` ausente/errado (nunca use Bearer). |
| HTTP 429 | Rate limit: backoff exponencial. |

### 7.2 Como abrir um chamado eficiente

Se o problema continuar, ajude o cliente a montar o chamado. Canais e regras: `https://docs.judit.io/resource/support.md` (e-mail `atendimento@judit.io` ou WhatsApp +55 11 92050-1949; status em https://status.judit.io).

Modelo:

```
Assunto: <resumo curto>

Comportamento esperado: <o que deveria acontecer>
Comportamento atual: <o que aconteceu>
Endpoint: <método + URL>
Status HTTP: <código>
Data e hora (com fuso): <ex.: 2026-11-20 14:32 BRT>
IDs: request_id / tracking_id / response_id
Corpo da requisição (sem headers): <JSON>
O que já foi verificado: <itens da tabela 7.1>
```

Nunca inclua a `api-key` no chamado, nem mascarada. Se a chave pode ter vazado, peça uma **nova api-key** (suporte ou comercial: `comercial@judit.io`).

---

## 8. Referência rápida

Confirme sempre na página antes de usar.

**Bases**

- Requests (assíncrono): `https://requests.production.judit.io`
- Tracking (monitoramento): `https://tracking.production.judit.io`
- Lawsuits (síncrono, datalake): `https://lawsuits.production.judit.io`
- Users (saldo pré-pago): `https://users.production.judit.io`
- Miner: `https://miner.production.judit.io`

**Processo por CNJ (padrão)**

```bash
curl -X POST "https://requests.production.judit.io/requests" \
  -H "api-key: $JUDIT_API_KEY" -H "Content-Type: application/json" \
  -d '{ "search": { "search_type": "lawsuit_cnj", "search_key": "<NUMERO_CNJ>" } }'
```

**Histórico por documento** (`cpf`, `cnpj`, `oab`, `name`)

```bash
curl -X POST "https://requests.production.judit.io/requests" \
  -H "api-key: $JUDIT_API_KEY" -H "Content-Type: application/json" \
  -d '{ "search": { "search_type": "cnpj", "search_key": "<CNPJ>" } }'
```

**Contagem antes de puxar tudo**

```bash
curl -X POST "https://lawsuits.production.judit.io/lawsuits/count" \
  -H "api-key: $JUDIT_API_KEY" -H "Content-Type: application/json" \
  -d '{ "search": { "search_type": "cpf", "search_key": "<CPF>" } }'
```

**Status e resultado (gratuitos)**

```bash
curl "https://requests.production.judit.io/requests/<REQUEST_ID>" -H "api-key: $JUDIT_API_KEY"
curl "https://requests.production.judit.io/responses?request_id=<REQUEST_ID>&page=1&page_size=100" -H "api-key: $JUDIT_API_KEY"
```

**Consumo do ciclo (gratuito)**

```bash
curl "https://requests.production.judit.io/billing/consumption" -H "api-key: $JUDIT_API_KEY"
```

**Erros comuns**

| HTTP | Motivo | Ação |
| --- | --- | --- |
| 400 | Payload inválido | Validar `search_type`, `search_key` e formato do documento |
| 401 | `api-key` ausente ou inválida | Conferir o header `api-key` |
| 404 | Recurso não encontrado | Conferir `request_id` / `tracking_id` |
| 429 | Rate limit excedido (limite em `essentialConcepts/rate-limits`) | Backoff exponencial, respeitando `X-RateLimit-Reset` |
| 500 | Erro interno | Retentar com backoff; se persistir, abrir chamado (7.2) |

CNPJ alfanumérico (IN RFB 2229/24) é aceito.
