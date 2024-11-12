// Importa as bibliotecas necessárias
import inquirer from "inquirer"; // Para prompts interativos no terminal
import fs from "fs-extra"; // Para operações de sistema de arquivos com promessas
import path from "path"; // Para manipulação de caminhos de arquivo
import dotenv from "dotenv"; // Para carregar variáveis de ambiente
import { fileURLToPath } from "url"; // Para obter o caminho do arquivo em módulos ES
import Openai from "openai"; // Cliente da OpenAI para interagir com a API

// Carrega variáveis de ambiente do arquivo .env
dotenv.config();

// Configura a chave da API da OpenAI
const apiKey = process.env.OPENAI_API_KEY;
const openai = new Openai(apiKey); // Inicializa o cliente da OpenAI

// Obtemos o diretório atual no formato ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// IDs iniciais para o assistente e o armazenamento vetorial
let currentAssistantId = process.env.ASSISTANT_ID;
const vectorStoreId = process.env.VECTOR_STORE_ID;

// Opções disponíveis no menu principal
const mainMenuChoices = [
  "List Assistants", // Listar assistentes
  "Create Assistant", // Criar assistente
  "Chat with Assistant", // Conversar com assistente
  "Upload File", // Enviar arquivo
  "Exit", // Sair da aplicação
];

// Função que exibe o menu principal e lida com as opções escolhidas
const mainMenu = () => {
  inquirer
    .prompt([
      {
        type: "list", // Tipo de prompt: lista de opções
        name: "option", // Nome da resposta
        message: "Please choose an option:", // Mensagem exibida ao usuário
        choices: mainMenuChoices, // Opções do menu
      },
    ])
    .then(({ option }) => {
      // Verifica qual opção foi selecionada e chama a função correspondente
      switch (option) {
        case "List Assistants":
          listAssistants();
          break;
        case "Chat with Assistant":
          chatWithAssistant();
          break;
        case "Create Assistant":
          createAssistant();
          break;
        case "Upload File":
          uploadFile();
          break;
        case "Exit":
          console.log("Goodbye!");
          process.exit(0); // Encerra a aplicação
        default:
          console.log("Invalid option selected.");
          returnToMenu(); // Retorna ao menu se a opção for inválida
      }
    })
    .catch((error) => {
      console.error("An error occurred:", error); // Lida com erros
    });
};

/**
 * Função para listar assistentes disponíveis e permitir que o usuário selecione um.
 *
 * Esta função faz uma solicitação à API da OpenAI para obter uma lista de assistentes
 * ordenada em ordem decrescente. Se assistentes forem encontrados, as opções são exibidas
 * em um menu interativo, permitindo que o usuário selecione um assistente. O ID do assistente
 * selecionado é então armazenado na variável `currentAssistantId`.
 *
 * Fluxo da função:
 * 1. Solicita à OpenAI a lista de assistentes.
 * 2. Verifica se a resposta contém assistentes disponíveis.
 * 3. Mapeia os assistentes em uma lista de opções para o menu interativo.
 * 4. Usa `inquirer` para exibir as opções e solicitar ao usuário que selecione um assistente.
 * 5. Atualiza `currentAssistantId` com o ID do assistente selecionado.
 * 6. Lida com possíveis erros e exibe uma mensagem de erro, se necessário.
 * 7. Retorna ao menu principal chamando `returnToMenu()`.
 *
 * @async
 * @function listAssistants
 * @returns {void} Retorna ao menu principal após a execução.
 */
const listAssistants = async () => {
  try {
    // Solicita à OpenAI a lista de assistentes, ordenada em ordem decrescente
    const response = await openai.beta.assistants.list({
      order: "desc",
    });

    if (response.data.length > 0) {
      // Mapeia os assistentes para exibir como opções no menu
      const assistantChoices = response.data.map((assistant) => ({
        name: assistant.name,
        value: assistant.id,
      }));

      // Solicita ao usuário que selecione um assistente
      let { assistantId } = await inquirer.prompt([
        {
          type: "list",
          name: "assistantId",
          message: "Select an assistant",
          choices: assistantChoices,
        },
      ]);

      currentAssistantId = assistantId; // Atualiza o ID do assistente atual
    }
  } catch (error) {
    console.log("Error:", error); // Lida com erros
  }

  returnToMenu(); // Retorna ao menu principal
};
//TODO: Fix this method
// Função para criar um novo assistente
const createAssistant = async () => {
  try {
    // Solicita ao usuário o nome e a descrição do novo assistente
    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "Enter the assistant name:",
      },
      {
        type: "input",
        name: "description",
        message: "Enter a description for the assistant:",
      },
    ]);

    // Cria um objeto assistente com as respostas do usuário
    const assistant = {
      name: answers.name,
      description: answers.description,
    };

    const assistantsFile = path.join(__dirname, "assistants.json"); // Caminho do arquivo JSON de assistentes
    let assistants = [];
    try {
      assistants = await fs.readJson(assistantsFile); // Lê o arquivo de assistentes
    } catch {
      // Arquivo não existe ou é inválido, inicia com um array vazio
    }
    assistants.push(assistant); // Adiciona o novo assistente ao array
    await fs.writeJson(assistantsFile, assistants, { spaces: 2 }); // Escreve o array atualizado no arquivo
    console.log(`Assistant '${assistant.name}' created successfully!`);
  } catch (error) {
    console.error("An error occurred:", error); // Lida com erros
  }
  returnToMenu(); // Retorna ao menu principal
};

/**
 * Função para iniciar uma conversa interativa com um assistente selecionado.
 *
 * Esta função permite que o usuário interaja com um assistente de IA, enviando mensagens
 * e recebendo respostas em um loop contínuo até que o usuário digite "menu" para voltar
 * ao menu principal. A conversa é gerenciada como um thread, com mensagens sendo enviadas
 * e respostas sendo buscadas da API da OpenAI.
 *
 * Fluxo da função:
 * 1. Verifica se um assistente está selecionado (se `currentAssistantId` está definido).
 * 2. Inicializa uma conversa com uma lista vazia de mensagens.
 * 3. Cria um novo tópico de conversa usando a API da OpenAI.
 * 4. Entra em um loop contínuo onde:
 *    - Solicita ao usuário que digite uma mensagem.
 *    - Verifica se o usuário deseja sair digitando "menu".
 *    - Adiciona a mensagem do usuário ao histórico e atualiza o tópico.
 *    - Executa o tópico para obter a resposta do assistente.
 *    - Realiza polling até que a execução seja concluída, e então busca a resposta.
 *    - Exibe a resposta do assistente ou uma mensagem de erro se a resposta falhar.
 * 5. Lida com erros ao longo do processo e exibe mensagens apropriadas.
 * 6. Retorna ao menu principal ao final da interação ou se ocorrer um erro.
 *
 * @async
 * @function chatWithAssistant
 * @returns {void} Retorna ao menu principal após a execução.
 */
const chatWithAssistant = async () => {
  if (!currentAssistantId) {
    console.log("Please select an assistant first."); // Verifica se um assistente está selecionado
    return returnToMenu();
  }

  try {
    // Inicializa a conversa com uma lista vazia de mensagens
    let messages = [];

    // Cria um novo tópico de conversa
    const threadResponse = await openai.beta.threads.create({
      messages: messages,
    });

    const threadId = threadResponse.id; // ID do tópico criado
    if (!threadId) {
      console.error("Failed to create a new thread.");
      return returnToMenu(); // Retorna ao menu se falhar
    }

    let chatting = true;

    while (chatting) {
      // Solicita ao usuário que digite uma mensagem
      const { message } = await inquirer.prompt([
        {
          type: "input",
          name: "message",
          message: ">",
        },
      ]);

      // Verifica se o usuário quer voltar ao menu
      if (message.trim().toLowerCase() === "menu") {
        chatting = false;
        console.log("Returning to the main menu...");
        break;
      }

      // Adiciona a mensagem do usuário ao histórico da conversa
      messages.push({
        role: "user",
        content: message,
      });

      // Atualiza o tópico com a nova mensagem do usuário
      await openai.beta.threads.messages.create(threadId, {
        role: "user",
        content: message,
      });

      // Executa o tópico para obter a resposta do assistente
      const runResponse = await openai.beta.threads.runs.create(threadId, {
        assistant_id: currentAssistantId,
      });

      const runId = runResponse.id; // ID da execução
      if (!runId) {
        console.error("Failed to initiate a run for the thread.");
        chatting = false;
        break;
      }

      // Polling para verificar o status da execução até ser concluída
      let isCompleted = false;
      while (!isCompleted) {
        // Busca o status da execução
        const runStatus = await openai.beta.threads.runs.retrieve(
          threadId,
          runId,
        );

        if (
          runStatus.status === "succeeded" ||
          runStatus.status === "completed"
        ) {
          isCompleted = true;

          // Busca as mensagens mais recentes no tópico
          const messagesResponse =
            await openai.beta.threads.messages.list(threadId);

          // Filtra a última mensagem do assistente
          const assistantMessages = messagesResponse.data.filter(
            (msg) => msg.role === "assistant",
          );

          if (assistantMessages.length > 0) {
            // Obtém a última mensagem do assistente
            const assistantMessage = assistantMessages[0];

            // Adiciona a mensagem do assistente ao histórico
            messages.push(assistantMessage);

            // Exibe a mensagem do assistente para o usuário
            console.log(`Assistant: ${assistantMessage.content[0].text.value}`);
          } else {
            console.log("Assistant did not respond.");
          }
        } else if (runStatus.status === "failed") {
          console.error("Run processing failed.");
          isCompleted = true;
          chatting = false;
        } else {
          // Espera antes de verificar o status novamente
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }
  } catch (error) {
    console.error("An error occurred:", error); // Lida com erros
  }

  returnToMenu(); // Retorna ao menu principal
};

/**
 * Função para enviar um arquivo para o assistente.
 *
 * Esta função permite ao usuário fornecer o caminho de um arquivo que será enviado
 * para o sistema de assistentes da OpenAI. O arquivo é validado para garantir que
 * existe antes de ser carregado. Se o envio for bem-sucedido, o arquivo é preparado
 * para ser usado em um armazenamento vetorial.
 *
 * Fluxo da função:
 * 1. Solicita ao usuário que insira o caminho do arquivo.
 * 2. Resolve o caminho completo do arquivo e verifica se ele existe.
 * 3. Se o arquivo não existir, exibe uma mensagem de erro.
 * 4. Se o arquivo existir, lê o arquivo como um stream e o envia para a OpenAI.
 * 5. Cria um lote de armazenamento vetorial com o arquivo enviado.
 * 6. Lida com possíveis erros e exibe mensagens apropriadas.
 * 7. Retorna ao menu principal chamando `returnToMenu()`.
 *
 * @async
 * @function uploadFile
 * @returns {void} Retorna ao menu principal após a execução.
 */
const uploadFile = async () => {
  try {
    // Solicita ao usuário o caminho do arquivo a ser enviado
    const { filePath } = await inquirer.prompt([
      {
        type: "input",
        name: "filePath",
        message: "Enter the path of the file to upload:",
      },
    ]);

    const fullPath = path.resolve(filePath); // Resolve o caminho completo do arquivo
    const fileExists = await fs.pathExists(fullPath); // Verifica se o arquivo existe

    if (!fileExists) {
      console.log("File does not exist."); // Mensagem se o arquivo não existir
    } else {
      // Confirma que o arquivo existe e está pronto para envio
      console.log(`File '${fullPath}' is ready to be uploaded.`);
      const file = await openai.files.create({
        file: fs.createReadStream(filePath), // Lê o arquivo como um stream
        purpose: "assistants",
      });

      // Cria um lote no armazenamento vetorial
      const vectorStoreBatch =
        await openai.beta.vectorStores.fileBatches.create(vectorStoreId, {
          file_ids: [file.id],
        });
    }
  } catch (error) {
    console.error("An error occurred:", error); // Lida com erros
  }
  returnToMenu(); // Retorna ao menu principal
};

// Função para retornar ao menu principal
const returnToMenu = () => {
  console.log("\n");
  mainMenu(); // Chama o menu principal novamente
};

// Inicia a aplicação chamando o menu principal
mainMenu();
