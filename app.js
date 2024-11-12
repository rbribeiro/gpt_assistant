import inquirer from "inquirer";
import fs from "fs-extra";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import Openai from "openai";

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;
const openai = new Openai(apiKey);

// Helper to get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let currentAssistantId = process.env.ASSISTANT_ID;
const vectorStoreId = process.env.VECTOR_STORE_ID;

// Main menu options
const mainMenuChoices = [
  "List Assistants",
  "Create Assistant",
  "Chat with Assistant",
  "Create Thread",
  "Upload File",
  "Exit",
];

let selectedAssistant = null;

const mainMenu = () => {
  inquirer
    .prompt([
      {
        type: "list",
        name: "option",
        message: "Please choose an option:",
        choices: mainMenuChoices,
      },
    ])
    .then(({ option }) => {
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
        case "Create Thread":
          createThread();
          break;
        case "Upload File":
          uploadFile();
          break;
        case "Exit":
          console.log("Goodbye!");
          process.exit(0);
        default:
          console.log("Invalid option selected.");
          returnToMenu();
      }
    })
    .catch((error) => {
      console.error("An error occurred:", error);
    });
};

// Placeholder functions for each option
const listAssistants = async () => {
  try {
    const response = await openai.beta.assistants.list({
      order: "desc",
    });
    if (response.data.length > 0) {
      const assistantChoices = response.data.map((assistant) => ({
        name: assistant.name,
        value: assistant.id,
      }));

      let { assistantId } = await inquirer.prompt([
        {
          type: "list",
          name: "assistantId",
          message: "Select an assistant",
          choices: assistantChoices,
        },
      ]);

      currentAssistantId = assistantId;
    }
  } catch (error) {
    console.log("Error:", error);
  }

  returnToMenu();
};

const createAssistant = async () => {
  try {
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

    const assistant = {
      name: answers.name,
      description: answers.description,
    };

    const assistantsFile = path.join(__dirname, "assistants.json");
    let assistants = [];
    try {
      assistants = await fs.readJson(assistantsFile);
    } catch {
      // File doesn't exist or is invalid, start with an empty array
    }
    assistants.push(assistant);
    await fs.writeJson(assistantsFile, assistants, { spaces: 2 });
    console.log(`Assistant '${assistant.name}' created successfully!`);
  } catch (error) {
    console.error("An error occurred:", error);
  }
  returnToMenu();
};

const selectAssistant = async () => {
  const assistantsFile = path.join(__dirname, "assistants.json");
  try {
    const assistants = await fs.readJson(assistantsFile);
    if (assistants.length === 0) {
      console.log("\nNo assistants available to select.");
      return returnToMenu();
    }

    const assistantNames = assistants.map((assistant) => assistant.name);

    const { selectedName } = await inquirer.prompt([
      {
        type: "list",
        name: "selectedName",
        message: "Select an assistant:",
        choices: assistantNames,
      },
    ]);

    selectedAssistant = assistants.find(
      (assistant) => assistant.name === selectedName,
    );
    console.log(`You selected '${selectedAssistant.name}'`);
  } catch (err) {
    console.log("No assistants found.");
  }
  returnToMenu();
};

const chatWithAssistant = async () => {
  if (!currentAssistantId) {
    console.log("Please select an assistant first.");
    return returnToMenu();
  }

  try {
    // Initialize the conversation with an empty message list
    let messages = [];

    // Create a new thread for the conversation
    const threadResponse = await openai.beta.threads.create({
      messages: messages,
    });

    const threadId = threadResponse.id;
    if (!threadId) {
      console.error("Failed to create a new thread.");
      return returnToMenu();
    }

    let chatting = true;

    while (chatting) {
      // Prompt the user for a message
      const { message } = await inquirer.prompt([
        {
          type: "input",
          name: "message",
          message: ">",
        },
      ]);

      // Check if the user wants to return to the menu
      if (message.trim().toLowerCase() === "menu") {
        chatting = false;
        console.log("Returning to the main menu...");
        break;
      }

      // Add the user's message to the conversation history
      messages.push({
        role: "user",
        content: message,
      });

      // Update the thread with the new user message
      await openai.beta.threads.messages.create(threadId, {
        role: "user",
        content: message,
      });

      // Run the thread to get the assistant's response
      const runResponse = await openai.beta.threads.runs.create(threadId, {
        assistant_id: currentAssistantId,
      });

      const runId = runResponse.id;
      if (!runId) {
        console.error("Failed to initiate a run for the thread.");
        chatting = false;
        break;
      }

      // Poll the run status until it's completed
      let isCompleted = false;
      while (!isCompleted) {
        // Fetch the run status
        const runStatus = await openai.beta.threads.runs.retrieve(
          threadId,
          runId,
        );

        if (
          runStatus.status === "succeeded" ||
          runStatus.status === "completed"
        ) {
          isCompleted = true;

          // Fetch the latest messages in the thread
          const messagesResponse =
            await openai.beta.threads.messages.list(threadId);

          // Find the assistant's latest message
          const assistantMessages = messagesResponse.data.filter(
            (msg) => msg.role === "assistant",
          );

          if (assistantMessages.length > 0) {
            // Get the last assistant message
            const assistantMessage = assistantMessages[0];

            // Add the assistant's message to the conversation history
            messages.push(assistantMessage);

            // Display the assistant's message to the user
            console.log(`Assistant: ${assistantMessage.content[0].text.value}`);
          } else {
            console.log("Assistant did not respond.");
          }
        } else if (runStatus.status === "failed") {
          console.error("Run processing failed.");
          isCompleted = true;
          chatting = false;
        } else {
          // Wait before polling again
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }
  } catch (error) {
    console.error("An error occurred:", error);
  }

  returnToMenu();
};

const uploadFile = async () => {
  try {
    const { filePath } = await inquirer.prompt([
      {
        type: "input",
        name: "filePath",
        message: "Enter the path of the file to upload:",
      },
    ]);

    const fullPath = path.resolve(filePath);
    const fileExists = await fs.pathExists(fullPath);

    if (!fileExists) {
      console.log("File does not exist.");
    } else {
      // For demonstration, we'll just confirm the file exists
      console.log(`File '${fullPath}' is ready to be uploaded.`);
      const file = await openai.files.create({
        file: fs.createReadStream(filePath),
        purpose: "assistants",
      });

      const vectorStoreBatch =
        await openai.beta.vectorStores.fileBatches.create(vectorStoreId, {
          file_ids: [file.id],
        });
    }
  } catch (error) {
    console.error("An error occurred:", error);
  }
  returnToMenu();
};

const returnToMenu = () => {
  console.log("\n");
  mainMenu();
};

// Start the application
mainMenu();
