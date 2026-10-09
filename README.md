# Muzzi & Almeida Advocacia

Primeira implementação: site institucional, publicações, portal do cliente e painel da equipe. React + Vite, Supabase Auth/Postgres/Storage e deploy na Vercel. PWA com identidade visual original e sem cache de dados privados.

## Executar

```sh
npm ci
cp .env.example .env
npm run dev
```

Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` com o projeto dedicado ao escritório. Somente a URL e a chave publicável são enviadas ao navegador. Nunca use `service_role` ou chave secreta no front-end.

Sem essas variáveis, o site público funciona e o login informa que a área está em preparação. Não existem clientes, processos ou boletos fictícios.

## Configurar Supabase

1. Escolher um projeto novo e exclusivo para o escritório. Não usar os bancos de outros projetos pessoais.
2. Revisar e executar `supabase/bootstrap.sql` no SQL Editor do projeto. É um bootstrap inicial, não uma migração incremental; não repetir em banco já configurado.
3. Configurar Auth com confirmação de e-mail, Site URL e Redirect URLs (`https://DOMINIO/cliente` e endereço local para desenvolvimento).
4. Revisar e executar `supabase/access-control.sql` depois do bootstrap. Isso adiciona login por usuário, bloqueio de primeiro acesso e invalidação de sessões antigas por data.
5. Configurar no servidor/Vercel `SUPABASE_URL`, `SUPABASE_ACCESS_FUNCTION_URL`, `INITIAL_ACCESS_PASSWORD` e `APP_URL`; `SUPABASE_SERVICE_ROLE_KEY` só é necessário para execução direta sem Edge Function. Chaves administrativas e senha provisória ficam somente no servidor, sem prefixo `VITE_`.
6. Desativar cadastro público em Auth; as contas são criadas pelos advogados. Cada usuário tem um alias interno de autenticação; esse alias não recebe e-mails. Recuperação assistida em “Gerenciar acessos”.
7. Com variáveis configuradas e banco correto, executar uma única vez:

```sh
node --env-file=.env scripts/create-first-lawyer.mjs
```

Isso provisiona `@rafaelmuzzi` como administrador e exige troca da senha no primeiro acesso. A conta já foi provisionada no projeto dedicado por uma função temporária usando a Auth Admin API. Não execute novamente para esse usuário.
8. Advogados entram em `/advogados` (o endereço anterior `/equipe` também funciona). Clientes entram em `/cliente`.
9. Depois da troca obrigatória, o usuário precisa entrar novamente com a senha pessoal. RLS bloqueia sessões anteriores, mesmo que ainda tenham um JWT sem expiração.
10. No painel, “Gerenciar acessos” cria clientes ou advogados e redefine a senha provisória, exigindo nova troca. Os advogados têm acesso à gestão dos registros e dos conteúdos do site.
11. O papel de acesso fica em `user_access`, com escrita exclusiva pelo serviço administrativo. Alterar metadata no navegador não concede acesso.
12. Revisar advisors e verificar login, troca de senha e isolamento no projeto escolhido antes de disponibilizar dados reais.

## Funcionalidades

- Site responsivo com escritório, atuação, conteúdos, contatos e localização.
- Artigos em texto simples, rascunhos/publicação e link HTTP(S) para PDF. Não inclui disparo de newsletter por e-mail.
- Logins separados por usuário para clientes e advogados, troca obrigatória da senha provisória, recuperação assistida e logout.
- Processos com número, situação, informações e próximo passo.
- Agenda com data, horário, tipo, local e instruções; horário exibido em America/Sao_Paulo.
- Financeiro com valor, vencimento, situação, forma de pagamento e data de quitação manual.
- Contratos, boletos, decisões, sentenças e comprovantes em bucket privado. Links assinados por 60 segundos.
- Equipe com criação, edição e exclusão de registros, filtro por cliente e busca.
- RLS por cliente e escrita restrita à equipe, inclusive no Storage.
- PWA instalável. Não inclui apps nativos publicados nas lojas nem notificações push.

## Vercel

Importe `muzziealmeida/Muzziealmeidaapp` na conta/time escolhidos. Framework: Vite; build: `npm run build`; saída: `dist`; raiz: diretório do projeto. Configure as duas variáveis publicáveis e as variáveis de servidor nas configurações da Vercel antes do deploy. A senha provisória deve ser cadastrada como variável sensível de servidor. O `vercel.json` inclui fallback para rotas SPA e cabeçalhos básicos.

## Verificação

```sh
npm test
npm run build
```

Testes locais de RLS usam PostgreSQL embutido com mocks de Auth/Storage. São complementares aos testes reais do Supabase: não verificam entregabilidade de e-mails, emissão de sessão, uploads nem geração de URLs pelo serviço remoto.

## Identidade

`public/identidade-original.jpeg` é o arquivo enviado, sem redesenho, alteração de tipografia ou geração por IA. O cabeçalho usa enquadramento CSS dos pixels originais. Paleta baseada na imagem: azul `#3d3f56`, prata `#c4c5c9`, fundo claro complementar `#f6f5f1`. Um SVG oficial pode substituir o JPEG posteriormente para melhorar a nitidez em tamanhos maiores.

## Estado da entrega

Implementação inicial versionada neste repositório. Build de produção e testes locais de acesso aprovados. Validação visual no navegador pendente. Vercel configurada na conta Muzzi. Supabase dedicado conectado e schemas aplicados. O acesso administrativo usa uma Edge Function com autenticação e verificação de sessão; a chave administrativa permanece no servidor Supabase.

## Connected deployment

The dedicated project `wtuzunibudcuasdwhrur` now has the bootstrap and access-control schemas applied. The `rafaelmuzzi` administrator was provisioned through the Auth Admin API with mandatory first-login password change. The temporary provisioning function was closed afterward.

Vercel proxies `/api/access` to the `office-access` Edge Function using the signed-in user's JWT. The function independently checks Auth identity, session freshness, database role and first-login status before administrative operations. It reads the administrative key from Supabase's built-in server environment; no service key is needed in Vercel or the browser. The provisional password comes from the sensitive Vercel environment and is checked against its SHA-256 fingerprint in the function. Changes to the provisional password require updating that fingerprint and redeploying the function.

The Edge Function source is `supabase/functions/office-access/index.ts`; include the referenced `server/` and `shared/` modules when bundling. The deployed bundle uses the same shared handler and account helpers. `verify_jwt=false` is intentional: the handler validates the user's token with Auth `getUser()` and checks the backing session in the database before granting any operation. There is no anonymous administration path.
