# Gerenciador de Assistentes de IA

Uma aplicação de linha de comando para gerenciar assistentes de IA usando a API da OpenAI. Esta aplicação permite criar, conversar e gerenciar assistentes de IA de forma simples e interativa.

## Pré-requisitos

- Node.js (versão 14 ou superior)
- npm (Gerenciador de Pacotes do Node)
- Uma chave de API da OpenAI

## Instalação

1. **Clone o Repositório**

   ```bash
   git clone <url-do-repositorio>
   cd <pasta-do-repositorio>

   ```

2. **Instale as Dependências**

````bash
npm install```

````

3. **Configure as Variáveis de Ambiente**

```env
OPENAI_API_KEY=sua-chave-de-api-da-openai
ASSISTANT_ID=id-do-assistente-padrão
VECTOR_STORE_ID=id-do-vector-store
```

## Uso

1. **Uso**

```bash
node app.js
```

2. **Opções do Menu Principal**

- **Listar Assistentes**: Exibe uma lista de todos os assistentes disponíveis e permite selecionar um para interação.
- **Criar Assistente**: Cria um novo assistente fornecendo um nome e uma descrição.
- **Conversar com Assistente**: Permite conversar com o assistente selecionado. Para voltar ao menu principal, digite `menu`.
- **Enviar Arquivo**: Envia um arquivo para o assistente (confirma se o arquivo existe e o prepara para envio).
- **Sair**: Sai da aplicação.
