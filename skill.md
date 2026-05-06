---
name: judit-api
description: Skill para usar a Judit API — consulta de processos judiciais brasileiros por CPF, CNPJ, OAB, Nome ou CNJ; monitoramento; dados cadastrais; mandados de prisão; execução penal.
---

# Skill: Judit API

Esta skill ajuda agentes (Claude, GPT, etc.) a consumirem a Judit API com segurança e eficiência.

## Pré-requisitos

- API Key configurada na variável de ambiente `JUDIT_API_KEY`.
- Header obrigatório em todas as chamadas: `api-key: <chave>`.

## Capacidades principais

### 1. Consultar um processo específico (CNJ)

```bash
curl -X POST "https://requests.production.judit.io/requests" \
  -H "api-key: $JUDIT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "search": { "search_type": "lawsuit_cnj", "search_key": "<NUMERO_CNJ>" } }'
```

Para resposta imediata (cache da Judit), troque para:

```bash
curl -X POST "https://lawsuits.production.judit.io/lawsuits" \
  -H "api-key: $JUDIT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "search": { "search_type": "lawsuit_cnj", "search_key": "<NUMERO_CNJ>" } }'
```

### 2. Buscar processos por documento (CPF/CNPJ/OAB/Nome)

```bash
curl -X POST "https://requests.production.judit.io/requests" \
  -H "api-key: $JUDIT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "search": { "search_type": "cnpj", "search_key": "<CNPJ>" } }'
```

`search_type` aceita: `cpf`, `cnpj`, `oab`, `name`, `lawsuit_cnj`, `lawsuit_id`.

CNPJ alfanumérico (IN RFB 2229/24) é aceito. Use `A1B2C3D4/E5F6-90` para teste.

### 3. Monitorar um processo (recorrência)

```bash
curl -X POST "https://tracking.production.judit.io/tracking" \
  -H "api-key: $JUDIT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "recurrence": 1,
    "search": { "search_type": "lawsuit_cnj", "search_key": "<NUMERO_CNJ>" }
  }'
```

### 4. Dados cadastrais (CPF/CNPJ/Nome)

```bash
curl -X POST "https://lawsuits.production.judit.io/entities" \
  -H "api-key: $JUDIT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "search": { "search_type": "cpf", "search_key": "<CPF>", "response_type": "entity" } }'
```

### 5. Contagem e agregações sintéticas

```bash
curl -X POST "https://lawsuits.production.judit.io/lawsuits/count" \
  -H "api-key: $JUDIT_API_KEY" \
  -d '{ "search": { "search_type": "cpf", "search_key": "<CPF>" } }'

curl -X POST "https://lawsuits.production.judit.io/lawsuits/synthetic" \
  -H "api-key: $JUDIT_API_KEY" \
  -d '{ "search": { "search_type": "cpf", "search_key": "<CPF>" } }'
```

## Padrão assíncrono

1. `POST /requests` retorna `request_id` com status `pending`.
2. Aguarde via:
   - **Webhook** — registre `callback_url` no payload OU via suporte.
   - **Polling** — `GET /requests/{request_id}` até `status: "completed"`.
3. Leia o resultado em `GET /responses?request_id={request_id}`.

## Identificando respostas em cache

A resposta carrega `cached_response`:
- `true` → veio do cache JUDIT (resposta inicial rápida).
- `false` → resposta atualizada após coleta direta no tribunal.

Receber dois webhooks com payload similar é normal. O **último** (`cached_response: false`) é o mais atual.

## Rate limit

- 500 req/min por API Key.
- Em HTTP 429, faça backoff exponencial respeitando `X-RateLimit-Reset`.

## Erros comuns

| HTTP | Motivo | Ação |
| --- | --- | --- |
| 400 | Payload inválido | Validar `search_type`, `search_key` e formato do documento |
| 401 | API Key ausente/inválida | Verificar header `api-key` |
| 404 | Recurso não encontrado | Verificar `request_id` / `tracking_id` |
| 429 | Rate limit excedido | Backoff exponencial |
| 500 | Erro interno | Retentar com backoff e abrir ticket no suporte |

## Documentação completa

- Visão geral: https://docs.judit.io/
- Specs OpenAPI ao vivo:
  - https://requests.production.judit.io/docs/spec
  - https://tracking.production.judit.io/docs/spec
  - https://lawsuits.production.judit.io/docs/spec
