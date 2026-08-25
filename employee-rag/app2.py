import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

load_dotenv()

print("Testing OpenRouter...")

llm = ChatOpenAI(
    model="openrouter/free",
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY")
)

response = llm.invoke(
    "What is 2 + 2? Answer in one sentence."
)

print("\nLLM Response:")
print(response.content)