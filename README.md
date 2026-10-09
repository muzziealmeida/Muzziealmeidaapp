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
4. Cadastrar o primeiro usuário da equipe pelo fluxo normal. Um administrador autorizado deve definir `app_metadata.office_role` como `admin` ou `team`, pelo Admin API ou SQL Editor. Nunca usar `user_metadata` para privilégios.
5. Exemplo SQL **apenas no SQL Editor administrativo**, após substituir o e-mail:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"office_role":"admin"}'::jsonb
where email = 'EMAIL_DA_EQUIPE';
```

6. Sair e entrar novamente para renovar o token. Ao remover um membro, revogar sessões e considerar tokens ainda válidos até a expiração. Use prazo curto de JWT adequado ao escritório.
7. Em `/equipe`, cadastrar dados de contato e áreas de atuação reais. Revisar os textos institucionais antes de publicar.
8. Clientes criam seu acesso. A equipe escolhe o cliente cadastrado para adicionar registros. Não há cadastro público de equipe nem promoção de cliente pela interface.
9. Revisar os advisors e executar testes no projeto escolhido antes de disponibilizar dados reais.

## Funcionalidades

- Site responsivo com escritório, atuação, conteúdos, contatos e localização.
- Artigos em texto simples, rascunhos/publicação e link HTTP(S) para PDF. Não inclui disparo de newsletter por e-mail.
- Autenticação por e-mail/senha, cadastro, recuperação e logout.
- Processos com número, situação, informações e próximo passo.
- Agenda com data, horário, tipo, local e instruções; horário exibido em America/Sao_Paulo.
- Financeiro com valor, vencimento, situação, forma de pagamento e data de quitação manual.
- Contratos, boletos, decisões, sentenças e comprovantes em bucket privado. Links assinados por 60 segundos.
- Equipe com criação, edição e exclusão de registros, filtro por cliente e busca.
- RLS por cliente e escrita restrita à equipe, inclusive no Storage.
- PWA instalável. Não inclui apps nativos publicados nas lojas nem notificações push.

## Vercel

Importe `muzziealmeida/Muzziealmeidaapp` na conta/time escolhidos. Framework: Vite; build: `npm run build`; saída: `dist`; raiz: diretório do projeto. Configure as duas variáveis publicáveis nas configurações da Vercel antes do build. O `vercel.json` inclui fallback para rotas SPA e cabeçalhos básicos.

## Verificação

```sh
npm test
npm run build
```

Testes locais de RLS usam PostgreSQL embutido com mocks de Auth/Storage. São complementares aos testes reais do Supabase: não verificam entregabilidade de e-mails, emissão de sessão, uploads nem geração de URLs pelo serviço remoto.

## Identidade

`public/identidade-original.jpeg` é o arquivo enviado, sem redesenho, alteração de tipografia ou geração por IA. O cabeçalho usa enquadramento CSS dos pixels originais. Paleta baseada na imagem: azul `#3d3f56`, prata `#c4c5c9`, fundo claro complementar `#f6f5f1`. Um SVG oficial pode substituir o JPEG posteriormente para melhorar a nitidez em tamanhos maiores.

## Estado da entrega

Implementação inicial versionada neste repositório. Build de produção e seis testes locais de acesso aprovados. Validação visual no navegador pendente. Projeto Supabase e destino Vercel ainda precisam ser identificados. O schema não foi aplicado remotamente; autenticação, persistência e isolamento precisam ser verificados no ambiente escolhido antes do uso com informações reais.
